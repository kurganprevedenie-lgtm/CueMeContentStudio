import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { decrypt, encrypt } from "./tokenCrypto";

// Общий дженерик для TikTok/YouTube — раньше был один зашифрованный файл на
// платформу (<cwd>/.data/tiktok-tokens.enc), теперь один файл НА АККАУНТ
// (<cwd>/.data/{platform}-{id}.enc), чтобы можно было подключить несколько
// аккаунтов одной платформы одновременно. Имя файла — сам по себе индекс,
// отдельного accounts.json не заводим (нечему разъехаться с реальными
// файлами). process.cwd() — та же логика, что была раньше: у Content Studio
// (apps/web) это apps/web/.data, у autopost-worker — его собственная рабочая
// директория (см. AUTOPOST_WORKER_SETUP.md).
const STORE_DIR = path.join(process.cwd(), ".data");

/**
 * Пауза между публикациями на РАЗНЫЕ аккаунты ОДНОЙ платформы (в первую
 * очередь TikTok) — защита от анти-спам ограничений вроде
 * spam_risk_too_many_pending_share при частых заливках подряд с одного
 * приложения/IP. Общее место для apps/web (tiktokJobs.ts/youtubeJobs.ts) и
 * services/autopost-worker (publish.ts), чтобы значение не разъехалось.
 * Стартовое значение — по ощущению, без замеров реальных лимитов TikTok;
 * ужесточать/ослаблять по факту использования.
 */
export const INTER_ACCOUNT_PUBLISH_PAUSE_MS = 60_000;

export interface StoredAccount<TTokens> {
  id: string;
  /** Пользовательское имя — по умолчанию "TikTok #2" и т.п., переименовывается на странице /accounts */
  label: string;
  /** ISO-строка */
  createdAt: string;
  tokens: TTokens;
}

export interface AccountStore<TTokens> {
  save: (account: StoredAccount<TTokens>) => Promise<void>;
  load: (id: string) => Promise<StoredAccount<TTokens> | null>;
  list: () => Promise<StoredAccount<TTokens>[]>;
  remove: (id: string) => Promise<void>;
  /** Точечно обновляет только tokens (id/label/createdAt не трогает) — для сохранения после refresh */
  updateTokens: (id: string, tokens: TTokens) => Promise<void>;
}

function filePath(platform: string, id: string): string {
  return path.join(STORE_DIR, `${platform}-${id}.enc`);
}

/**
 * Один раз переносит старый единственный файл {platform}-tokens.enc (схема
 * "один аккаунт на платформу") в новую схему — вызывается изнутри list()
 * только когда per-account файлов ещё нет вообще, так что при обычной
 * работе это лишний readdir/stat, не более. Старый файл переименовывается в
 * .migrated (не удаляется) — чтобы можно было откатиться руками, если
 * что-то пойдёт не так. Прозрачно и для Content Studio, и для
 * autopost-worker на сервере — оба используют один и тот же код.
 */
async function migrateLegacyIfNeeded<TTokens>(
  platform: string,
  defaultLabel: string
): Promise<void> {
  const legacyPath = path.join(STORE_DIR, `${platform}-tokens.enc`);
  let legacyRaw: Buffer;
  try {
    legacyRaw = await readFile(legacyPath);
  } catch {
    return; // старого файла нет — нечего мигрировать
  }
  try {
    const tokens = JSON.parse(decrypt(legacyRaw)) as TTokens;
    const account: StoredAccount<TTokens> = {
      id: randomUUID(),
      label: defaultLabel,
      createdAt: new Date().toISOString(),
      tokens,
    };
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(filePath(platform, account.id), encrypt(JSON.stringify(account)), {
      mode: 0o600,
    });
    await rename(legacyPath, `${legacyPath}.migrated`);
  } catch {
    // старый файл битый/от другого TOKEN_ENCRYPTION_KEY — не мигрируем,
    // list() просто вернёт пустой массив, как и раньше в этом случае
  }
}

export function createAccountStore<TTokens>(
  platform: "tiktok" | "youtube",
  legacyDefaultLabel: string
): AccountStore<TTokens> {
  async function save(account: StoredAccount<TTokens>): Promise<void> {
    await mkdir(STORE_DIR, { recursive: true });
    await writeFile(
      filePath(platform, account.id),
      encrypt(JSON.stringify(account)),
      { mode: 0o600 }
    );
  }

  async function load(id: string): Promise<StoredAccount<TTokens> | null> {
    try {
      const data = await readFile(filePath(platform, id));
      return JSON.parse(decrypt(data)) as StoredAccount<TTokens>;
    } catch {
      // файла нет, id левый, или он от другого TOKEN_ENCRYPTION_KEY — везде
      // считаем "аккаунт не найден", а не роняем вызывающий код
      return null;
    }
  }

  function extractAccountIds(filenames: string[]): string[] {
    const prefix = `${platform}-`;
    // {platform}-tokens.enc — старое имя единственного файла на платформу, ДО
    // мультиаккаунта — по префиксу/расширению оно неотличимо от нового
    // {platform}-{id}.enc, поэтому исключаем его явно, чтобы не принять
    // легаси-файл (структура — голые токены, без id/label/createdAt) за
    // полноценный StoredAccount.
    const legacyName = `${platform}-tokens.enc`;
    return filenames
      .filter((f) => f !== legacyName && f.startsWith(prefix) && f.endsWith(".enc"))
      .map((f) => f.slice(prefix.length, -".enc".length));
  }

  async function list(): Promise<StoredAccount<TTokens>[]> {
    let filenames: string[];
    try {
      filenames = await readdir(STORE_DIR);
    } catch {
      filenames = [];
    }
    let ids = extractAccountIds(filenames);

    if (ids.length === 0) {
      await migrateLegacyIfNeeded<TTokens>(platform, legacyDefaultLabel);
      try {
        filenames = await readdir(STORE_DIR);
      } catch {
        return [];
      }
      ids = extractAccountIds(filenames);
    }

    const accounts = await Promise.all(ids.map((id) => load(id)));
    return accounts
      .filter(
        (a): a is StoredAccount<TTokens> =>
          a !== null && typeof a.createdAt === "string"
      )
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async function remove(id: string): Promise<void> {
    await rm(filePath(platform, id), { force: true });
  }

  async function updateTokens(id: string, tokens: TTokens): Promise<void> {
    const existing = await load(id);
    if (!existing) return; // аккаунт уже отключили параллельно — просто не пересоздаём
    await save({ ...existing, tokens });
  }

  return { save, load, list, remove, updateTokens };
}
