import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildInstagramAuthorizeUrl as buildAuthorizeUrl } from "@cueme/publish-clients";

export const STATE_COOKIE = "instagram_oauth_state";

/**
 * Редиректит на экран авторизации Facebook Login for Business (Instagram
 * Content Publishing API работает через Facebook Graph API, не напрямую).
 * state кладём в httpOnly-cookie — проверяем в /callback (тот же паттерн,
 * что в app/api/tiktok/auth/route.ts).
 */
export async function GET() {
  const state = randomUUID();
  const res = NextResponse.redirect(buildAuthorizeUrl(state));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
