import { createHash, randomBytes } from "node:crypto";
import { open } from "node:fs/promises";

import {
  loadTikTokAccount,
  removeTikTokAccount,
  updateTikTokAccountTokens,
  type TikTokTokens,
} from "./tiktokTokenStore";

// Эндпоинты TikTok Content Posting API v2 — на момент написания кода
// (см. developers.tiktok.com/doc/content-posting-api-get-started).
// Если TikTok поменяет пути, менять нужно только здесь.
const AUTHORIZE_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const STATUS_URL = "https://open.tiktokapis.com/v2/post/publish/status/fetch/";

export type TikTokPublishMode = "inbox" | "direct";

/**
 * Два способа доставки видео, переключаются через TIKTOK_PUBLISH_MODE в .env:
 *
 * - "inbox" (по умолчанию): /post/publish/inbox/video/init/, scope
 *   video.upload — включён у приложения по умолчанию, без app review.
 *   Видео приходит пуш-уведомлением от TikTok («отредактируйте перед
 *   публикацией»), в профиле/черновиках его НЕ видно — только за
 *   уведомлением. В Sandbox уведомление во «Входящих» может не
 *   отображаться вовсе.
 *
 * - "direct": /post/publish/video/init/, scope video.publish, Direct Post —
 *   видео появляется в профиле автора с privacy_level: SELF_ONLY
 *   («Только я»), публичной публикации всё равно не происходит. В
 *   production требует пройденного app review (тумблер Direct Post
 *   заблокирован до ревью), но в Sandbox включается свободно — песочница
 *   и предназначена для демонстрации интеграции до аппрува.
 */
function getMode(): TikTokPublishMode {
  return process.env.TIKTOK_PUBLISH_MODE === "direct" ? "direct" : "inbox";
}

export function getPublishMode(): TikTokPublishMode {
  return getMode();
}

function getScope(): string {
  return getMode() === "direct" ? "video.publish" : "video.upload";
}

function getInitUrl(): string {
  return getMode() === "direct"
    ? "https://open.tiktokapis.com/v2/post/publish/video/init/"
    : "https://open.tiktokapis.com/v2/post/publish/inbox/video/init/";
}

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

// TikTok требует PKCE (code_challenge) для новых/sandbox-приложений — без
// него /v2/auth/authorize/ отвечает ошибкой "code_challenge" ещё до экрана
// логина. code_verifier живёт в httpOnly-cookie между /auth и /callback
// (см. STATE_COOKIE в app/api/tiktok/auth/route.ts, apps/web).
export function createCodeVerifier(): string {
  return randomBytes(64).toString("base64url");
}

function codeChallengeFromVerifier(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function buildAuthorizeUrl(state: string, codeVerifier: string): string {
  const { clientKey } = getClientCredentials();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_key", clientKey);
  url.searchParams.set("scope", getScope());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallengeFromVerifier(codeVerifier));
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 20000;

// Таймаут — не обязательно "TikTok недоступен", часто это разовая просадка
// VPN/сети на пару секунд. Раньше таймаут падал сразу с одной попытки —
// один короткий сбой сети роняет всю публикацию. Ретраим так же, как 429
// (тот же счётчик/бэкофф) — PUT чанка идемпотентен по Content-Range, повторная
// отправка того же куска безопасна.
const MAX_TIMEOUT_RETRIES = 3;

// Без явного таймаута зависшее соединение (например, тихая блокировка на
// уровне сети — TikTok Content Posting API недоступен для части регионов)
// висит 5 минут (дефолтный headers timeout Node/undici) прежде чем упасть с
// малопонятным "fetch failed". Метаданные (токены/init/статус) — лёгкие
// запросы, TikTok должен ответить за секунды; заливка чанка видео — реальная
// передача данных, ей нужно больше времени на медленных соединениях.
const DEFAULT_TIMEOUT_MS = 30_000;
const UPLOAD_TIMEOUT_MS = 120_000;

/**
 * fetch с таймаутом и обработкой 429: TikTok рекомендует уважать Retry-After,
 * если его нет — экспоненциальная пауза. Ошибки токена/сети (кроме таймаута)
 * наверх не оборачиваем, их обрабатывают вызывающие функции (там понятнее,
 * что за операция).
 */
async function fetchWithRetry(
  url: string,
  init: RequestInit,
  attempt = 0,
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  } catch (e: unknown) {
    if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) {
      if (attempt < MAX_TIMEOUT_RETRIES) {
        const waitMs = Math.min(
          RATE_LIMIT_BASE_DELAY_MS * 2 ** attempt,
          RATE_LIMIT_MAX_DELAY_MS
        );
        await sleep(waitMs);
        return fetchWithRetry(url, init, attempt + 1, timeoutMs);
      }
      throw new TikTokApiError(
        `TikTok не ответил за ${Math.round(timeoutMs / 1000)} секунд (после ${MAX_TIMEOUT_RETRIES + 1} попыток) — проверьте сеть/VPN`
      );
    }
    throw e;
  }
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
    return fetchWithRetry(url, init, attempt + 1, timeoutMs);
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
    scope: body.scope ?? getScope(),
  };
}

