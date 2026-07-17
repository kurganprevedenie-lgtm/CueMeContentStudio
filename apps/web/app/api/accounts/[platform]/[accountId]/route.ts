import { NextResponse } from "next/server";

import {
  loadTikTokAccount,
  loadYouTubeAccount,
  removeTikTokAccount,
  removeYouTubeAccount,
  saveTikTokAccount,
  saveYouTubeAccount,
} from "@cueme/publish-clients";

type Platform = "tiktok" | "youtube";

function parsePlatform(value: string): Platform | null {
  return value === "tiktok" || value === "youtube" ? value : null;
}

/** Переименование аккаунта — { label: string } */
export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/accounts/[platform]/[accountId]">
) {
  const { platform: rawPlatform, accountId } = await ctx.params;
  const platform = parsePlatform(rawPlatform);
  if (!platform) {
    return NextResponse.json({ error: "Неизвестная платформа" }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const { label } = (body ?? {}) as { label?: unknown };
  if (typeof label !== "string" || !label.trim()) {
    return NextResponse.json({ error: "Нужен непустой label" }, { status: 400 });
  }

  if (platform === "tiktok") {
    const account = await loadTikTokAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    }
    await saveTikTokAccount({ ...account, label: label.trim() });
  } else {
    const account = await loadYouTubeAccount(accountId);
    if (!account) {
      return NextResponse.json({ error: "Аккаунт не найден" }, { status: 404 });
    }
    await saveYouTubeAccount({ ...account, label: label.trim() });
  }

  return NextResponse.json({ ok: true });
}

/** Отключить аккаунт — удаляет зашифрованный файл токенов */
export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/accounts/[platform]/[accountId]">
) {
  const { platform: rawPlatform, accountId } = await ctx.params;
  const platform = parsePlatform(rawPlatform);
  if (!platform) {
    return NextResponse.json({ error: "Неизвестная платформа" }, { status: 400 });
  }

  if (platform === "tiktok") {
    await removeTikTokAccount(accountId);
  } else {
    await removeYouTubeAccount(accountId);
  }

  return NextResponse.json({ ok: true });
}
