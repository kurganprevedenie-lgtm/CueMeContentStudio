import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { decrypt, encrypt } from "./tokenCrypto";

// Тот же подход, что в tiktokTokenStore.ts — зашифрованный файл вне
// репозитория (<cwd>/.data/, см. .gitignore), не env, не БД.
const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "youtube-tokens.enc");

export interface YouTubeTokens {
  accessToken: string;
  refreshToken: string;
  /** Unix ms, когда истекает access_token */
  accessExpiresAt: number;
}

export async function saveYouTubeTokens(tokens: YouTubeTokens): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, encrypt(JSON.stringify(tokens)), { mode: 0o600 });
}

export async function loadYouTubeTokens(): Promise<YouTubeTokens | null> {
  try {
    const data = await readFile(STORE_PATH);
    return JSON.parse(decrypt(data)) as YouTubeTokens;
  } catch {
    // файла ещё нет (не подключались) или он повреждён/от другого ключа — оба
    // случая обрабатываем одинаково: считаем, что YouTube не подключён
    return null;
  }
}

export async function clearYouTubeTokens(): Promise<void> {
  await rm(STORE_PATH, { force: true });
}
