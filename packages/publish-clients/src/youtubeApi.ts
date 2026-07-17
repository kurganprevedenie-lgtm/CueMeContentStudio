import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";

import {
  loadYouTubeAccount,
  removeYouTubeAccount,
  updateYouTubeAccountTokens,
  type YouTubeTokens,
} from "./youtubeTokenStore";

// Эндпоинты Google OAuth 2.0 / YouTube Data API v3 — как и в tiktokApi.ts,
// без SDK (googleapis в проекте нет), всё на сыром fetch.
const AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const UPLOAD_URL =
  "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status";

const SCOPE = "https://www.googleapis.com/auth/youtube.upload";

/** Приложение не подключено к YouTube (нет токенов) или подключение истекло */
export class YouTubeNotConnectedError extends Error {}

/** Ошибка на стороне YouTube/Google API — message уже содержит конкретную причину, не generic-текст */
export class YouTubeApiError extends Error {}

function getClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "GOOGLE_OAUTH_CLIENT_ID / GOOGLE_OAUTH_CLIENT_SECRET не заданы — добавь их в .env"
    );
  }
  return { clientId, clientSecret };
}

function getRedirectUri(): string {
  const uri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
  if (!uri) {
    throw new Error("GOOGLE_OAUTH_REDIRECT_URI не задан — добавь его в .env");
  }
  return uri;
}

export function buildAuthorizeUrl(state: string): string {
  const { clientId } = getClientCredentials();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  // offline+consent — гарантирует refresh_token даже при повторном
  // подключении того же Google-аккаунта
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 20000;

/** Тот же паттерн ретраев на 429, что и в tiktokApi.ts — уважаем Retry-After, иначе экспоненциальная пауза */
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
  error?: string;
  error_description?: string;
}

async function requestToken(body: URLSearchParams): Promise<RawTokenResponse> {
  const res = await fetchWithRetry(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await res.json().catch(() => ({}))) as RawTokenResponse;
  if (!res.ok || data.error) {
    const reason = data.error_description || data.error || `HTTP ${res.status}`;
    throw new YouTubeApiError(`YouTube OAuth: ${reason}`);
  }
  return data;
}

export async function exchangeCodeForTokens(
  code: string
): Promise<YouTubeTokens> {
  const { clientId, clientSecret } = getClientCredentials();
  const data = await requestToken(
    new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    })
  );
  if (!data.access_token || !data.refresh_token) {
    throw new YouTubeApiError(
      "Google не вернул refresh_token — отзови доступ приложению в аккаунте Google (myaccount.google.com/permissions) и подключи заново"
    );
  }
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    accessExpiresAt: Date.now() + (data.expires_in ?? 0) * 1000,
  };
}

async function refreshTokens(refreshToken: string): Promise<YouTubeTokens> {
  const { clientId, clientSecret } = getClientCredentials();
  const data = await requestToken(
    new URLSearchParams({
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    })
  );
  if (!data.access_token) {
    throw new YouTubeApiError("YouTube OAuth: не удалось обновить токен");
  }
  return {
    accessToken: data.access_token,
    // Google обычно не возвращает новый refresh_token при обновлении — держим старый
    refreshToken,
    accessExpiresAt: Date.now() + (data.expires_in ?? 0) * 1000,
  };
}

/** Обновляем заранее, не дожидаясь 401 — тот же запас, что и для TikTok */
const ACCESS_TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

/**
 * accountId — id конкретного подключённого YouTube-аккаунта (см.
 * packages/publish-clients/src/accountStore.ts, StoredAccount.id) — тот же
 * принцип, что и у getValidAccessToken в tiktokApi.ts.
 */
export async function getValidAccessToken(accountId: string): Promise<string> {
  const account = await loadYouTubeAccount(accountId);
  if (!account) {
    throw new YouTubeNotConnectedError("YouTube-аккаунт не найден — переподключите его");
  }
  const tokens = account.tokens;
  if (Date.now() < tokens.accessExpiresAt - ACCESS_TOKEN_REFRESH_MARGIN_MS) {
    return tokens.accessToken;
  }
  try {
    const refreshed = await refreshTokens(tokens.refreshToken);
    await updateYouTubeAccountTokens(accountId, refreshed);
    return refreshed.accessToken;
  } catch (e: unknown) {
    // refresh_token отозван/протух (например, тестовый режим Google
    // consent screen истекает раз в 7 дней) — просим переподключиться,
    // а не показываем generic-ошибку API
    await removeYouTubeAccount(accountId);
    throw new YouTubeNotConnectedError(
      e instanceof Error ? e.message : "Подключение к YouTube истекло — подключите аккаунт заново"
    );
  }
}

export type YouTubePrivacyStatus = "public" | "unlisted" | "private";

export interface UploadYouTubeInput {
  accountId: string;
  filePath: string;
  title: string;
  description: string;
  privacyStatus: YouTubePrivacyStatus;
}

export interface UploadProgress {
  uploadedBytes: number;
  totalBytes: number;
}

/**
 * Resumable upload: сначала регистрируем метаданные, сервер отдаёт
 * одноразовый upload-адрес в заголовке Location, затем стримим файл целиком
 * туда одним PUT (видео из этого проекта короткие — TikTok/Shorts формат,
 * без нужды резать на чанки, в отличие от TikTok Content Posting API).
 */
export async function uploadVideo(
  { accountId, filePath, title, description, privacyStatus }: UploadYouTubeInput,
  onProgress?: (progress: UploadProgress) => void
): Promise<{ videoId: string; url: string }> {
  const accessToken = await getValidAccessToken(accountId);
  const { size } = await stat(filePath);

  const initRes = await fetchWithRetry(UPLOAD_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json; charset=UTF-8",
      "X-Upload-Content-Type": "video/mp4",
      "X-Upload-Content-Length": String(size),
    },
    body: JSON.stringify({
      snippet: { title, description, categoryId: "22" },
      status: { privacyStatus },
    }),
  });
  if (!initRes.ok) {
    const text = await initRes.text().catch(() => "");
    throw new YouTubeApiError(
      `YouTube: не удалось начать загрузку (HTTP ${initRes.status}). ${text.slice(0, 300)}`
    );
  }
  const uploadUrl = initRes.headers.get("location");
  if (!uploadUrl) {
    throw new YouTubeApiError("YouTube: сервер не вернул адрес для загрузки видео");
  }

  const stream = createReadStream(filePath);
  if (onProgress) {
    let uploaded = 0;
    stream.on("data", (chunk: string | Buffer) => {
      uploaded += chunk.length;
      onProgress({ uploadedBytes: uploaded, totalBytes: size });
    });
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
    },
    body: Readable.toWeb(stream) as unknown as BodyInit,
    duplex: "half",
  } as RequestInit & { duplex: "half" });

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    throw new YouTubeApiError(
      `YouTube: загрузка не удалась (HTTP ${putRes.status}). ${text.slice(0, 300)}`
    );
  }
  const data = (await putRes.json()) as { id: string };
  return { videoId: data.id, url: `https://youtube.com/shorts/${data.id}` };
}
