import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { TikTokApiError, exchangeCodeForTokens } from "@/lib/tiktokApi";
import { saveTikTokTokens } from "@/lib/tiktokTokenStore";

import { STATE_COOKIE } from "../auth/route";

function redirectHome(requestUrl: string, params: Record<string, string>) {
  const url = new URL("/", requestUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return NextResponse.redirect(url);
}

/**
 * Callback TikTok OAuth. Меняем authorization code на access/refresh
 * token и сохраняем их (см. tiktokTokenStore.ts), затем возвращаем
 * пользователя на главную с флагом успеха/ошибки в query — сама главная
 * страница по нему один раз показывает баннер и очищает URL.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);

  if (oauthError) {
    return redirectHome(request.url, { tiktok_connect_error: oauthError });
  }
  if (!code || !state || !expectedState || state !== expectedState) {
    return redirectHome(request.url, {
      tiktok_connect_error:
        "Не удалось подтвердить запрос авторизации (state не совпадает) — попробуйте подключить TikTok ещё раз",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code);
    await saveTikTokTokens(tokens);
    return redirectHome(request.url, { tiktok_connected: "1" });
  } catch (e: unknown) {
    const message =
      e instanceof TikTokApiError
        ? e.message
        : "Не удалось подключить TikTok — попробуйте ещё раз";
    return redirectHome(request.url, { tiktok_connect_error: message });
  }
}
