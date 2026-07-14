import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { decrypt, encrypt } from "./tokenCrypto";

// Токены никогда не должны попасть в git или в логи — храним зашифрованным
// файлом вне репозитория (<cwd>/.data/, см. .gitignore), а не в env (env
// статичен на время процесса, а нам нужно перезаписывать значения при
// каждом refresh) и не в БД (в проекте её нет). process.cwd() — значит у
// Content Studio (apps/web) это apps/web/.data, у autopost-worker — его
// собственная рабочая директория; чтобы воркер публиковал уже подключённым
// аккаунтом, эти файлы нужно один раз скопировать туда (см.
// AUTOPOST_WORKER_SETUP.md) — токен-эндпоинты TikTok/YouTube/Instagram не
// поддерживают service-account/безинтерактивный логин.
const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "tiktok-tokens.enc");

export interface TikTokTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms, когда истекает access_token */
  accessExpiresAt: number;
  /** Unix ms, когда истекает refresh_token */
  refreshExpiresAt: number;
  openId: string;
  scope: string;
}

export async function saveTikTokTokens(tokens: TikTokTokens): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, encrypt(JSON.stringify(tokens)), { mode: 0o600 });
}

export async function loadTikTokTokens(): Promise<TikTokTokens | null> {
  try {
    const data = await readFile(STORE_PATH);
    return JSON.parse(decrypt(data)) as TikTokTokens;
  } catch {
    // файла ещё нет (не подключались) или он повреждён/от другого ключа — оба
    // случая обрабатываем одинаково: считаем, что TikTok не подключён
    return null;
  }
}

export async function clearTikTokTokens(): Promise<void> {
  await rm(STORE_PATH, { force: true });
}
