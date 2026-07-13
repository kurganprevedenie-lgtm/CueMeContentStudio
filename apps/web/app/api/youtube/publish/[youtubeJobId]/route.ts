import { NextResponse } from "next/server";

import { getYouTubeJob } from "@/lib/youtubeJobs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/youtube/publish/[youtubeJobId]">
) {
  const { youtubeJobId } = await ctx.params;
  const job = getYouTubeJob(youtubeJobId);
  if (!job) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }
  return NextResponse.json(job);
}
