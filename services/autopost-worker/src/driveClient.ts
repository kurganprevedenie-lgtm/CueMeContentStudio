import { createWriteStream } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";

import { google } from "googleapis";
import type { drive_v3 } from "googleapis";

import { config } from "./config.js";

let driveClient: drive_v3.Drive | null = null;

/**
 * Service account — единственный вариант для процесса без браузера/
 * интерактивного логина (в отличие от TikTok/YouTube/Instagram, у Google
 * Drive API это штатный сценарий). Папку на Drive нужно один раз расшарить
 * с client_email из service-account.json (см. AUTOPOST_WORKER_SETUP.md) —
 * у сервисного аккаунта нет своего Drive, доступ есть только к тому, что
 * ему явно открыли.
 */
function getDrive(): drive_v3.Drive {
  if (driveClient) return driveClient;
  const auth = new google.auth.GoogleAuth({
    keyFile: config.driveServiceAccountKeyPath,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  driveClient = google.drive({ version: "v3", auth });
  return driveClient;
}

export interface DriveVideoFile {
  id: string;
  name: string;
  createdTime: string;
}

/**
 * Список видео прямо в целевой папке (не рекурсивно, "posted" — отдельная
 * подпапка и в этот список не попадает). Сортировка по createdTime — так
 * порядок появления в очереди (FIFO) соответствует реальному порядку
 * заливки в Drive, а не порядку ответа API.
 */
export async function listVideosInFolder(): Promise<DriveVideoFile[]> {
  const drive = getDrive();
  const res = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and mimeType contains 'video/' and trashed = false`,
    fields: "files(id, name, createdTime)",
    orderBy: "createdTime",
    pageSize: 100,
  });
  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name ?? f.id!,
    createdTime: f.createdTime ?? new Date().toISOString(),
  }));
}

export async function downloadFile(
  fileId: string,
  destPath: string
): Promise<void> {
  const drive = getDrive();
  await mkdir(path.dirname(destPath), { recursive: true });
  const res = await drive.files.get(
    { fileId, alt: "media" },
    { responseType: "stream" }
  );
  await pipeline(res.data, createWriteStream(destPath));
}

let postedFolderIdCache: string | null = null;

/** Подпапка "posted" внутри целевой папки — создаётся при первом запуске, если её ещё нет */
async function getOrCreatePostedFolderId(): Promise<string> {
  if (postedFolderIdCache) return postedFolderIdCache;
  const drive = getDrive();
  const existing = await drive.files.list({
    q: `'${config.driveFolderId}' in parents and name = 'posted' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
  });
  const found = existing.data.files?.[0]?.id;
  if (found) {
    postedFolderIdCache = found;
    return found;
  }
  const created = await drive.files.create({
    requestBody: {
      name: "posted",
      mimeType: "application/vnd.google-apps.folder",
      parents: [config.driveFolderId],
    },
    fields: "id",
  });
  postedFolderIdCache = created.data.id!;
  return postedFolderIdCache;
}

/** Перемещает файл из целевой папки в её подпапку "posted" — защита от повторной публикации при рестарте */
export async function moveFileToPosted(fileId: string): Promise<void> {
  const drive = getDrive();
  const postedFolderId = await getOrCreatePostedFolderId();
  await drive.files.update({
    fileId,
    addParents: postedFolderId,
    removeParents: config.driveFolderId,
    fields: "id, parents",
  });
}

/**
 * Instagram Content Publishing API не принимает байты напрямую — Meta сама
 * скачивает видео по video_url (см. packages/publish-clients/src/instagramApi.ts).
 * Вместо того чтобы поднимать собственный HTTP-сервер на воркере только ради
 * этого одного запроса, делаем сам файл в Drive временно доступным по прямой
 * ссылке ("anyone with the link") — этого достаточно, чтобы Meta его забрала.
 * Право доступа не отзываем: после публикации видео и так уже публично на
 * площадке, дополнительной приватности это не даёт.
 */
export async function makeFilePublicAndGetDirectLink(
  fileId: string
): Promise<string> {
  const drive = getDrive();
  await drive.permissions.create({
    fileId,
    requestBody: { role: "reader", type: "anyone" },
  });
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}
