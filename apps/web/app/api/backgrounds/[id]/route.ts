import { NextResponse } from "next/server";

import {
  BackgroundNotFoundError,
  deleteBackgroundVideo,
} from "@/lib/backgrounds";

export async function DELETE(
  _request: Request,
  ctx: RouteContext<"/api/backgrounds/[id]">
) {
  const { id } = await ctx.params;

  try {
    await deleteBackgroundVideo(decodeURIComponent(id));
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    if (e instanceof BackgroundNotFoundError) {
      return NextResponse.json({ error: e.message }, { status: 404 });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
