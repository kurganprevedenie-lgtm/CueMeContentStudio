import { randomUUID } from "node:crypto";

import {
  INTER_ACCOUNT_PUBLISH_PAUSE_MS,
  YouTubeApiError,
  YouTubeNotConnectedError,
  uploadToYouTube as uploadVideo,
  type YouTubePrivacyStatus,
} from "@cueme/publish-clients";

export type YouTubeJobPhase = "uploading" | "done" | "error";

/** Статус публикации на ОДИН из выбранных аккаунтов — job теперь ведёт список таких состояний, не одно */
export interface YouTubeAccountPublishState {
  accountId: string;
  phase: YouTubeJobPhase;
  /** 0..1, актуален только пока phase === "uploading" */
  uploadProgress: number;
  videoId?: string;
  url?: string;
  /** Наша собственная ошибка (не удалось подключиться/загрузить) */
  error?: string;
  /** "not_connected" — UI должен предложить переподключить этот аккаунт, а не просто показать текст ошибки */
  errorKind?: "not_connected" | "api" | "other";
}

export interface YouTubePublishJob {
  id: string;
  accounts: YouTubeAccountPublishState[];
}

// Тот же паттерн, что в renderJobs.ts/tiktokJobs.ts — globalThis, чтобы
// состояние было одно на процесс даже если Turbopack в dev соберёт разные
// API-роуты как отдельные экземпляры модуля.
declare global {
  var __cuemeYouTubeJobs: Map<string, YouTubePublishJob> | undefined;
}
const jobs = globalThis.__cuemeYouTubeJobs ?? new Map<string, YouTubePublishJob>();
globalThis.__cuemeYouTubeJobs = jobs;

export function getYouTubeJob(id: string): YouTubePublishJob | undefined {
  return jobs.get(id);
}

export interface StartYouTubePublishInput {
  filePath: string;
  accountIds: string[];
  title: string;
  description: string;
  privacyStatus: YouTubePrivacyStatus;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Запускает публикацию в фоне (как startTikTokPublish в tiktokJobs.ts) на
 * все выбранные аккаунты — заливка файла может занять время, запрос от
 * клиента не ждёт этого, а получает id задачи и опрашивает статус отдельно.
 * В отличие от TikTok, YouTube отдаёт videoId сразу по завершении PUT —
 * отдельного шага проверки статуса на стороне YouTube не нужно, фаза
 * "polling" не нужна.
 */
export function startYouTubePublish(
  input: StartYouTubePublishInput
): YouTubePublishJob {
  const job: YouTubePublishJob = {
    id: randomUUID(),
    accounts: input.accountIds.map((accountId) => ({
      accountId,
      phase: "uploading",
      uploadProgress: 0,
    })),
  };
  jobs.set(job.id, job);

  void runSequential(job, input);

  return job;
}

/**
 * Публикует на все выбранные аккаунты ПОСЛЕДОВАТЕЛЬНО (не Promise.all), с
 * той же паузой между аккаунтами, что и у TikTok (см. tiktokJobs.ts) — не
 * заливать несколько видео на разные аккаунты одновременно с одного
 * приложения.
 */
async function runSequential(
  job: YouTubePublishJob,
  input: StartYouTubePublishInput
) {
  for (let i = 0; i < job.accounts.length; i++) {
    if (i > 0) await sleep(INTER_ACCOUNT_PUBLISH_PAUSE_MS);
    await runUploadForAccount(job.accounts[i], input);
  }
}

async function runUploadForAccount(
  account: YouTubeAccountPublishState,
  input: StartYouTubePublishInput
) {
  try {
    const { videoId, url } = await uploadVideo(
      {
        accountId: account.accountId,
        filePath: input.filePath,
        title: input.title,
        description: input.description,
        privacyStatus: input.privacyStatus,
      },
      (progress) => {
        account.uploadProgress = progress.uploadedBytes / progress.totalBytes;
      }
    );
    account.videoId = videoId;
    account.url = url;
    account.phase = "done";
  } catch (e: unknown) {
    account.phase = "error";
    if (e instanceof YouTubeNotConnectedError) {
      account.errorKind = "not_connected";
      account.error = e.message;
    } else if (e instanceof YouTubeApiError) {
      account.errorKind = "api";
      account.error = e.message;
    } else {
      account.errorKind = "other";
      account.error = e instanceof Error ? e.message : String(e);
    }
  }
}
