import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { TikTokApiError, exchangeCodeForTokens } from "@/lib/tiktokApi";
import { saveTikTokTokens } from "@/lib/tiktokTokenStore";

import { STATE_COOKIE, VERIFIER_COOKIE } from "../auth/route";

/**
 * За туннелем (ngrok и т.п.) request.url отражает то, как Next видит
 * соединение внутри (обычно localhost), а не публичный адрес, по которому
 * реально зашёл браузер — редирект на "себя", построенный от request.url,
 * в этом случае уводит на недоступный localhost вместо ngrok-домена.
 * X-Forwarded-Host/Proto ngrok проставляет сам, доверяем им, если есть.
 */
function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

function redirectHome(
  origin: string,
  params: Record<string, string>
) {
  const url = new URL("/", origin);
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
  const origin = getPublicOrigin(request);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError =
    url.searchParams.get("error_description") || url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  const codeVerifier = cookieStore.get(VERIFIER_COOKIE)?.value;
  cookieStore.delete(STATE_COOKIE);
  cookieStore.delete(VERIFIER_COOKIE);

  if (oauthError) {
    return redirectHome(origin, { tiktok_connect_error: oauthError });
  }
  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !codeVerifier
  ) {
    return redirectHome(origin, {
      tiktok_connect_error:
        "Не удалось подтвердить запрос авторизации (state не совпадает) — попробуйте подключить TikTok ещё раз",
    });
  }

  try {
    const tokens = await exchangeCodeForTokens(code, codeVerifier);
    await saveTikTokTokens(tokens);
    return redirectHome(origin, { tiktok_connected: "1" });
  } catch (e: unknown) {
    // Настоящую причину показываем как есть: exchangeCodeForTokens кладёт
    // в TikTokApiError только текст ошибки от TikTok (без токенов), а прочие
    // ошибки здесь — это сеть/шифрование/файл, в них тоже нет секретов.
    // Иначе пользователь видит бесполезное "попробуйте ещё раз".
    const detail = e instanceof Error ? e.message : String(e);
    // в серверный лог — тоже без токенов (см. выше), чтобы видеть стек при отладке
    console.error("[tiktok/callback] обмен кода на токены не удался:", detail);
    const message =
      e instanceof TikTokApiError
        ? detail
        : `Не удалось подключить TikTok: ${detail}`;
    return redirectHome(origin, { tiktok_connect_error: message });
  }
}
