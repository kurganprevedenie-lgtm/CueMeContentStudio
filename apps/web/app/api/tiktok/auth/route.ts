import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import {
  buildTikTokAuthorizeUrl as buildAuthorizeUrl,
  createCodeVerifier,
} from "@cueme/publish-clients";

export const STATE_COOKIE = "tiktok_oauth_state";
export const VERIFIER_COOKIE = "tiktok_oauth_verifier";

/**
 * Редиректит на экран авторизации TikTok. state и code_verifier (PKCE —
 * см. tiktokApi.ts) кладём в httpOnly-cookie — проверяем/используем в
 * /callback.
 */
export async function GET() {
  const state = randomUUID();
  const codeVerifier = createCodeVerifier();
  const res = NextResponse.redirect(buildAuthorizeUrl(state, codeVerifier));
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  res.cookies.set(VERIFIER_COOKIE, codeVerifier, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
