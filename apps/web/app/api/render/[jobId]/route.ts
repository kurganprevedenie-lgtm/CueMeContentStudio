import { NextResponse } from "next/server";

import { getRenderJob } from "@/lib/renderJobs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/render/[jobId]">
) {
  const { jobId } = await ctx.params;
  const job = getRenderJob(jobId);

  if (!job) {
    return NextResponse.json({ error: "Задача не найдена" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    progress: job.progress,
    error: job.error,
  });
}
