"use client";

import { useRef, useState } from "react";
import { Player } from "@remotion/player";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { ClapperboardIcon, DownloadIcon, Loader2Icon } from "lucide-react";
import { themes, useChatStore } from "@cueme/shared";
import {
  ChatVideo,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  totalDurationInFrames,
  type MessageTiming,
} from "@cueme/remotion";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Пауза для сообщений без озвучки, сек (не оценка аудио — просто темп чтения) */
const SILENT_DURATION_SEC = 1.8;
/** Пауза между репликами, сек */
const GAP_SEC = 0.3;
/** Отступ перед первой репликой, сек */
const LEAD_IN_SEC = 0.5;

export function VideoPreview() {
  const messages = useChatStore((s) => s.messages);
  const themeId = useChatStore((s) => s.themeId);
  const theme = themes[themeId];

  const [timings, setTimings] = useState<MessageTiming[] | null>(null);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type ExportState =
    | { status: "idle" }
    | { status: "processing"; progress: number }
    | { status: "done"; jobId: string }
    | { status: "error"; message: string };
  const [exportState, setExportState] = useState<ExportState>({
    status: "idle",
  });
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const buildTimings = async () => {
    setBuilding(true);
    setError(null);
    try {
      const result: MessageTiming[] = [];
      let cursor = LEAD_IN_SEC;
      for (const message of messages) {
        // длительность — только из реального аудиофайла, никаких оценок по тексту
        const durationSec = message.audioUrl
          ? await getAudioDurationInSeconds(message.audioUrl)
          : SILENT_DURATION_SEC;
        result.push({ id: message.id, startSec: cursor, durationSec });
        cursor += durationSec + GAP_SEC;
      }
      setTimings(result);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBuilding(false);
    }
  };

  const pollStatus = (jobId: string) => {
    fetch(`/api/render/${jobId}`)
      .then((r) => r.json())
      .then((data: { status: string; progress: number; error?: string }) => {
        if (data.status === "done") {
          setExportState({ status: "done", jobId });
        } else if (data.status === "error") {
          setExportState({
            status: "error",
            message: data.error ?? "Не удалось отрендерить видео",
          });
        } else {
          setExportState({ status: "processing", progress: data.progress });
          pollRef.current = setTimeout(() => pollStatus(jobId), 1000);
        }
      })
      .catch((e: unknown) => {
        setExportState({
          status: "error",
          message: e instanceof Error ? e.message : String(e),
        });
      });
  };

  const startExport = async () => {
    if (!timings) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    setExportState({ status: "processing", progress: 0 });
    try {
      const res = await fetch("/api/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, theme, timings }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      const { jobId } = await res.json();
      pollStatus(jobId);
    } catch (e: unknown) {
      setExportState({
        status: "error",
        message: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Видео-превью</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        {timings ? (
          <Player
            component={ChatVideo}
            inputProps={{ messages, theme, timings }}
            durationInFrames={totalDurationInFrames(timings)}
            fps={VIDEO_FPS}
            compositionWidth={VIDEO_WIDTH}
            compositionHeight={VIDEO_HEIGHT}
            controls
            style={{ width: 288, height: 512, borderRadius: 16 }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">
            Собери диалог (лучше с озвучкой) и нажми кнопку — здесь появится
            плеер с видео
          </p>
        )}
        <Button
          type="button"
          className="w-full"
          disabled={building || messages.length === 0}
          onClick={buildTimings}
        >
          {building ? (
            <>
              <Loader2Icon className="size-4 animate-spin" /> Считаю тайминг…
            </>
          ) : (
            <>
              <ClapperboardIcon className="size-4" />
              {timings ? "Обновить видео" : "Собрать видео"}
            </>
          )}
        </Button>
        {error ? (
          <p className="text-sm break-words text-destructive">{error}</p>
        ) : null}

        {timings ? (
          <div className="flex w-full flex-col gap-2 border-t pt-4">
            {exportState.status === "done" ? (
              <a
                href={`/api/render/${exportState.jobId}/download`}
                download
                className={buttonVariants({ className: "w-full" })}
              >
                <DownloadIcon className="size-4" /> Скачать .mp4
              </a>
            ) : (
              <Button
                type="button"
                className="w-full"
                disabled={exportState.status === "processing"}
                onClick={startExport}
              >
                {exportState.status === "processing" ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Рендерю видео… {Math.round(exportState.progress * 100)}%
                  </>
                ) : (
                  <>
                    <ClapperboardIcon className="size-4" />
                    Экспортировать в .mp4
                  </>
                )}
              </Button>
            )}
            {exportState.status === "error" ? (
              <p className="text-sm break-words text-destructive">
                {exportState.message}
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              Рендер идёт на сервере и может занять от десятков секунд до
              нескольких минут — страницу можно не перезагружать
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
