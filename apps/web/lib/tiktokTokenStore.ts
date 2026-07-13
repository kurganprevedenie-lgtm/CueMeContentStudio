import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

// Токены никогда не должны попасть в git или в логи — храним зашифрованным
// файлом вне репозитория (apps/web/.data/, см. .gitignore), а не в env
// (env статичен на время процесса, а нам нужно перезаписывать значения
// при каждом refresh) и не в БД (в проекте её нет).
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

function getEncryptionKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY не задан — добавь его в .env (см. .env.example) и перезапусти pnpm dev"
    );
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY должен быть 32 байтами в hex-кодировке (64 символа)"
    );
  }
  return key;
}

/** AES-256-GCM: iv(12) + authTag(16) + ciphertext — одним файлом */
function encrypt(plaintext: string): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

function decrypt(data: Buffer): string {
  const iv = data.subarray(0, 12);
  const authTag = data.subarray(12, 28);
  const ciphertext = data.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
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
