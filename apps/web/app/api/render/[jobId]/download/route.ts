import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getRenderJob } from "@/lib/renderJobs";

export async function GET(
  _request: Request,
  ctx: RouteContext<"/api/render/[jobId]/download">
) {
  const { jobId } = await ctx.params;
  const job = getRenderJob(jobId);

  if (!job || job.status !== "done" || !job.outputPath) {
    return NextResponse.json(
      { error: "Видео ещё не готово" },
      { status: 404 }
    );
  }

  const { size } = await stat(job.outputPath);
  const stream = createReadStream(job.outputPath);
  const body = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
    cancel() {
      stream.destroy();
    },
  });

  return new NextResponse(body as unknown as BodyInit, {
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="cueme-${jobId}.mp4"`,
    },
  });
}
