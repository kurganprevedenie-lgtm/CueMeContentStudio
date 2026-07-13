import { NextResponse } from "next/server";

import { getTikTokJob, refreshTikTokJobIfDue } from "@/lib/tiktokJobs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/tiktok/publish/[tiktokJobId]">
) {
  const { tiktokJobId } = await ctx.params;
  const job = getTikTokJob(tiktokJobId);
  if (!job) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }
  const refreshed = await refreshTikTokJobIfDue(job);
  return NextResponse.json(refreshed);
}
