import {
  clearInstagramTokens,
  loadInstagramTokens,
  saveInstagramTokens,
  type InstagramTokens,
} from "./instagramTokenStore";

// Instagram Content Publishing API живёт поверх Facebook Graph API — публикуем
// не в сам Instagram-аккаунт напрямую, а через Facebook-страницу, к которой он
// привязан (Meta Business Suite). На момент написания кода:
// developers.facebook.com/docs/instagram-platform/content-publishing
// Если Meta поменяет версию/пути, менять нужно только здесь.
const GRAPH_API_VERSION = "v21.0";
const GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;
const AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;

// instagram_content_publish и pages_read_engagement требуют Advanced Access
// в Meta App Review (демо-видео, рассмотрение) для чужих аккаунтов — но
// работают без ревью для ролей уже добавленных в приложение (admin/developer/
// tester в Meta App Dashboard), чего достаточно для личного использования.
const SCOPE =
  "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement";

/** Приложение не подключено к Instagram (нет токенов) или подключение истекло */
export class InstagramNotConnectedError extends Error {}

/** Ошибка на стороне Meta Graph API — message уже содержит конкретную причину, не generic-текст */
export class InstagramApiError extends Error {}

function getClientCredentials(): { appId: string; appSecret: string } {
  const appId = process.env.FACEBOOK_APP_ID;
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appId || !appSecret) {
    throw new Error(
      "FACEBOOK_APP_ID / FACEBOOK_APP_SECRET не заданы — добавь их в .env"
    );
  }
  return { appId, appSecret };
}

function getRedirectUri(): string {
  const uri = process.env.INSTAGRAM_REDIRECT_URI;
  if (!uri) {
    throw new Error("INSTAGRAM_REDIRECT_URI не задан — добавь его в .env");
  }
  return uri;
}

