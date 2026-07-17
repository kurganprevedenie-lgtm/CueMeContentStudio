import { randomUUID } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  TikTokApiError,
  exchangeTikTokCodeForTokens as exchangeCodeForTokens,
  listTikTokAccounts,
  saveTikTokAccount,
  updateTikTokAccountTokens,
} from "@cueme/publish-clients";

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
 * Callback TikTok OAuth. Меняем authorization code на access/refresh token и
 * сохраняем их как НОВЫЙ подключённый аккаунт (см. accountStore.ts) — не
 * перезаписываем существующие, так можно подключить сразу несколько TikTok-
 * аккаунтов. Лейбл — автоимя "TikTok #N" по количеству уже подключённых,
 * переименовать можно на /accounts. Возвращаем на главную с флагом
 * успеха/ошибки в query — та же страница, откуда обычно и начинают
 * подключение (из блока публикации или со страницы /accounts).
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
    const existing = await listTikTokAccounts();
    // TikTok не даёт выбрать другой аккаунт при повторном заходе, если в
    // браузере уже есть активная сессия — просто молча переавторизует тот же
    // openId. Без этой проверки получился бы дубль записи на тот же физический
    // аккаунт вместо ошибки/подсказки — сверяем openId и, если аккаунт уже
    // подключён, обновляем его токены, а не создаём новую запись.
    const already = existing.find((a) => a.tokens.openId === tokens.openId);
    if (already) {
      await updateTikTokAccountTokens(already.id, tokens);
      return redirectHome(origin, { tiktok_connected: "1" });
    }
    await saveTikTokAccount({
      id: randomUUID(),
      label: `TikTok #${existing.length + 1}`,
      createdAt: new Date().toISOString(),
      tokens,
    });
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
