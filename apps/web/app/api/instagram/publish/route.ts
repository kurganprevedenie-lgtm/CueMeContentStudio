import { NextResponse } from "next/server";

import { getRenderJob } from "@/lib/renderJobs";
import { startInstagramPublish } from "@/lib/instagramJobs";

/**
 * За туннелем (ngrok и т.п.) request.url отражает то, как Next видит
 * соединение внутри — тот же паттерн, что в tiktok/callback и
 * youtube/callback. Здесь публичный origin нужен не для редиректа, а чтобы
 * собрать videoUrl, который реально сможет скачать сервер Meta.
 */
function getPublicOrigin(request: Request): string {
  const forwardedHost = request.headers.get("x-forwarded-host");
  if (forwardedHost) {
    const forwardedProto = request.headers.get("x-forwarded-proto") ?? "https";
    return `${forwardedProto}://${forwardedHost}`;
  }
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const { jobId, caption } = (body ?? {}) as {
    jobId?: unknown;
    caption?: unknown;
  };

  if (typeof jobId !== "string") {
    return NextResponse.json(
      { error: "Нужен jobId отрендеренного видео" },
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

  // Instagram (в отличие от TikTok/YouTube) не принимает байты напрямую —
  // Meta сама забирает видео по этому адресу, поэтому он должен быть реально
  // публичным (см. комментарий в instagramApi.ts про self-signed сертификат
  // `pnpm dev:https` — для этого шага его недостаточно, нужен туннель вроде ngrok)
  const videoUrl = `${getPublicOrigin(request)}/api/render/${jobId}/download`;

  const job = startInstagramPublish({
    videoUrl,
    caption: typeof caption === "string" ? caption : "",
  });
  return NextResponse.json(job);
}
