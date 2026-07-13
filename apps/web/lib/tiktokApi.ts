import { open } from "node:fs/promises";

import {
  clearTikTokTokens,
  loadTikTokTokens,
  saveTikTokTokens,
  type TikTokTokens,
} from "./tiktokTokenStore";

// Эндпоинты TikTok Content Posting API v2 — на момент написания кода
// (см. developers.tiktok.com/doc/content-posting-api-get-started).
// Если TikTok поменяет пути, менять нужно только здесь.
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const INIT_URL = "https://open.tiktokapis.com/v2/post/publish/video/init/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

const SCOPE = "video.publish";

/** Приложение не подключено к TikTok (нет токенов) или подключение истекло */
export class TikTokNotConnectedError extends Error {}

/** Ошибка на стороне TikTok API — message уже содержит конкретную причину от TikTok, не generic-текст */
export class TikTokApiError extends Error {}

function getClientCredentials(): { clientKey: string; clientSecret: string } {
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  if (!clientKey || !clientSecret) {
    throw new Error(
      "TIKTOK_CLIENT_KEY / TIKTOK_CLIENT_SECRET не заданы — добавь их в .env"
    );
  }
  return { clientKey, clientSecret };
}

function getRedirectUri(): string {
  const uri = process.env.TIKTOK_REDIRECT_URI;
  if (!uri) {
    throw new Error("TIKTOK_REDIRECT_URI не задан — добавь его в .env");
  }
  return uri;
}

export function buildAuthorizeUrl(state: string): string {
  const { clientKey } = getClientCredentials();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("state", state);
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 20000;

/**
 * fetch с обработкой 429: TikTok рекомендует уважать Retry-After, если его
 * нет — экспоненциальная пауза. Ошибки токена/сети наверх не оборачиваем,
 * их обрабатывают вызывающие функции (там понятнее, что за операция).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 0
): Promise<Response> {
  const res = await fetch(url, init);
  if (res.status === 429 && attempt < MAX_RATE_LIMIT_RETRIES) {
    const retryAfterHeader = res.headers.get("retry-after");
    const retryAfterSec = retryAfterHeader ? Number(retryAfterHeader) : NaN;
    const waitMs = Number.isFinite(retryAfterSec)
      ? retryAfterSec * 1000
      : Math.min(
          RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt,
          RATE_LIMIT_MAX_DELAY_MS
        );
    await sleep(waitMs);
    return fetchWithRetry(url, init, attempt + 1);
  }
  return res;
}

interface RawTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function parseTokenResponse(res: Response): Promise<TikTokTokens> {
  // тело может содержать access/refresh token — в лог не пишем ни в
  // одной ветке, только в исключение (которое показывается пользователю,
  // не оседает в серверных логах автоматически)
  const body = (await res.json().catch(() => ({}))) as RawTokenResponse;
  if (!res.ok || !body.access_token || !body.refresh_token) {
    const reason = body.error_description || body.error || `HTTP ${res.status}`;
    throw new TikTokApiError(`TikTok OAuth: ${reason}`);
  }
  const now = Date.now();
  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    accessExpiresAt: now + (body.expires_in ?? 0) * 1000,
    refreshExpiresAt: now + (body.refresh_expires_in ?? 0) * 1000,
    openId: body.open_id ?? "",
    scope: body.scope ?? SCOPE,
  };
}

export async function exchangeCodeForTokens(code: string): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getClientCredentials();
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: getRedirectUri(),
    }),
  });
  return parseTokenResponse(res);
}

async function refreshTokens(refreshToken: string): Promise<TikTokTokens> {
  const { clientKey, clientSecret } = getClientCredentials();
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Cache-Control": "no-cache",
    },
    body: new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  return parseTokenResponse(res);
}

/** Обновляем заранее, не дожидаясь 401 — access_token живёт ~24ч, запас 5 минут с головой перекрывает время публикации */
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

export async function getValidAccessToken(): Promise<string> {
  const tokens = await loadTikTokTokens();
  if (!tokens) {
    throw new TikTokNotConnectedError("TikTok не подключён");
  }
  if (Date.now() < tokens.accessExpiresAt - ACCESS_TOKEN_REFRESH_MARGIN_MS) {
    return tokens.accessToken;
  }
  if (Date.now() >= tokens.refreshExpiresAt) {
    await clearTikTokTokens();
    throw new TikTokNotConnectedError(
      "Подключение к TikTok истекло — подключите аккаунт заново"
    );
  }
  const refreshed = await refreshTokens(tokens.refreshToken);
  await saveTikTokTokens(refreshed);
  return refreshed.accessToken;
}

export async function isTikTokConnected(): Promise<boolean> {
  const tokens = await loadTikTokTokens();
  if (!tokens) return false;
  return Date.now() < tokens.refreshExpiresAt;
}

// --- Content Posting API: инициализация + chunked upload + статус ---

const MIN_CHUNK_BYTES = 5 * 1024 * 1024;
const MAX_CHUNK_BYTES = 64 * 1024 * 1024;
const TARGET_CHUNK_BYTES = 10 * 1024 * 1024;
/** Официальный лимит TikTok на размер видео на момент написания кода */
export const MAX_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;

export interface ChunkPlan {
  chunkSize: number;
  totalChunkCount: number;
}

/**
 * Видео <= MAX_CHUNK_BYTES грузится одним чанком (chunk_size = весь файл).
 * Больше — режем на куски по ~TARGET_CHUNK_BYTES, следя, чтобы последний
 * кусок был не меньше MIN_CHUNK_BYTES (иначе TikTok отклонит init) —
 * при необходимости укрупняем чанки, а не оставляем "хвостик".
 */
export function planChunks(videoSize: number): ChunkPlan {
  if (videoSize <= MAX_CHUNK_BYTES) {
    return { chunkSize: videoSize, totalChunkCount: 1 };
  }
  let totalChunkCount = Math.ceil(videoSize / TARGET_CHUNK_BYTES);
  let chunkSize = Math.ceil(videoSize / totalChunkCount);
  while (
    totalChunkCount > 1 &&
    videoSize - chunkSize * (totalChunkCount - 1) < MIN_CHUNK_BYTES
  ) {
    totalChunkCount -= 1;
    chunkSize = Math.ceil(videoSize / totalChunkCount);
  }
  return { chunkSize, totalChunkCount };
}

interface InitResponseBody {
  data?: { publish_id?: string; upload_url?: string };
  error?: { code?: string; message?: string; log_id?: string };
}

/**
 * Шаг 1 — инициализация публикации черновика. privacy_level: SELF_ONLY —
 * единственный уровень, доступный приложениям без пройденного app review
 * (см. TikTok "Unaudited Client" ограничения) — контент виден только автору
 * в приложении TikTok, публичной публикации не происходит.
 */
export async function initDraftUpload(
  accessToken: string,
  videoSize: number,
  title: string
): Promise<{ publishId: string; uploadUrl: string }> {
  const { chunkSize, totalChunkCount } = planChunks(videoSize);
  const res = await fetchWithRetry(INIT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      post_info: {
        title,
        privacy_level: "SELF_ONLY",
      },
      source_info: {
        source: "FILE_UPLOAD",
        video_size: videoSize,
        chunk_size: chunkSize,
        total_chunk_count: totalChunkCount,
      },
    }),
  });
  const body = (await res.json().catch(() => ({}))) as InitResponseBody;
  const errorCode = body.error?.code;
  if (!res.ok || (errorCode && errorCode !== "ok") || !body.data?.publish_id || !body.data?.upload_url) {
    throw new TikTokApiError(
      body.error?.message || `TikTok init: HTTP ${res.status}`
    );
  }
  return { publishId: body.data.publish_id, uploadUrl: body.data.upload_url };
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

