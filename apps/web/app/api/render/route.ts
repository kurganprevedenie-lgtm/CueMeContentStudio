import { NextResponse } from "next/server";

import { startRender } from "@/lib/renderJobs";

export async function POST(request: Request) {
  const body = await request.json();
  const {
    messages,
    theme,
    timings,
    suggestion,
    suggestionTiming,
    background,
    layout,
  } = body ?? {};

  if (!Array.isArray(messages) || !theme || !Array.isArray(timings)) {
    return NextResponse.json(
      { error: "Нужны messages[], theme и timings[]" },
      { status: 400 }
    );
  }

  // Рендер видео — тяжёлая асинхронная операция: сразу возвращаем id задачи,
  // сам процесс идёт в фоне (см. ARCHITECTURE.md — статус-модель processing/done/error)
  const job = startRender({
    messages,
    theme,
    timings,
    suggestion: suggestion ?? null,
    suggestionTiming: suggestionTiming ?? null,
    background: background ?? null,
    layout: layout ?? null,
  });

  return NextResponse.json({ jobId: job.id, status: job.status });
}
