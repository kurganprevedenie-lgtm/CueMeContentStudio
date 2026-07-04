import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ChatTheme, Message } from "@cueme/shared";
import type { MessageTiming } from "@cueme/remotion";

export type RenderStatus = "processing" | "done" | "error";

export interface RenderJob {
  id: string;
  status: RenderStatus;
  progress: number;
  outputPath?: string;
  error?: string;
}

const jobs = new Map<string, RenderJob>();
const OUTPUT_DIR = path.join(os.tmpdir(), "cueme-renders");

// Бандл Remotion собирается один раз и переиспользуется между рендерами —
// сборка занимает секунды, гонять её на каждый запрос не нужно
let bundlePromise: Promise<string> | null = null;

function getBundle(): Promise<string> {
  if (!bundlePromise) {
    const entryPoint = path.join(
      process.cwd(),
      "..",
      "..",
      "packages",
      "remotion",
      "src",
      "entry.ts"
    );
    bundlePromise = bundle({ entryPoint }).catch((e) => {
      bundlePromise = null;
      throw e;
    });
  }
  return bundlePromise;
}

export function getRenderJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export interface StartRenderInput {
  messages: Message[];
  theme: ChatTheme;
  timings: MessageTiming[];
}

export function startRender(input: StartRenderInput): RenderJob {
  const id = randomUUID();
  const job: RenderJob = { id, status: "processing", progress: 0 };
  jobs.set(id, job);

  void runRender(job, input);

  return job;
}

async function runRender(job: RenderJob, input: StartRenderInput) {
  try {
    const serveUrl = await getBundle();
    const inputProps = {
      messages: input.messages,
      theme: input.theme,
      timings: input.timings,
    };

    const composition = await selectComposition({
      serveUrl,
      id: "ChatVideo",
      inputProps,
    });

    await mkdir(OUTPUT_DIR, { recursive: true });
    const outputPath = path.join(OUTPUT_DIR, `${job.id}.mp4`);

    await renderMedia({
      serveUrl,
      composition,
      codec: "h264",
      outputLocation: outputPath,
      inputProps,
      onProgress: ({ progress }) => {
        job.progress = progress;
      },
    });

    job.status = "done";
    job.progress = 1;
    job.outputPath = outputPath;
  } catch (e: unknown) {
    job.status = "error";
    job.error = e instanceof Error ? e.message : String(e);
  }
}

/** Рендеры живут только в рамках процесса сервера — чистим файл после скачивания или через час */
export async function cleanupJob(id: string) {
  const job = jobs.get(id);
  if (job?.outputPath) {
    await rm(job.outputPath, { force: true });
  }
  jobs.delete(id);
}
