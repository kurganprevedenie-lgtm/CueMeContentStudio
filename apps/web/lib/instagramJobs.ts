import { randomUUID } from "node:crypto";

import {
  InstagramApiError,
  InstagramNotConnectedError,
  createReelsContainer,
  fetchContainerStatus,
  fetchPermalink,
  getValidAccount,
  publishContainer,
} from "./instagramApi";

export type InstagramJobPhase =
  | "creating"
  | "processing"
  | "publishing"
  | "done"
  | "error";

export interface InstagramPublishJob {
  id: string;
  phase: InstagramJobPhase;
  containerId?: string;
  mediaId?: string;
  url?: string;
  /** Наша собственная ошибка (не удалось подключиться/создать контейнер) */
  error?: string;
  /** "not_connected" — UI должен предложить переподключить Instagram, а не просто показать текст ошибки */
  errorKind?: "not_connected" | "api" | "other";
  lastPolledAt: number;
}

// Тот же паттерн, что в tiktokJobs.ts/youtubeJobs.ts — globalThis, чтобы
// состояние было одно на процесс даже если Turbopack в dev соберёт разные
// API-роуты как отдельные экземпляры модуля.
declare global {
  var __cuemeInstagramJobs: Map<string, InstagramPublishJob> | undefined;
}
const jobs =
  globalThis.__cuemeInstagramJobs ?? new Map<string, InstagramPublishJob>();
globalThis.__cuemeInstagramJobs = jobs;

export function getInstagramJob(id: string): InstagramPublishJob | undefined {
  return jobs.get(id);
}

export interface StartInstagramPublishInput {
  videoUrl: string;
  caption: string;
}

/**
 * Запускает публикацию в фоне (как startTikTokPublish в tiktokJobs.ts) —
 * создание контейнера и ожидание, пока Meta сама скачает видео по videoUrl,
 * может занять время, запрос от клиента не ждёт этого целиком.
 */
export function startInstagramPublish(
  input: StartInstagramPublishInput
): InstagramPublishJob {
  const job: InstagramPublishJob = {
    id: randomUUID(),
    phase: "creating",
    lastPolledAt: 0,
  };
  jobs.set(job.id, job);

  void runCreate(job, input);

  return job;
}

async function runCreate(
  job: InstagramPublishJob,
  input: StartInstagramPublishInput
) {
  try {
    const { pageAccessToken, igUserId } = await getValidAccount();
    const { containerId } = await createReelsContainer(
      pageAccessToken,
      igUserId,
      input.videoUrl,
      input.caption
    );
    job.containerId = containerId;
    job.phase = "processing";
    job.lastPolledAt = Date.now();
    // первая проверка статуса сразу после создания — не ждём следующего
    // опроса от клиента
    await advanceJob(job, pageAccessToken, igUserId);
  } catch (e: unknown) {
    applyError(job, e);
  }
}

function applyError(job: InstagramPublishJob, e: unknown) {
  job.phase = "error";
  if (e instanceof InstagramNotConnectedError) {
    job.errorKind = "not_connected";
    job.error = e.message;
  } else if (e instanceof InstagramApiError) {
    job.errorKind = "api";
    job.error = e.message;
  } else {
    job.errorKind = "other";
    job.error = e instanceof Error ? e.message : String(e);
  }
}

/**
 * Проверяет статус контейнера и, как только Meta закончила его обработку
 * (status_code === "FINISHED"), сразу публикует и получает ссылку — в один
 * связанный шаг, а не отдельным действием пользователя.
 */
async function advanceJob(
  job: InstagramPublishJob,
  pageAccessToken: string,
  igUserId: string
) {
  if (!job.containerId) return;
  const { statusCode, statusDetail } = await fetchContainerStatus(
    pageAccessToken,
    job.containerId
  );

  if (statusCode === "ERROR" || statusCode === "EXPIRED") {
    job.phase = "error";
    job.errorKind = "api";
    job.error = statusDetail || `Instagram не смог обработать видео (${statusCode})`;
    return;
  }
  if (statusCode === "IN_PROGRESS") {
    // остаёмся в processing — следующий опрос от клиента попробует снова
    return;
  }

  // FINISHED или уже PUBLISHED — публикуем и получаем ссылку
  job.phase = "publishing";
  const { mediaId } = await publishContainer(
    pageAccessToken,
    igUserId,
    job.containerId
  );
  job.mediaId = mediaId;
  job.url = await fetchPermalink(pageAccessToken, mediaId);
  job.phase = "done";
}

const MIN_POLL_INTERVAL_MS = 3000;

/**
 * Вызывается из GET-роута статуса — если с прошлого опроса прошло
 * достаточно времени, спрашиваем реальный статус контейнера ещё раз, иначе
 * отдаём закэшированный job как есть (тот же паттерн, что
 * refreshTikTokJobIfDue в tiktokJobs.ts).
 */
export async function refreshInstagramJobIfDue(
  job: InstagramPublishJob
): Promise<InstagramPublishJob> {
  if (job.phase !== "processing") return job;
  if (Date.now() - job.lastPolledAt < MIN_POLL_INTERVAL_MS) return job;

  job.lastPolledAt = Date.now();
  try {
    const { pageAccessToken, igUserId } = await getValidAccount();
    await advanceJob(job, pageAccessToken, igUserId);
  } catch (e: unknown) {
    // сбой самого опроса (сеть/токен) — не считаем это ошибкой публикации,
    // просто отдаём предыдущее состояние, следующий опрос попробует снова
    if (e instanceof InstagramNotConnectedError) {
      applyError(job, e);
    }
  }
  return job;
}
