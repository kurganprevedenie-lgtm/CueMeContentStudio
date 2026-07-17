import { NextResponse } from "next/server";

import { getRenderJob } from "@/lib/renderJobs";
import { VideoTooLargeError, startTikTokPublish } from "@/lib/tiktokJobs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { jobId, accountIds, caption } = (body ?? {}) as {
    jobId?: unknown;
    accountIds?: unknown;
    caption?: unknown;
  };

  if (typeof jobId !== "string") {
    return NextResponse.json(
      { error: "Нужен jobId отрендеренного видео" },
      { status: 400 }
    );
  }
  if (
    !Array.isArray(accountIds) ||
    accountIds.length === 0 ||
    !accountIds.every((id) => typeof id === "string")
  ) {
    return NextResponse.json(
      { error: "Нужен хотя бы один accountId" },
      { status: 400 }
    );
  }

  const renderJob = getRenderJob(jobId);
  if (!renderJob || renderJob.status !== "done" || !renderJob.outputPath) {
    return NextResponse.json(
      { error: "Видео ещё не готово — сначала дождитесь окончания рендера" },
      { status: 400 }
    );
  }

  try {
    const job = await startTikTokPublish(
      renderJob.outputPath,
      accountIds,
      typeof caption === "string" ? caption : undefined
    );
    return NextResponse.json(job);
  } catch (e: unknown) {
    if (e instanceof VideoTooLargeError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 }
    );
  }
}
