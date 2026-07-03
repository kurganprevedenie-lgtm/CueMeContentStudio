"use client";

import { useState } from "react";
import { Player } from "@remotion/player";
import { getAudioDurationInSeconds } from "@remotion/media-utils";
import { ClapperboardIcon, Loader2Icon } from "lucide-react";
import { themes, useChatStore } from "@cueme/shared";
import {
  ChatVideo,
  VIDEO_FPS,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
  totalDurationInFrames,
  type MessageTiming,
} from "@cueme/remotion";

import { Button } from "@/components/ui/button";
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
      </CardContent>
    </Card>
  );
}
