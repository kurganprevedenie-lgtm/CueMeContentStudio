"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  type BackgroundVideoContent,
  type MessageTiming,
  type SuggestionContent,
  type SuggestionTiming,
} from "@cueme/remotion";

import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/** Пауза для сообщений без озвучки, сек (не оценка аудио — просто темп чтения) */
const SILENT_DURATION_SEC = 1.8;
/** Пауза между репликами, сек */
const GAP_SEC = 0.3;
/** Отступ перед первой репликой, сек */
const LEAD_IN_SEC = 0.5;
/** Сколько бейдж-подсказка висит на экране, если её не озвучили */
const SUGGESTION_SILENT_DURATION_SEC = 2.5;
/** Пауза до и после бейджа-подсказки, сек (место на fade in/out) */
const SUGGESTION_GAP_SEC = 0.4;

interface BackgroundVideoInfo {
  id: string;
  url: string;
  durationSec: number;
}

export function VideoPreview() {
  const messages = useChatStore((s) => s.messages);
  const themeId = useChatStore((s) => s.themeId);
  const theme = themes[themeId];
  const suggestion = useChatStore((s) => s.suggestion);
  const backgroundSettings = useChatStore((s) => s.background);

  const [timings, setTimings] = useState<MessageTiming[] | null>(null);
  const [suggestionTiming, setSuggestionTiming] =
    useState<SuggestionTiming | null>(null);
  const [suggestionContent, setSuggestionContent] =
    useState<SuggestionContent | null>(null);
  const [backgroundsList, setBackgroundsList] = useState<
    BackgroundVideoInfo[]
  >([]);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // перезапрашиваем список при каждой смене выбора — если фон только что
    // загрузили и тут же выбрали, список, полученный при монтировании,
    // ещё не знал о нём
    fetch("/api/backgrounds")
      .then((r) => r.json())
      .then((data: { backgrounds: BackgroundVideoInfo[] }) =>
        setBackgroundsList(data.backgrounds ?? [])
      )
      .catch(() => {
        // фон необязателен — если список не загрузился, просто не показываем видео-фон
      });
  }, [backgroundSettings.backgroundId]);

  // фон не завязан на тайминги сообщений — пересчитывается сразу при смене
  // выбора/громкости/затемнения, без нажатия «Собрать видео»
  const backgroundContent = useMemo<BackgroundVideoContent | null>(() => {
    if (!backgroundSettings.backgroundId) return null;
    const found = backgroundsList.find(
      (b) => b.id === backgroundSettings.backgroundId
    );
    if (!found) return null;
    return {
      url: found.url,
      durationInFrames: Math.max(
        Math.round(found.durationSec * VIDEO_FPS),
        1
      ),
      volume: backgroundSettings.volume,
      overlayOpacity: backgroundSettings.overlayOpacity,
    };
  }, [backgroundSettings, backgroundsList]);

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
      const hasSuggestion = suggestion.text.trim().length > 0;
      // "авто" — снимок того, какое сообщение сейчас последнее; конкретный якорь
      // фиксирует подсказку между этим сообщением и следующими
      const resolvedAnchorId = hasSuggestion
        ? (suggestion.afterMessageId ?? messages[messages.length - 1]?.id ?? null)
        : null;

      const result: MessageTiming[] = [];
      let nextSuggestionTiming: SuggestionTiming | null = null;
      let cursor = LEAD_IN_SEC;

      for (const message of messages) {
        // длительность — только из реального аудиофайла, никаких оценок по тексту
        const durationSec = message.audioUrl
          ? await getAudioDurationInSeconds(message.audioUrl)
          : SILENT_DURATION_SEC;
        result.push({ id: message.id, startSec: cursor, durationSec });
        cursor += durationSec + GAP_SEC;

        if (hasSuggestion && message.id === resolvedAnchorId) {
          const suggestionDurationSec = suggestion.audioUrl
            ? await getAudioDurationInSeconds(suggestion.audioUrl)
            : SUGGESTION_SILENT_DURATION_SEC;
          cursor += SUGGESTION_GAP_SEC;
          nextSuggestionTiming = { startSec: cursor, durationSec: suggestionDurationSec };
          cursor += suggestionDurationSec + SUGGESTION_GAP_SEC;
        }
      }

      setTimings(result);
      setSuggestionTiming(nextSuggestionTiming);
      setSuggestionContent(
        hasSuggestion
          ? { text: suggestion.text.trim(), audioUrl: suggestion.audioUrl }
          : null
      );
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
        body: JSON.stringify({
          messages,
          theme,
          timings,
          suggestion: suggestionContent,
          suggestionTiming,
          background: backgroundContent,
        }),
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
            inputProps={{
              messages,
              theme,
              timings,
              suggestion: suggestionContent,
              suggestionTiming,
              background: backgroundContent,
            }}
            durationInFrames={totalDurationInFrames(timings, suggestionTiming)}
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
