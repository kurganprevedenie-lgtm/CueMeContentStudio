import { NextResponse } from "next/server";

import { isTikTokConnected } from "@/lib/tiktokApi";
import { clearTikTokTokens } from "@/lib/tiktokTokenStore";

export async function GET() {
  return NextResponse.json({ connected: await isTikTokConnected() });
}

/** Отключить TikTok — удаляет сохранённые токены */
export async function DELETE() {
  await clearTikTokTokens();
  return NextResponse.json({ connected: false });
}
