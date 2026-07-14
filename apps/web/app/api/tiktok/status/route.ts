import { NextResponse } from "next/server";

import {
  clearTikTokTokens,
  getTikTokPublishMode as getPublishMode,
  isTikTokConnected,
} from "@cueme/publish-clients";

export async function GET() {
  return NextResponse.json({
    connected: await isTikTokConnected(),
    // UI подстраивает формулировки: inbox — «придёт уведомлением»,
    // direct — «появится в профиле с видимостью „Только я“»
    mode: getPublishMode(),
  });
}

/** Отключить TikTok — удаляет сохранённые токены */
export async function DELETE() {
  await clearTikTokTokens();
  return NextResponse.json({ connected: false });
}