export function buildAuthorizeUrl(state: string): string {
  const { appId } = getClientCredentials();
  const url = new URL(AUTHORIZE_URL);
  url.searchParams.set("client_id", appId);
  url.searchParams.set("redirect_uri", getRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const MAX_RATE_LIMIT_RETRIES = 4;
const RATE_LIMIT_BASE_DELAY_MS = 2000;
const RATE_LIMIT_MAX_DELAY_MS = 20000;

/** Тот же паттерн ретраев на 429, что и в tiktokApi.ts/youtubeApi.ts */
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

interface GraphErrorBody {
  error?: { message?: string; type?: string; code?: number };
}

async function graphGet<T>(
  pathAndQuery: string,
  accessToken: string
): Promise<T> {
  const url = new URL(`${GRAPH_URL}${pathAndQuery}`);
  url.searchParams.set("access_token", accessToken);
  const res = await fetchWithRetry(url.toString(), { method: "GET" });
  const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || body.error) {
    throw new InstagramApiError(
      body.error?.message || `Instagram/Facebook Graph API: HTTP ${res.status}`
    );
  }
  return body;
}

async function graphPost<T>(
  path: string,
  accessToken: string,
  params: Record<string, string>
): Promise<T> {
  const res = await fetchWithRetry(`${GRAPH_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ ...params, access_token: accessToken }),
  });
  const body = (await res.json().catch(() => ({}))) as T & GraphErrorBody;
  if (!res.ok || body.error) {
    throw new InstagramApiError(
      body.error?.message || `Instagram/Facebook Graph API: HTTP ${res.status}`
    );
  }
  return body;
}

interface TokenExchangeResponse {
  access_token?: string;
  expires_in?: number;
  error?: { message?: string };
}

async function exchangeToken(
  params: Record<string, string>
): Promise<{ accessToken: string; expiresInSec: number }> {
  const url = new URL(`${GRAPH_URL}/oauth/access_token`);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  const res = await fetchWithRetry(url.toString(), { method: "GET" });
  const body = (await res.json().catch(() => ({}))) as TokenExchangeResponse;
  if (!res.ok || !body.access_token) {
    throw new InstagramApiError(
      body.error?.message || `Instagram OAuth: HTTP ${res.status}`
    );
  }
  return { accessToken: body.access_token, expiresInSec: body.expires_in ?? 0 };
}

interface PageAccount {
  id: string;
  name: string;
  access_token: string;
}

interface InstagramBusinessAccountField {
  instagram_business_account?: { id: string; username: string };
}

/**
 * Находит первую Facebook-страницу пользователя, к которой привязан
 * Instagram-аккаунт бизнеса/автора, и возвращает данные для публикации.
 * Если ни одна не привязана — Instagram Content Publishing API работать
 * не будет, пока пользователь не привяжет аккаунт в Meta Business Suite.
 */
async function resolveInstagramAccount(
  userAccessToken: string
): Promise<Pick<InstagramTokens, "pageId" | "pageName" | "pageAccessToken" | "igUserId" | "igUsername">> {
  const { data: pages } = await graphGet<{ data: PageAccount[] }>(
    "/me/accounts",
    userAccessToken
  );
  if (!pages || pages.length === 0) {
    throw new InstagramApiError(
      "У вашего Facebook-аккаунта нет ни одной страницы — Instagram Content Publishing API требует Facebook-страницу, привязанную к Instagram-аккаунту бизнеса/автора"
    );
  }
  for (const page of pages) {
    const fields = await graphGet<InstagramBusinessAccountField>(
      `/${page.id}?fields=instagram_business_account{id,username}`,
      page.access_token
    );
    if (fields.instagram_business_account) {
      return {
        pageId: page.id,
        pageName: page.name,
        pageAccessToken: page.access_token,
        igUserId: fields.instagram_business_account.id,
        igUsername: fields.instagram_business_account.username,
      };
    }
  }
  throw new InstagramApiError(
    "К вашим Facebook-страницам не привязан ни один Instagram-аккаунт бизнеса/автора — привяжите его в настройках страницы (Meta Business Suite) и подключите заново"
  );
}

export async function exchangeCodeForTokens(
  code: string
): Promise<InstagramTokens> {
  const { appId, appSecret } = getClientCredentials();
  // Шаг 1 — код на короткоживущий User Access Token
  const shortLived = await exchangeToken({
    client_id: appId,
    client_secret: appSecret,
    redirect_uri: getRedirectUri(),
    code,
  });
  // Шаг 2 — короткоживущий на долгоживущий (~60 дней)
  const longLived = await exchangeToken({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: shortLived.accessToken,
  });
  const account = await resolveInstagramAccount(longLived.accessToken);
  return {
    userAccessToken: longLived.accessToken,
    userAccessExpiresAt: Date.now() + longLived.expiresInSec * 1000,
    ...account,
  };
}

/**
 * В отличие от TikTok/YouTube здесь нет отдельного refresh_token — сам
 * долгоживущий User Access Token можно продлить тем же fb_exchange_token
 * обменом, пока он ещё не истёк. Page Access Token переизвлекаем заново на
 * случай, если он успел смениться.
 */
async function refreshTokens(
  currentUserAccessToken: string
): Promise<InstagramTokens> {
  const { appId, appSecret } = getClientCredentials();
  const longLived = await exchangeToken({
    grant_type: "fb_exchange_token",
    client_id: appId,
    client_secret: appSecret,
    fb_exchange_token: currentUserAccessToken,
  });
  const account = await resolveInstagramAccount(longLived.accessToken);
  return {
    userAccessToken: longLived.accessToken,
    userAccessExpiresAt: Date.now() + longLived.expiresInSec * 1000,
    ...account,
  };
}

// User Access Token живёт ~60 дней — обновляем с запасом в несколько дней,
// а не по факту истечения (в отличие от 5-минутного запаса TikTok/YouTube,
// здесь одно обновление обходится сильно дешевле по времени на запрос)
const USER_TOKEN_REFRESH_MARGIN_MS = 5 * 24 * 60 * 60 * 1000;

export async function getValidAccount(): Promise<
  Pick<InstagramTokens, "pageAccessToken" | "igUserId">
> {
  const tokens = await loadInstagramTokens();
  if (!tokens) {
    throw new InstagramNotConnectedError("Instagram не подключён");
  }
  if (Date.now() < tokens.userAccessExpiresAt - USER_TOKEN_REFRESH_MARGIN_MS) {
    return { pageAccessToken: tokens.pageAccessToken, igUserId: tokens.igUserId };
  }
  try {
    const refreshed = await refreshTokens(tokens.userAccessToken);
    await saveInstagramTokens(refreshed);
    return { pageAccessToken: refreshed.pageAccessToken, igUserId: refreshed.igUserId };
  } catch (e: unknown) {
    // Токен уже протух и обменять его больше нельзя — просим переподключиться,
    // а не показываем generic-ошибку API (тот же подход, что в youtubeApi.ts)
    await clearInstagramTokens();
    throw new InstagramNotConnectedError(
      e instanceof Error
        ? e.message
        : "Подключение к Instagram истекло — подключите аккаунт заново"
    );
  }
}

export async function isInstagramConnected(): Promise<boolean> {
  return (await loadInstagramTokens()) !== null;
}

export type InstagramContainerStatus =
  | "IN_PROGRESS"
  | "FINISHED"
  | "ERROR"
  | "EXPIRED"
  | "PUBLISHED";

/**
 * Шаг 1 — создаём медиа-контейнер Reels. В отличие от TikTok/YouTube мы не
 * стримим байты сами — Meta сама забирает видео по videoUrl (см.
 * app/api/render/[jobId]/download/route.ts), поэтому videoUrl должен быть
 * реально публичным HTTPS-адресом с валидным сертификатом (self-signed
 * сертификат `pnpm dev:https`, которого достаточно для TikTok OAuth-редиректа
 * в браузере, здесь не подойдёт — серверная заливка Meta его не примет; для
 * локальной разработки нужен туннель вроде ngrok).
 */
export async function createReelsContainer(
  pageAccessToken: string,
  igUserId: string,
  videoUrl: string,
  caption: string
): Promise<{ containerId: string }> {
  const body = await graphPost<{ id?: string }>(
    `/${igUserId}/media`,
    pageAccessToken,
    { media_type: "REELS", video_url: videoUrl, caption }
  );
  if (!body.id) {
    throw new InstagramApiError("Instagram: не удалось создать медиа-контейнер");
  }
  return { containerId: body.id };
}

export async function fetchContainerStatus(
  pageAccessToken: string,
  containerId: string
): Promise<{ statusCode: InstagramContainerStatus; statusDetail?: string }> {
  const body = await graphGet<{
    status_code?: InstagramContainerStatus;
    status?: string;
  }>(`/${containerId}?fields=status_code,status`, pageAccessToken);
  if (!body.status_code) {
    throw new InstagramApiError("Instagram: не удалось получить статус контейнера");
  }
  return { statusCode: body.status_code, statusDetail: body.status };
}

/** Шаг 2 — публикуем готовый контейнер (после status_code === "FINISHED") */
export async function publishContainer(
  pageAccessToken: string,
  igUserId: string,
  containerId: string
): Promise<{ mediaId: string }> {
  const body = await graphPost<{ id?: string }>(
    `/${igUserId}/media_publish`,
    pageAccessToken,
    { creation_id: containerId }
  );
  if (!body.id) {
    throw new InstagramApiError("Instagram: не удалось опубликовать контейнер");
  }
  return { mediaId: body.id };
}

export async function fetchPermalink(
  pageAccessToken: string,
  mediaId: string
): Promise<string> {
  const body = await graphGet<{ permalink?: string }>(
    `/${mediaId}?fields=permalink`,
    pageAccessToken
  );
  return body.permalink ?? `https://www.instagram.com/reel/${mediaId}/`;
}
