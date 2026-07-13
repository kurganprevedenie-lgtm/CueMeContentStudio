import { NextResponse } from "next/server";

import { isYouTubeConnected } from "@/lib/youtubeApi";
import { clearYouTubeTokens } from "@/lib/youtubeTokenStore";

export async function GET() {
  return NextResponse.json({ connected: await isYouTubeConnected() });
}

/** Отключить YouTube — удаляет сохранённые токены */
export async function DELETE() {
  await clearYouTubeTokens();
  return NextResponse.json({ connected: false });
}
