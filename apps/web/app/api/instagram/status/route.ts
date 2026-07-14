import { NextResponse } from "next/server";

import {
  clearInstagramTokens,
  isInstagramConnected,
} from "@cueme/publish-clients";

export async function GET() {
  return NextResponse.json({ connected: await isInstagramConnected() });
}

/** Отключить Instagram — удаляет сохранённые токены */
export async function DELETE() {
  await clearInstagramTokens();
  return NextResponse.json({ connected: false });
}
