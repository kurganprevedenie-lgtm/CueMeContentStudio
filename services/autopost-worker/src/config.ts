import path from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadDotenv } from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, "..");

loadDotenv({ path: path.join(ROOT_DIR, ".env") });

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} не задан — добавь его в .env (см. .env.example)`);
  }
  return value;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

function envPath(name: string, fallback: string): string {
  const raw = process.env[name];
  const value = raw && raw.trim() ? raw : fallback;
  return path.isAbsolute(value) ? value : path.join(ROOT_DIR, value);
}

/** Список id через запятую — id аккаунтов берутся со страницы /accounts в Content Studio */
function envIdList(name: string): string[] {
  const raw = process.env[name];
  if (!raw) return [];
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export const config = {
  rootDir: ROOT_DIR,

  // Google Drive
  driveFolderId: requireEnv("GDRIVE_FOLDER_ID"),
  driveServiceAccountKeyPath: envPath(
    "GDRIVE_SERVICE_ACCOUNT_KEY_PATH",
    "service-account.json"
  ),
  drivePollIntervalMin: envInt("GDRIVE_POLL_INTERVAL_MIN", 5),

  // Расписание/очередь/логи — файлы на диске, не БД (см. AUTOPOST_WORKER_SETUP.md)
  scheduleConfigPath: envPath("SCHEDULE_CONFIG_PATH", "config/schedule.json"),
  stateFilePath: envPath("STATE_FILE_PATH", "data/state.json"),
  tempDir: envPath("TEMP_DIR", "tmp"),
  logFilePath: envPath("LOG_FILE_PATH", "autopost-worker.log"),

  // Какие площадки публикуем — можно выключить те, что ещё не подключены
  enableTikTok: envBool("ENABLE_TIKTOK", true),
  enableYouTube: envBool("ENABLE_YOUTUBE", true),
  enableInstagram: envBool("ENABLE_INSTAGRAM", true),

  // Мультиаккаунт: у воркера нет своего UI для выбора аккаунтов на каждый
  // пост (он сам находит видео в Drive, спрашивать пользователя не у кого),
  // поэтому список id — статический, из .env. Каждое видео из Drive уйдёт
  // на ВСЕ перечисленные здесь аккаунты. id — со страницы /accounts в
  // Content Studio (там же лежат сами зашифрованные токены — .data/{id}.enc
  // нужно скопировать на сервер воркера, см. AUTOPOST_WORKER_SETUP.md).
  tiktokAccountIds: envIdList("TIKTOK_ACCOUNT_IDS"),
  youtubeAccountIds: envIdList("YOUTUBE_ACCOUNT_IDS"),

  // Заголовок/подпись — {filename} подставляется именем файла в Drive без расширения
  captionTemplate: process.env.WORKER_CAPTION_TEMPLATE ?? "{filename}",
  youtubePrivacyStatus: (process.env.YOUTUBE_PRIVACY_STATUS ?? "unlisted") as
    | "public"
    | "unlisted"
    | "private",
} as const;