/**
 * Шаг 2 — заливка файла по upload_url кусками, ровно по Content-Range,
 * как требует TikTok (не через Authorization — upload_url уже подписан).
 */
export async function uploadVideoChunks(
  uploadUrl: string,
  filePath: string,
  videoSize: number,
  onProgress?: (progress: UploadProgress) => void
): Promise<void> {
  const { chunkSize, totalChunkCount } = planChunks(videoSize);
  const handle = await open(filePath, "r");
  try {
    for (let index = 0; index < totalChunkCount; index++) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, videoSize) - 1;
      const length = end - start + 1;
      const buffer = Buffer.alloc(length);
      await handle.read(buffer, 0, length, start);

      const res = await fetchWithRetry(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": "video/mp4",
          "Content-Range": `bytes ${start}-${end}/${videoSize}`,
          "Content-Length": String(length),
        },
        // Buffer — валидный BodyInit в Node's fetch
        body: buffer as unknown as BodyInit,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new TikTokApiError(
          `TikTok upload (кусок ${index + 1}/${totalChunkCount}): HTTP ${res.status}. ${text.slice(0, 300)}`
        );
      }
      onProgress?.({ uploadedBytes: end + 1, totalBytes: videoSize });
    }
  } finally {
    await handle.close();
  }
}

export type TikTokPublishStatus =
  | "PROCESSING_UPLOAD"
  | "PROCESSING_DOWNLOAD"
  | "SEND_TO_USER_INBOX"
  | "PUBLISH_COMPLETE"
  | "FAILED";

interface StatusResponseBody {
  data?: { status?: TikTokPublishStatus; fail_reason?: string };
  error?: { code?: string; message?: string };
}

export async function fetchPublishStatus(
  accessToken: string,
  publishId: string
): Promise<{ status: TikTokPublishStatus; failReason?: string }> {
  const res = await fetchWithRetry(STATUS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({ publish_id: publishId }),
  });
  const body = (await res.json().catch(() => ({}))) as StatusResponseBody;
  const errorCode = body.error?.code;
  if (!res.ok || (errorCode && errorCode !== "ok") || !body.data?.status) {
    throw new TikTokApiError(
      body.error?.message || `TikTok status: HTTP ${res.status}`
    );
  }
  return { status: body.data.status, failReason: body.data.fail_reason };
}
