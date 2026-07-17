import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";

import {
  INTER_ACCOUNT_PUBLISH_PAUSE_MS,
  MAX_VIDEO_BYTES,
  TikTokApiError,
  TikTokNotConnectedError,
  fetchPublishStatus,
  getValidTikTokAccessToken as getValidAccessToken,
  initDraftUpload,
  uploadVideoChunks,
  type TikTokPublishStatus,
} from "@cueme/publish-clients";

export type TikTokJobPhase = "uploading" | "polling" | "done" | "error";

/** Статус публикации на ОДИН из выбранных аккаунтов — job теперь ведёт список таких состояний, не одно */
export interface TikTokAccountPublishState {
  accountId: string;
  phase: TikTokJobPhase;
  /** 0..1, актуален только пока phase === "uploading" */
  uploadProgress: number;
  publishId?: string;
  tiktokStatus?: TikTokPublishStatus;
  /** Причина от TikTok, если tiktokStatus === "FAILED" — показываем как есть, не generic-текст */
  failReason?: string;
  /** Наша собственная ошибка (не удалось подключиться/загрузить), не статус TikTok */
  error?: string;
  /** "not_connected" — UI должен предложить переподключить этот аккаунт, а не просто показать текст ошибки */
  errorKind?: "not_connected" | "api" | "other";
  lastPolledAt: number;
}

export interface TikTokPublishJob {
  id: string;
  accounts: TikTokAccountPublishState[];
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Запускает публикацию черновика в фоне (как startRender в renderJobs.ts) на
 * все выбранные аккаунты — сама заливка может занять время, запрос от
 * клиента не ждёт этого, а получает id задачи и опрашивает статус отдельно.
 */
export async function startTikTokPublish(
  filePath: string,
  accountIds: string[],
  caption?: string
): Promise<TikTokPublishJob> {
  const { size } = await stat(filePath);
  if (size > MAX_VIDEO_BYTES) {
    throw new VideoTooLargeError(
      `Видео весит больше ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024 * 1024))}GB — лимит TikTok`
    );
  }

  const job: TikTokPublishJob = {
    id: randomUUID(),
    accounts: accountIds.map((accountId) => ({
      accountId,
      phase: "uploading",
      uploadProgress: 0,
      lastPolledAt: 0,
    })),
  };
  jobs.set(job.id, job);

  void runSequential(job, filePath, size, caption);

  return job;
}

/**
 * Публикует на все выбранные аккаунты ПОСЛЕДОВАТЕЛЬНО (не Promise.all), с
 * паузой INTER_ACCOUNT_PUBLISH_PAUSE_MS между ними — защита от анти-спам
 * ограничений TikTok (spam_risk_too_many_pending_share и подобных) при
 * частых заливках подряд с одного приложения.
 */
async function runSequential(
  job: TikTokPublishJob,
  filePath: string,
  size: number,
  caption?: string
) {
  for (let i = 0; i < job.accounts.length; i++) {
    if (i > 0) await sleep(INTER_ACCOUNT_PUBLISH_PAUSE_MS);
    await runUploadForAccount(job.accounts[i], filePath, size, caption);
  }
}

async function runUploadForAccount(
  account: TikTokAccountPublishState,
  filePath: string,
  size: number,
  caption?: string
) {
  try {
    const accessToken = await getValidAccessToken(account.accountId);
    const { publishId, uploadUrl } = await initDraftUpload(accessToken, size, caption);
    account.publishId = publishId;

    await uploadVideoChunks(uploadUrl, filePath, size, (progress) => {
      account.uploadProgress = progress.uploadedBytes / progress.totalBytes;
    });

    account.phase = "polling";
    account.lastPolledAt = Date.now();
    // первый статус сразу после загрузки — не ждём следующего опроса от клиента
    const { status, failReason } = await fetchPublishStatus(accessToken, publishId);
    applyStatus(account, status, failReason);
  } catch (e: unknown) {
    account.phase = "error";
    if (e instanceof TikTokNotConnectedError) {
      account.errorKind = "not_connected";
      account.error = e.message;
    } else if (e instanceof TikTokApiError || e instanceof VideoTooLargeError) {
      account.errorKind = "api";
      account.error = e.message;
    } else {
      account.errorKind = "other";
      account.error = describeError(e);
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
  account: TikTokAccountPublishState,
  status: TikTokPublishStatus,
  failReason?: string
) {
  account.tiktokStatus = status;
  if (status === "FAILED") {
    account.phase = "error";
    account.errorKind = "api";
    account.failReason = failReason || "TikTok не уточнил причину ошибки";
  } else if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
    account.phase = "done";
  }
}

const MIN_POLL_INTERVAL_MS = 2000;

/**
 * Вызывается из GET-роута статуса — опрашивает TikTok заново для каждого
 * аккаунта job'а, у которого пришло время (если с прошлого опроса прошло
 * достаточно), иначе отдаёт закэшированное состояние — чтобы частые запросы
 * от клиента не долбили TikTok API и не упирались в rate limit.
 */
export async function refreshTikTokJobIfDue(
  job: TikTokPublishJob
): Promise<TikTokPublishJob> {
  await Promise.all(job.accounts.map((account) => refreshAccountIfDue(account)));
  return job;
}

async function refreshAccountIfDue(account: TikTokAccountPublishState): Promise<void> {
  if (account.phase !== "polling") return;
  if (Date.now() - account.lastPolledAt < MIN_POLL_INTERVAL_MS) return;
  if (!account.publishId) return;

  account.lastPolledAt = Date.now();
  try {
    const accessToken = await getValidAccessToken(account.accountId);
    const { status, failReason } = await fetchPublishStatus(
      accessToken,
      account.publishId
    );
    applyStatus(account, status, failReason);
  } catch {
    // сбой самого опроса статуса (сеть/токен) — не считаем это FAILED
    // публикации, просто отдаём предыдущее состояние, следующий опрос
    // от клиента попробует снова
  }
}
