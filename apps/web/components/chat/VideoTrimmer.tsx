"use client";

import { useRef, useState } from "react";
import { RotateCcwIcon } from "lucide-react";
import { useChatStore } from "@cueme/shared";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

function formatSec(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Выбор точки старта фрагмента фонового видео. Обычный HTML5 <video>
 * (не Remotion) — это UI до рендера: слайдер двигает currentTime, чтобы
 * сразу видеть кадр, с которого начнётся фрагмент. Длительность отрезка
 * не задаётся: она автоматически равна «от точки старта до конца файла»,
 * а итоговый ролик зациклит этот фрагмент сколько нужно.
 */
export function VideoTrimmer({
  backgroundId,
  url,
  durationSec,
  open,
  onOpenChange,
}: {
  backgroundId: string;
  url: string;
  durationSec: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const savedStart = useChatStore(
    (s) => s.backgroundTrimStartById[backgroundId] ?? 0
  );
  const setBackgroundTrimStart = useChatStore((s) => s.setBackgroundTrimStart);

  // сохранённое значение достаточно взять как начальное: селектор монтирует
  // триммер заново при каждом открытии (условный рендер по trimTarget)
  const [startSec, setStartSec] = useState(savedStart);
  const videoRef = useRef<HTMLVideoElement>(null);

  // оставляем минимум 1 секунду фрагмента, чтобы Loop не зациклил «ничего»
  const maxStart = Math.max(durationSec - 1, 0);

  const handleSliderChange = (value: number | readonly number[]) => {
    const v = Array.isArray(value) ? value[0] : (value as number);
    setStartSec(v);
    if (videoRef.current) videoRef.current.currentTime = v;
  };

  // превью проигрывает выбранный фрагмент по кругу: доиграло до конца —
  // вернулись на точку старта
  const handleEnded = () => {
    if (!videoRef.current) return;
    videoRef.current.currentTime = startSec;
    videoRef.current.play().catch(() => {});
  };

  const handleSave = () => {
    setBackgroundTrimStart(backgroundId, startSec);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Фрагмент фонового видео</DialogTitle>
          <DialogDescription>
            Выбери, с какой секунды видео начнётся в ролике. Фрагмент
            от этой точки до конца файла будет зациклен.
          </DialogDescription>
        </DialogHeader>

        <video
          ref={videoRef}
          src={url}
          muted
          playsInline
          controls
          onEnded={handleEnded}
          onLoadedMetadata={() => {
            if (videoRef.current) videoRef.current.currentTime = startSec;
          }}
          className="max-h-72 w-full rounded-lg bg-black object-contain"
        />

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Точка старта</Label>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatSec(startSec)} / {formatSec(durationSec)} (фрагмент{" "}
              {formatSec(Math.max(durationSec - startSec, 0))})
            </span>
          </div>
          <Slider
            value={[Math.min(startSec, maxStart)]}
            onValueChange={handleSliderChange}
            min={0}
            max={maxStart}
            step={0.1}
          />
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => handleSliderChange(0)}
            disabled={startSec === 0}
          >
            <RotateCcwIcon /> С начала
          </Button>
          <Button type="button" onClick={handleSave}>
            Сохранить фрагмент
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
