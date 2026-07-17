import { rm, stat } from "node:fs/promises";
import path from "node:path";

import {
  INTER_ACCOUNT_PUBLISH_PAUSE_MS,
  MAX_VIDEO_BYTES,
  createReelsContainer,
  fetchContainerStatus,
  fetchPermalink,
  fetchPublishStatus,
  getTikTokPublishMode,
  getValidInstagramAccount,
  getValidTikTokAccessToken,
  getValidYouTubeAccessToken,
  initDraftUpload,
  publishContainer,
  uploadToYouTube,
  uploadVideoChunks,
} from "@cueme/publish-clients";

import { config } from "./config.js";
import { downloadFile, makeFilePublicAndGetDirectLink } from "./driveClient.js";
import type { QueuedVideo } from "./state.js";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** {filename} → имя файла в Drive без расширения (см. WORKER_CAPTION_TEMPLATE в .env) */
function resolveCaption(name: string): string {
  const base = name.replace(/\.[^/.]+$/, "");
  return config.captionTemplate.replace("{filename}", base);
}

async function downloadToTemp(video: QueuedVideo): Promise<string> {
  const destPath = path.join(config.tempDir, `${video.driveFileId}.mp4`);
  await downloadFile(video.driveFileId, destPath);
  return destPath;
}

export interface PublishResult {
  platform: "tiktok" | "youtube" | "instagram";
  /** Мультиаккаунт (tiktok/youtube) — на какой именно из выбранных аккаунтов ушла эта попытка */
  accountId?: string;
  ok: boolean;
  detail: string;
}

const TIKTOK_POLL_INTERVAL_MS = 3000;
const TIKTOK_MAX_POLLS = 30;

