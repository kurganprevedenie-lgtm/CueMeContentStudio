import { randomUUID } from "node:crypto";

import {
  YouTubeApiError,
  YouTubeNotConnectedError,
  uploadVideo,
  type YouTubePrivacyStatus,
} from "./youtubeApi";

export type YouTubeJobPhase = "uploading" | "done" | "error";

export interface YouTubePublishJob {
  id: string;
  phase: YouTubeJobPhase;
  /** 0..1, актуален только пока phase === "uploading" */
  uploadProgress: number;
  videoId?: string;
  url?: string;
  /** Наша собственная ошибка (не удалось подключиться/загрузить) */
  error?: string;
  /** "not_connected" — UI должен предложить переподключить YouTube, а не просто показать текст ошибки */
  errorKind?: "not_connected" | "api" | "other";
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
  title: string;
  description: string;
  privacyStatus: YouTubePrivacyStatus;
}

/**
 * Запускает публикацию в фоне (как startTikTokPublish в tiktokJobs.ts) —
 * заливка файла может занять время, запрос от клиента не ждёт этого, а
 * получает id задачи и опрашивает статус отдельно. В отличие от TikTok,
 * YouTube отдаёт videoId сразу по завершении PUT — отдельного шага
 * проверки статуса на стороне YouTube не нужно, фаза "polling" не нужна.
 */
export function startYouTubePublish(
  input: StartYouTubePublishInput
): YouTubePublishJob {
  const job: YouTubePublishJob = {
    id: randomUUID(),
    phase: "uploading",
    uploadProgress: 0,
  };
  jobs.set(job.id, job);

  void runUpload(job, input);

  return job;
}

async function runUpload(job: YouTubePublishJob, input: StartYouTubePublishInput) {
  try {
    const { videoId, url } = await uploadVideo(
      {
        filePath: input.filePath,
        title: input.title,
        description: input.description,
        privacyStatus: input.privacyStatus,
      },
      (progress) => {
        job.uploadProgress = progress.uploadedBytes / progress.totalBytes;
      }
    );
    job.videoId = videoId;
    job.url = url;
    job.phase = "done";
  } catch (e: unknown) {
    job.phase = "error";
    if (e instanceof YouTubeNotConnectedError) {
      job.errorKind = "not_connected";
      job.error = e.message;
    } else if (e instanceof YouTubeApiError) {
      job.errorKind = "api";
      job.error = e.message;
    } else {
      job.errorKind = "other";
      job.error = e instanceof Error ? e.message : String(e);
    }
  }
}
