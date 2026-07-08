"use client";

import { useEffect, useRef, useState } from "react";
import {
  Loader2Icon,
  ScissorsIcon,
  Trash2Icon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import { useChatStore } from "@cueme/shared";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { VideoTrimmer } from "@/components/chat/VideoTrimmer";
import { cn } from "@/lib/utils";

interface BackgroundVideoInfo {
  id: string;
  name: string;
  url: string;
  durationSec: number;
  width: number;
  height: number;
}

const MAX_UPLOAD_MB = 200;

export function BackgroundVideoSelector() {
  const backgroundId = useChatStore((s) => s.background.backgroundId);
  const volume = useChatStore((s) => s.background.volume);
  const overlayOpacity = useChatStore((s) => s.background.overlayOpacity);
  const setBackgroundId = useChatStore((s) => s.setBackgroundId);
  const setBackgroundVolume = useChatStore((s) => s.setBackgroundVolume);
  const setBackgroundOverlayOpacity = useChatStore(
    (s) => s.setBackgroundOverlayOpacity
  );
  const trimStartById = useChatStore((s) => s.backgroundTrimStartById);
  const forgetBackground = useChatStore((s) => s.forgetBackground);

  const [backgrounds, setBackgrounds] = useState<BackgroundVideoInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BackgroundVideoInfo | null>(
    null
  );
  const [deleting, setDeleting] = useState(false);
  const [trimTarget, setTrimTarget] = useState<BackgroundVideoInfo | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadBackgrounds = () => {
    fetch("/api/backgrounds")
      .then((r) => r.json())
      .then((data: { backgrounds: BackgroundVideoInfo[] }) =>
        setBackgrounds(data.backgrounds ?? [])
      )
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : String(e))
      )
      .finally(() => setLoading(false));
  };

  useEffect(loadBackgrounds, []);

  const uploadFile = async (file: File) => {
    setError(null);
    if (!/\.(mp4|mov)$/i.test(file.name)) {
      setError("Поддерживаются только файлы .mp4 и .mov");
      return;
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      setError(`Файл больше ${MAX_UPLOAD_MB}MB`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/backgrounds", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setBackgrounds((prev) => [...prev, data.background]);
      setBackgroundId(data.background.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const handleFileInput = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) void uploadFile(file);
    event.target.value = "";
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void uploadFile(file);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setError(null);
    setDeleting(true);
    try {
      const res = await fetch(
        `/api/backgrounds/${encodeURIComponent(deleteTarget.id)}`,
        { method: "DELETE" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      // обновляем список без перезагрузки страницы + чистим выбор/trim в сторе
      setBackgrounds((prev) => prev.filter((b) => b.id !== deleteTarget.id));
      forgetBackground(deleteTarget.id);
      setDeleteTarget(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Фоновое видео</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setBackgroundId(null)}
            className={cn(
              "flex aspect-[9/16] items-center justify-center rounded-lg border text-xs text-muted-foreground transition-colors",
              backgroundId === null
                ? "border-primary bg-primary/10"
                : "border-border hover:bg-muted"
            )}
          >
            Без фона
          </button>
          {backgrounds.map((bg) => {
            const trimStart = trimStartById[bg.id] ?? 0;
            return (
              <div
                key={bg.id}
                className={cn(
                  "group relative aspect-[9/16] overflow-hidden rounded-lg border transition-colors",
                  backgroundId === bg.id
                    ? "border-primary ring-2 ring-primary"
                    : "border-border"
                )}
              >
                <button
                  type="button"
                  onClick={() => setBackgroundId(bg.id)}
                  className="h-full w-full hover:opacity-80"
                  title={bg.name}
                >
                  <video
                    src={bg.url}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                </button>
                {/* на десктопе иконки появляются при наведении, на тач-экранах видимы всегда */}
                <div className="absolute top-1 right-1 flex gap-1 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                  <Button
                    type="button"
                    variant="secondary"
                    size="icon-xs"
                    aria-label={`Выбрать фрагмент — ${bg.name}`}
                    onClick={() => setTrimTarget(bg)}
                  >
                    <ScissorsIcon />
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon-xs"
                    aria-label={`Удалить — ${bg.name}`}
                    onClick={() => setDeleteTarget(bg)}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
                {trimStart > 0 ? (
                  <span className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                    с {Math.round(trimStart)}с
                  </span>
                ) : null}
              </div>
            );
          })}
          {loading ? (
            <div className="flex aspect-[9/16] items-center justify-center rounded-lg border border-dashed text-muted-foreground">
              <Loader2Icon className="size-4 animate-spin" />
            </div>
          ) : null}
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "flex cursor-pointer flex-col items-center gap-2 rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground transition-colors",
            dragOver && "border-primary bg-primary/5"
          )}
        >
          {uploading ? (
            <>
              <Loader2Icon className="size-5 animate-spin" />
              Загружаю…
            </>
          ) : (
            <>
              <UploadIcon className="size-5" />
              Перетащи .mp4/.mov сюда или нажми, чтобы выбрать
              <span className="text-xs">до {MAX_UPLOAD_MB}MB</span>
            </>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/mp4,video/quicktime,.mp4,.mov"
            onChange={handleFileInput}
            className="hidden"
          />
        </div>

        {error ? (
          <p className="text-sm break-words text-destructive">{error}</p>
        ) : null}

        {backgroundId !== null ? (
          <>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Громкость фона</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(volume * 100)}%
                </span>
              </div>
              <Slider
                value={[volume * 100]}
                onValueChange={(v) =>
                  setBackgroundVolume((Array.isArray(v) ? v[0] : v) / 100)
                }
                min={0}
                max={100}
                step={1}
              />
            </div>
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>Затемнение поверх видео</Label>
                <span className="text-xs text-muted-foreground">
                  {Math.round(overlayOpacity * 100)}%
                </span>
              </div>
              <Slider
                value={[overlayOpacity * 100]}
                onValueChange={(v) =>
                  setBackgroundOverlayOpacity(
                    (Array.isArray(v) ? v[0] : v) / 100
                  )
                }
                min={0}
                max={100}
                step={1}
              />
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setBackgroundId(null)}
            >
              <XIcon /> Убрать фон
            </Button>
          </>
        ) : null}

        <AlertDialog
          open={deleteTarget !== null}
          onOpenChange={(open) => {
            if (!open) setDeleteTarget(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Удалить это фоновое видео?</AlertDialogTitle>
              <AlertDialogDescription>
                «{deleteTarget?.name}» будет удалено из библиотеки. Это
                действие нельзя отменить.
                {deleteTarget && deleteTarget.id === backgroundId
                  ? " Это видео сейчас выбрано фоном текущего ролика — выбор сбросится."
                  : ""}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" /> Удаляю…
                  </>
                ) : (
                  "Удалить"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {trimTarget ? (
          <VideoTrimmer
            backgroundId={trimTarget.id}
            url={trimTarget.url}
            durationSec={trimTarget.durationSec}
            open
            onOpenChange={(open) => {
              if (!open) setTrimTarget(null);
            }}
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
