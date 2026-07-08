import { randomUUID } from "node:crypto";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";

import { nodeReader } from "@remotion/media-parser/node";
import { parseMedia } from "@remotion/media-parser";

const BACKGROUNDS_DIR = path.join(process.cwd(), "public", "backgrounds");
const ALLOWED_EXTENSIONS = new Set([".mp4", ".mov"]);
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024; // 200MB

export interface BackgroundVideoInfo {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  width: number;
  height: number;
}

interface CacheEntry {
  mtimeMs: number;
  info: BackgroundVideoInfo;
}

// Парсинг реальной длительности/размеров — не самая быстрая операция,
// кэшируем по имени файла + времени изменения. globalThis — по той же
// причине, что и в lib/renderJobs.ts: в dev Next/Turbopack может собрать
// разные API-роуты как отдельные экземпляры модуля.
declare global {
  var __cuemeBackgroundsCache: Map<string, CacheEntry> | undefined;
}
const cache = globalThis.__cuemeBackgroundsCache ?? new Map<string, CacheEntry>();
globalThis.__cuemeBackgroundsCache = cache;

async function readBackgroundInfo(
  filename: string
): Promise<BackgroundVideoInfo | null> {
  const filePath = path.join(BACKGROUNDS_DIR, filename);
  const stats = await stat(filePath);
  const cached = cache.get(filename);
  if (cached && cached.mtimeMs === stats.mtimeMs) {
    return cached.info;
  }

  const { durationInSeconds, dimensions } = await parseMedia({
    src: filePath,
    reader: nodeReader,
    fields: { durationInSeconds: true, dimensions: true },
  });

  if (durationInSeconds === null || !dimensions) return null;

  const info: BackgroundVideoInfo = {
    id: filename,
    name: filename.replace(/\.[^.]+$/, ""),
    url: `/backgrounds/${filename}`,
    durationSec: durationInSeconds,
    width: dimensions.width,
    height: dimensions.height,
  };
  cache.set(filename, { mtimeMs: stats.mtimeMs, info });
  return info;
}

export async function listBackgroundVideos(): Promise<BackgroundVideoInfo[]> {
  let filenames: string[];
  try {
    filenames = await readdir(BACKGROUNDS_DIR);
  } catch {
    // папки ещё нет — фонов пока никто не загрузил
    return [];
  }

  const candidates = filenames.filter((f) =>
    ALLOWED_EXTENSIONS.has(path.extname(f).toLowerCase())
  );
  const results = await Promise.all(
    candidates.map((f) => readBackgroundInfo(f).catch(() => null))
  );
  return results.filter((r): r is BackgroundVideoInfo => r !== null);
}

export class BackgroundUploadError extends Error {}

export async function saveBackgroundUpload(
  file: File
): Promise<BackgroundVideoInfo> {
  const ext = path.extname(file.name).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new BackgroundUploadError("Поддерживаются только файлы .mp4 и .mov");
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new BackgroundUploadError(
      `Файл больше ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`
    );
  }

  await mkdir(BACKGROUNDS_DIR, { recursive: true });

  const safeName = file.name
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Zа-яА-Я0-9_-]+/g, "-")
    .slice(0, 60);
  const filename = `${safeName || "background"}-${randomUUID().slice(0, 8)}${ext}`;
  const filePath = path.join(BACKGROUNDS_DIR, filename);

  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(filePath, buffer);

  const info = await readBackgroundInfo(filename);
  if (!info) {
    throw new BackgroundUploadError(
      "Не удалось прочитать видео — возможно, файл повреждён"
    );
  }
  return info;
}
