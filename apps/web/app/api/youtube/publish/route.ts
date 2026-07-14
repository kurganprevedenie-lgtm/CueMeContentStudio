import { NextResponse } from "next/server";

import { getRenderJob } from "@/lib/renderJobs";
import { startYouTubePublish } from "@/lib/youtubeJobs";
import type { YouTubePrivacyStatus } from "@cueme/publish-clients";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { jobId, title, description, privacyStatus } = (body ?? {}) as {
    jobId?: unknown;
    title?: unknown;
    description?: unknown;
    privacyStatus?: unknown;
  };

  if (typeof jobId !== "string") {
    return NextResponse.json(
      { error: "Нужен jobId отрендеренного видео" },
      { status: 400 }
    );
  }
  if (typeof title !== "string" || !title.trim()) {
    return NextResponse.json(
      { error: "Нужен title" },
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

  const job = startYouTubePublish({
    filePath: renderJob.outputPath,
    title: title.trim(),
    description: typeof description === "string" ? description : "",
    privacyStatus: (privacyStatus as YouTubePrivacyStatus) ?? "unlisted",
  });
  return NextResponse.json(job);
}
