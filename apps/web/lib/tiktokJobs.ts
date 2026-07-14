import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";

import {
  MAX_VIDEO_BYTES,
  TikTokApiError,
  TikTokNotConnectedError,
  fetchPublishStatus,
  getValidAccessToken,
  initDraftUpload,
  uploadVideoChunks,
  type TikTokPublishStatus,
} from "./tiktokApi";

export type TikTokJobPhase = "uploading" | "polling" | "done" | "error";

export interface TikTokPublishJob {
  id: string;
  phase: TikTokJobPhase;
  /** 0..1, актуален только пока phase === "uploading" */
  uploadProgress: number;
  publishId?: string;
  tiktokStatus?: TikTokPublishStatus;
  /** Причина от TikTok, если tiktokStatus === "FAILED" — показываем как есть, не generic-текст */
  failReason?: string;
  /** Наша собственная ошибка (не удалось подключиться/загрузить), не статус TikTok */
  error?: string;
  /** "not_connected" — UI должен предложить переподключить TikTok, а не просто показать текст ошибки */
  errorKind?: "not_connected" | "api" | "other";
  lastPolledAt: number;
}

// Тот же паттерн, что в renderJobs.ts/backgrounds.ts — globalThis, чтобы
// состояние было одно на процесс даже если Turbopack в dev соберёт разные
// API-роуты как отдельные экземпляры модуля.
declare global {
  var __cuemeTikTokJobs: Map<string, TikTokPublishJob> | undefined;
}
const jobs = globalThis.__cuemeTikTokJobs ?? new Map<string, TikTokPublishJob>();
globalThis.__cuemeTikTokJobs = jobs;

export function getTikTokJob(id: string): TikTokPublishJob | undefined {
  return jobs.get(id);
}

export class VideoTooLargeError extends Error {}

/**
 * Запускает публикацию черновика в фоне (как startRender в renderJobs.ts) —
 * само чтение/заливка файла может занять время, запрос от клиента не ждёт
 * этого, а получает id задачи и опрашивает статус отдельно.
 */
export async function startTikTokPublish(
  filePath: string
): Promise<TikTokPublishJob> {
  const { size } = await stat(filePath);
  if (size > MAX_VIDEO_BYTES) {
    throw new VideoTooLargeError(
      `Видео весит больше ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024 * 1024))}GB — лимит TikTok`
    );
  }

  const job: TikTokPublishJob = {
    id: randomUUID(),
    phase: "uploading",
    uploadProgress: 0,
    lastPolledAt: 0,
  };
  jobs.set(job.id, job);

  void runUpload(job, filePath, size);

  return job;
}

async function runUpload(job: TikTokPublishJob, filePath: string, size: number) {
  try {
    const accessToken = await getValidAccessToken();
    const { publishId, uploadUrl } = await initDraftUpload(accessToken, size);
    job.publishId = publishId;

    await uploadVideoChunks(uploadUrl, filePath, size, (progress) => {
      job.uploadProgress = progress.uploadedBytes / progress.totalBytes;
    });

    job.phase = "polling";
    job.lastPolledAt = Date.now();
    // первый статус сразу после загрузки — не ждём следующего опроса от клиента
    const { status, failReason } = await fetchPublishStatus(accessToken, publishId);
    applyStatus(job, status, failReason);
  } catch (e: unknown) {
    job.phase = "error";
    if (e instanceof TikTokNotConnectedError) {
      job.errorKind = "not_connected";
      job.error = e.message;
    } else if (e instanceof TikTokApiError || e instanceof VideoTooLargeError) {
      job.errorKind = "api";
      job.error = e.message;
    } else {
      job.errorKind = "other";
      job.error = describeError(e);
    }
  }
}

/**
 * Node оборачивает низкоуровневые сбои сети в общий "fetch failed", пряча
 * настоящую причину (DNS/таймаут/TLS) в поле cause — разворачиваем цепочку
 * cause, иначе пользователь видит бесполезное "fetch failed". Токенов в
 * сетевых ошибках нет, показывать безопасно.
 */
function describeError(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  const parts: string[] = [e.message];
  let cause: unknown = (e as { cause?: unknown }).cause;
  let guard = 0;
  while (cause instanceof Error && guard < 5) {
    parts.push(cause.message);
    cause = (cause as { cause?: unknown }).cause;
    guard++;
  }
  return parts.join(": ");
}

function applyStatus(
  job: TikTokPublishJob,
  status: TikTokPublishStatus,
  failReason?: string
) {
  job.tiktokStatus = status;
  if (status === "FAILED") {
    job.phase = "error";
    job.errorKind = "api";
    job.failReason = failReason || "TikTok не уточнил причину ошибки";
  } else if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
    job.phase = "done";
  }
}

const MIN_POLL_INTERVAL_MS = 2000;

/**
 * Вызывается из GET-роута статуса — если с прошлого опроса TikTok прошло
 * достаточно времени, спрашиваем реальный статус ещё раз, иначе отдаём
 * закэшированный job как есть (чтобы частые запросы от клиента не долбили
 * TikTok API и не упирались в rate limit).
 */
export async function refreshTikTokJobIfDue(
  job: TikTokPublishJob
): Promise<TikTokPublishJob> {
  if (job.phase !== "polling") return job;
  if (Date.now() - job.lastPolledAt < MIN_POLL_INTERVAL_MS) return job;
  if (!job.publishId) return job;

  job.lastPolledAt = Date.now();
  try {
    const accessToken = await getValidAccessToken();
    const { status, failReason } = await fetchPublishStatus(
      accessToken,
      job.publishId
    );
    applyStatus(job, status, failReason);
  } catch {
    // сбой самого опроса статуса (сеть/токен) — не считаем это FAILED
    // публикации, просто отдаём предыдущее состояние, следующий опрос
    // от клиента попробует снова
  }
  return job;
}
