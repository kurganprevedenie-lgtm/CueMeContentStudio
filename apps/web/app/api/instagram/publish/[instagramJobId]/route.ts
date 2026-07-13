import { NextResponse } from "next/server";

import { getInstagramJob, refreshInstagramJobIfDue } from "@/lib/instagramJobs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/instagram/publish/[instagramJobId]">
) {
  const { instagramJobId } = await ctx.params;
  const job = getInstagramJob(instagramJobId);
  if (!job) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }
  const refreshed = await refreshInstagramJobIfDue(job);
  return NextResponse.json(refreshed);
}
