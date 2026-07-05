import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import type { ChatTheme, Message } from "@cueme/shared";
import type {
  MessageTiming,
  SuggestionContent,
  SuggestionTiming,
} from "@cueme/remotion";

export type RenderStatus = "processing" | "done" | "error";

export interface RenderJob {
  id: string;
  status: RenderStatus;
  progress: number;
  outputPath?: string;
  error?: string;
}

const OUTPUT_DIR = path.join(os.tmpdir(), "cueme-renders");

// В dev-режиме Next.js/Turbopack может собрать разные API-роуты как отдельные
// экземпляры модуля — обычная переменная модуля в таком случае не была бы общей
// между POST /api/render и GET /api/render/[jobId]. Держим состояние на globalThis,
// чтобы оно гарантированно было одно на весь процесс сервера.
declare global {
  var __cuemeRenderJobs: Map<string, RenderJob> | undefined;
  var __cuemeRenderBundle: Promise<string> | null | undefined;
}

const jobs = globalThis.__cuemeRenderJobs ?? new Map<string, RenderJob>();
globalThis.__cuemeRenderJobs = jobs;

// Бандл Remotion собирается заново на каждый рендер в dev-режиме — иначе
// правки в packages/remotion или в apps/web/public (например, замена логотипа)
// не будут видны в экспортированном видео, пока не перезапустишь сервер.
// В проде (единственный процесс, код не меняется на лету) собираем один раз
// и переиспользуем — сборка занимает секунды, гонять её на каждый запрос не нужно.
function getBundle(): Promise<string> {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd || !globalThis.__cuemeRenderBundle) {
    const entryPoint = path.join(
      process.cwd(),
      "..",
      "..",
      "packages",
      "remotion",
      "src",
      "entry.ts"
    );
    // publicDir = apps/web/public — оттуда же логотип отдаётся браузерному Player,
    // чтобы серверный рендер видел ровно тот же файл
    globalThis.__cuemeRenderBundle = bundle({
      entryPoint,
      publicDir: path.join(process.cwd(), "public"),
    }).catch((e) => {
      globalThis.__cuemeRenderBundle = null;
      throw e;
    });
  }
  return globalThis.__cuemeRenderBundle;
}

export function getRenderJob(id: string): RenderJob | undefined {
  return jobs.get(id);
}

export interface StartRenderInput {
  messages: Message[];
  theme: ChatTheme;
  timings: MessageTiming[];
  suggestion?: SuggestionContent | null;
  suggestionTiming?: SuggestionTiming | null;
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
      suggestion: input.suggestion ?? null,
      suggestionTiming: input.suggestionTiming ?? null,
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