async function publishToTikTok(
  filePath: string,
  accountId: string,
  caption: string
): Promise<PublishResult> {
  try {
    const { size } = await stat(filePath);
    if (size > MAX_VIDEO_BYTES) {
      throw new Error(
        `видео больше лимита TikTok (${Math.round(MAX_VIDEO_BYTES / 1024 / 1024 / 1024)}GB)`
      );
    }
    const accessToken = await getValidTikTokAccessToken(accountId);
    const mode = getTikTokPublishMode();
    const { publishId, uploadUrl } = await initDraftUpload(
      accessToken,
      size,
      mode === "direct" ? caption : undefined
    );
    await uploadVideoChunks(uploadUrl, filePath, size);

    for (let attempt = 0; attempt < TIKTOK_MAX_POLLS; attempt++) {
      await sleep(TIKTOK_POLL_INTERVAL_MS);
      const { status, failReason } = await fetchPublishStatus(
        accessToken,
        publishId
      );
      if (status === "FAILED") {
        throw new Error(failReason ?? "TikTok сообщил об ошибке без деталей");
      }
      if (status === "PUBLISH_COMPLETE" || status === "SEND_TO_USER_INBOX") {
        return {
          platform: "tiktok",
          accountId,
          ok: true,
          detail: `статус: ${status}`,
        };
      }
    }
    return {
      platform: "tiktok",
      accountId,
      ok: true,
      detail:
        "видео загружено, но финальный статус не дождались за отведённое время — проверьте в приложении TikTok",
    };
  } catch (e: unknown) {
    return {
      platform: "tiktok",
      accountId,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

async function publishToYouTubePlatform(
  filePath: string,
  accountId: string,
  caption: string
): Promise<PublishResult> {
  try {
    // YouTube: заголовок ограничен 100 символами, описание — без ограничения шаблона
    const { url } = await uploadToYouTube({
      accountId,
      filePath,
      title: caption.slice(0, 100),
      description: caption,
      privacyStatus: config.youtubePrivacyStatus,
    });
    return { platform: "youtube", accountId, ok: true, detail: url };
  } catch (e: unknown) {
    return {
      platform: "youtube",
      accountId,
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

const INSTAGRAM_POLL_INTERVAL_MS = 5000;
const INSTAGRAM_MAX_POLLS = 40;

async function publishToInstagramPlatform(
  driveFileId: string,
  caption: string
): Promise<PublishResult> {
  try {
    const { pageAccessToken, igUserId } = await getValidInstagramAccount();
    const videoUrl = await makeFilePublicAndGetDirectLink(driveFileId);
    const { containerId } = await createReelsContainer(
      pageAccessToken,
      igUserId,
      videoUrl,
      caption
    );

    for (let attempt = 0; attempt < INSTAGRAM_MAX_POLLS; attempt++) {
      await sleep(INSTAGRAM_POLL_INTERVAL_MS);
      const { statusCode, statusDetail } = await fetchContainerStatus(
        pageAccessToken,
        containerId
      );
      if (statusCode === "ERROR" || statusCode === "EXPIRED") {
        throw new Error(statusDetail || `Instagram: контейнер ${statusCode}`);
      }
      if (statusCode === "FINISHED" || statusCode === "PUBLISHED") {
        const { mediaId } = await publishContainer(
          pageAccessToken,
          igUserId,
          containerId
        );
        const url = await fetchPermalink(pageAccessToken, mediaId);
        return { platform: "instagram", ok: true, detail: url };
      }
    }
    return {
      platform: "instagram",
      ok: false,
      detail: "Meta не обработала видео за отведённое время ожидания",
    };
  } catch (e: unknown) {
    return {
      platform: "instagram",
      ok: false,
      detail: e instanceof Error ? e.message : String(e),
    };
  }
}

/**
 * Публикует одно видео на все включённые площадки (ENABLE_TIKTOK/YOUTUBE/
 * INSTAGRAM в .env) — мультиаккаунт: на каждой из TikTok/YouTube проходит
 * ПОСЛЕДОВАТЕЛЬНО (не параллельно) по всем video.accountIds.{tiktok,youtube}
 * (проставлены при добавлении в очередь, см. index.ts/pollDrive), с паузой
 * INTER_ACCOUNT_PUBLISH_PAUSE_MS между аккаунтами одной платформы — та же
 * защита от анти-спам ограничений, что и в apps/web (lib/tiktokJobs.ts).
 * Ошибка одного аккаунта не останавливает остальные — каждый аккаунт
 * возвращает свой PublishResult, вызывающий код (index.ts) логирует все и
 * решает, считать ли видео обработанным. Instagram — не мультиаккаунт (не
 * трогаем эту интеграцию), публикуется как раньше, одним вызовом.
 *
 * Файл скачивается на диск только если нужен TikTok/YouTube (обеим нужны
 * реальные байты) — Instagram использует прямую ссылку на файл в Drive (см.
 * driveClient.ts), локальная копия ему не нужна. Временный файл удаляется
 * сразу после использования всеми аккаунтами, не раньше.
 */
export async function publishVideo(
  video: QueuedVideo
): Promise<PublishResult[]> {
  const results: PublishResult[] = [];
  const caption = resolveCaption(video.name);
  // Видео, попавшие в очередь ДО появления мультиаккаунта (со старого кода),
  // не имеют этого поля вообще — а не просто пустые массивы. Без дефолта
  // здесь `.tiktok`/`.youtube` упадёт с TypeError на undefined и публикация
  // будет проваливаться заново на каждый следующий слот расписания.
  const tiktokIds = video.accountIds?.tiktok ?? [];
  const youtubeIds = video.accountIds?.youtube ?? [];
  const needsLocalFile = tiktokIds.length > 0 || youtubeIds.length > 0;
  let tempFilePath: string | null = null;

  try {
    if (needsLocalFile) {
      tempFilePath = await downloadToTemp(video);
    }
    if (tempFilePath) {
      for (let i = 0; i < tiktokIds.length; i++) {
        if (i > 0) await sleep(INTER_ACCOUNT_PUBLISH_PAUSE_MS);
        results.push(await publishToTikTok(tempFilePath, tiktokIds[i], caption));
      }
      for (let i = 0; i < youtubeIds.length; i++) {
        if (i > 0) await sleep(INTER_ACCOUNT_PUBLISH_PAUSE_MS);
        results.push(
          await publishToYouTubePlatform(tempFilePath, youtubeIds[i], caption)
        );
      }
    }
    if (config.enableInstagram) {
      results.push(await publishToInstagramPlatform(video.driveFileId, caption));
    }
  } finally {
    if (tempFilePath) {
      await rm(tempFilePath, { force: true }).catch(() => {});
    }
  }

  return results;
}
