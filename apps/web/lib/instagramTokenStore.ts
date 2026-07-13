import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { decrypt, encrypt } from "./tokenCrypto";

// Тот же подход, что в tiktokTokenStore.ts/youtubeTokenStore.ts — зашифрованный
// файл вне репозитория (apps/web/.data/, см. .gitignore), не env, не БД.
const STORE_DIR = path.join(process.cwd(), ".data");
const STORE_PATH = path.join(STORE_DIR, "instagram-tokens.enc");

export interface InstagramTokens {
  /** Долгоживущий User Access Token (~60 дней), обмен на него — см. instagramApi.ts */
  userAccessToken: string;
  /** Unix ms, когда истекает userAccessToken */
  userAccessExpiresAt: number;
  pageId: string;
  pageName: string;
  /** Page Access Token, производный от userAccessToken — им реально публикуем в Instagram */
  pageAccessToken: string;
  igUserId: string;
  igUsername: string;
}

export async function saveInstagramTokens(tokens: InstagramTokens): Promise<void> {
  await mkdir(STORE_DIR, { recursive: true });
  await writeFile(STORE_PATH, encrypt(JSON.stringify(tokens)), { mode: 0o600 });
}

export async function loadInstagramTokens(): Promise<InstagramTokens | null> {
  try {
    const data = await readFile(STORE_PATH);
    return JSON.parse(decrypt(data)) as InstagramTokens;
  } catch {
    // файла ещё нет (не подключались) или он повреждён/от другого ключа — оба
    // случая обрабатываем одинаково: считаем, что Instagram не подключён
    return null;
  }
}

export async function clearInstagramTokens(): Promise<void> {
  await rm(STORE_PATH, { force: true });
}
