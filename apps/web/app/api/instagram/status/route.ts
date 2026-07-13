import { NextResponse } from "next/server";

import { isInstagramConnected } from "@/lib/instagramApi";
import { clearInstagramTokens } from "@/lib/instagramTokenStore";

export async function GET() {
  return NextResponse.json({ connected: await isInstagramConnected() });
}

/** Отключить Instagram — удаляет сохранённые токены */
export async function DELETE() {
  await clearInstagramTokens();
  return NextResponse.json({ connected: false });
}
