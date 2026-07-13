import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { YouTubeApiError, exchangeCodeForTokens } from "@/lib/youtubeApi";
import { saveYouTubeTokens } from "@/lib/youtubeTokenStore";

import { STATE_COOKIE } from "../auth/route";

/**
 * Та же логика, что в app/api/tiktok/callback/route.ts — за туннелем
 * (ngrok и т.п.) request.url отражает то, как Next видит соединение
 * внутри (обычно localhost), не публичный адрес, по которому реально зашёл
 * браузер. X-Forwarded-Host/Proto туннель проставляет сам, доверяем им,
 * если есть. Это только для редиректа "на себя" — сам OAuth redirect_uri
 * фиксирован в GOOGLE_OAUTH_REDIRECT_URI, сюда не относится.
 */
function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function redirectHome(origin: string, params: Record<string, string>) {
  const url = new URL("/", origin);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * Callback Google OAuth. Меняем authorization code на access/refresh
 * token и сохраняем их (см. youtubeTokenStore.ts), затем возвращаем
 * пользователя на главную с флагом успеха/ошибки в query.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const origin = getPublicOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (oauthError) {
    return redirectHome(origin, { youtube_connect_error: oauthError });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectHome(origin, {
      youtube_connect_error:
        "Не удалось подтвердить запрос авторизации (state не совпадает) — попробуйте подключить YouTube ещё раз",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveYouTubeTokens(tokens);
    return redirectHome(origin, { youtube_connected: "1" });
  } catch (e: unknown) {
    const message =
      e instanceof YouTubeApiError
        ? e.message
        : "Не удалось подключить YouTube — попробуйте ещё раз";
    return redirectHome(origin, { youtube_connect_error: message });
  }
}
