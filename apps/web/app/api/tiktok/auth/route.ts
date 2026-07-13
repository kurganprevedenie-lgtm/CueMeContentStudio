import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

import { buildAuthorizeUrl } from "@/lib/tiktokApi";

export const STATE_COOKIE = "tiktok_oauth_state";

/** Редиректит на экран авторизации TikTok, state кладём в httpOnly-cookie — проверяем в /callback против CSRF */
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