export async function exchangeCodeForTokens(
  code: string,
  codeVerifier: string
): Promise<TikTokTokens> {
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
      code_verifier: codeVerifier,
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

/** TikTok отдаёт scope строкой через запятую ("user.info.basic,video.upload") */
function hasRequiredScope(grantedScope: string): boolean {
  return grantedScope
    .split(",")
    .map((s) => s.trim())
    .includes(getScope());
}

/**
 * accountId — id конкретного подключённого TikTok-аккаунта (см.
 * packages/publish-clients/src/accountStore.ts, StoredAccount.id). Один
 * пользователь может подключить несколько TikTok-аккаунтов одновременно —
 * каждый хранится в своём файле, поэтому все операции с токенами теперь
 * идут через конкретный accountId, а не "единственный" неявный аккаунт.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await loadTikTokAccount(accountId);
  if (!account) {
    throw new TikTokNotConnectedError("TikTok-аккаунт не найден — переподключите его");
  }
  const tokens = account.tokens;
  // сменился TIKTOK_PUBLISH_MODE — у сохранённого токена другое разрешение,
  // TikTok ответил бы invalid scope; понятнее сразу попросить переподключиться
  if (!hasRequiredScope(tokens.scope)) {
    throw new TikTokNotConnectedError(
      "Режим публикации изменился — переподключите TikTok, чтобы выдать новое разрешение"
    );
  }
  if (Date.now() < tokens.accessExpiresAt - ACCESS_TOKEN_REFRESH_MARGIN_MS) {
    return tokens.accessToken;
  }
  if (Date.now() >= tokens.refreshExpiresAt) {
    await removeTikTokAccount(accountId);
    throw new TikTokNotConnectedError(
      "Подключение к TikTok истекло — подключите аккаунт заново"
    );
  }
  const refreshed = await refreshTokens(tokens.refreshToken);
  await updateTikTokAccountTokens(accountId, refreshed);
  return refreshed.accessToken;
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

const CREATOR_INFO_URL =
  "https://open.tiktokapis.com/v2/post/publish/creator_info/query/";

interface CreatorInfoBody {
  data?: { privacy_level_options?: string[] };
  error?: { code?: string; message?: string };
}

/**
 * Direct Post требует по «content sharing guidelines» сперва запросить
 * инфо о создателе — TikTok так проверяет, что приложение показывает
 * пользователю его реальные доступные настройки приватности, а не шлёт
 * произвольные. Возвращаем список разрешённых privacy_level; для
 * приложения без app review там, как правило, только SELF_ONLY. Без
 * этого шага init отвечает ошибкой со ссылкой на guidelines.
 */
async function queryCreatorPrivacyOptions(
  accessToken: string
): Promise<string[]> {
  const res = await fetchWithRetry(CREATOR_INFO_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
  });
  const body = (await res.json().catch(() => ({}))) as CreatorInfoBody;
  const errorCode = body.error?.code;
  if (!res.ok || (errorCode && errorCode !== "ok")) {
    throw new TikTokApiError(
      body.error?.message || `TikTok creator_info: HTTP ${res.status}`
    );
  }
  return body.data?.privacy_level_options ?? [];
}

/**
 * Шаг 1 — инициализация загрузки. Куда попадёт видео — зависит от режима
 * (см. getPublishMode): во «Входящие» (inbox, без post_info — у того
 * эндпоинта нет ни privacy_level/title, ни caption — подпись добавляется
 * только вручную в приложении TikTok, caption сюда поэтому игнорируется) или
 * в профиль автора с видимостью «Только я» (direct, privacy_level:
 * SELF_ONLY обязателен, caption уходит в title, плюс предварительный запрос
 * creator_info по требованию guidelines). В обоих случаях публичной
 * публикации не происходит — только вручную из приложения TikTok.
 */
export async function initDraftUpload(
  accessToken: string,
  videoSize: number,
  caption?: string
): Promise<{ publishId: string; uploadUrl: string }> {
  let postInfo: Record<string, unknown> | undefined;
  if (getMode() === "direct") {
    const options = await queryCreatorPrivacyOptions(accessToken);
    if (options.length > 0 && !options.includes("SELF_ONLY")) {
      throw new TikTokApiError(
        "TikTok не разрешает этому аккаунту приватную публикацию (SELF_ONLY) — проверьте настройки Direct Post в приложении"
      );
    }
    postInfo = {
      privacy_level: "SELF_ONLY",
      ...(caption ? { title: caption } : {}),
    };
  }

  const { chunkSize, totalChunkCount } = planChunks(videoSize);
  const res = await fetchWithRetry(getInitUrl(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
    },
    body: JSON.stringify({
      ...(postInfo ? { post_info: postInfo } : {}),
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

      const res = await fetchWithRetry(
        uploadUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": "video/mp4",
            "Content-Range": `bytes ${start}-${end}/${videoSize}`,
            "Content-Length": String(length),
          },
          // Buffer — валидный BodyInit в Node's fetch
          body: buffer as unknown as BodyInit,
        },
        0,
        UPLOAD_TIMEOUT_MS
      );
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
