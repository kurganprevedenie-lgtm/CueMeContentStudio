"use client";

import { useRef, useState } from "react";
import { ImageIcon, XIcon } from "lucide-react";
import { useChatStore, type ParticipantIndex } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function MessageForm() {
  const participants = useChatStore((s) => s.participants);
  const addMessage = useChatStore((s) => s.addMessage);
  const [activeIndex, setActiveIndex] = useState<ParticipantIndex>(0);
  const [text, setText] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageAspectRatio, setImageAspectRatio] = useState<number | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = text.trim().length > 0 || imageUrl !== null;

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // сбрасываем value сразу — иначе повторный выбор того же файла не вызовет onChange
    event.target.value = "";
    if (!file) return;

    // <img>/Remotion <Img> не умеют показывать HEIC/HEIF (формат камеры
    // iPhone по умолчанию) — та же проверка, что в ParticipantsEditor.tsx
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.(heic|heif)$/i.test(file.name);
    if (isHeic) {
      setImageError(
        "HEIC не поддерживается — выбери JPG или PNG. На iPhone: при отправке фото выбери «Наибольшая совместимость», или Настройки → Камера → Форматы → «Наиболее совместимые»."
      );
      return;
    }
    setImageError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      const dataUrl = reader.result;
      // Реальное соотношение сторон — как и с длительностью аудио, не
      // оцениваем на глаз, а измеряем сам файл (нужно для точной высоты
      // пузыря в рендере, см. packages/remotion/src/cardHeight.ts)
      const img = new window.Image();
      img.onload = () => {
        setImageUrl(dataUrl);
        setImageAspectRatio(img.naturalWidth / img.naturalHeight);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const clearImage = () => {
    setImageUrl(null);
    setImageAspectRatio(null);
    setImageError(null);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    addMessage({
      participantIndex: activeIndex,
      text: text.trim(),
      imageUrl: imageUrl ?? undefined,
      imageAspectRatio: imageAspectRatio ?? undefined,
    });
    setText("");
    clearImage();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новое сообщение</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2">
            {participants.map((participant, index) => {
              const idx = index as ParticipantIndex;
              const active = activeIndex === idx;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-left transition-colors",
                    active
                      ? "border-primary bg-primary/10"
                      : "border-border hover:bg-muted"
                  )}
                >
                  <Avatar size="default">
                    {participant.avatarUrl ? (
                      <AvatarImage
                        src={participant.avatarUrl}
                        alt={participant.name}
                      />
                    ) : null}
                    <AvatarFallback>
                      {participant.name.charAt(0).toUpperCase() || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm font-medium">
                    {participant.name || `Участник ${idx + 1}`}
                  </span>
                </button>
              );
            })}
          </div>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Ты не поверишь, что сейчас было…"
            rows={3}
            autoFocus
          />
          {imageUrl ? (
            <div className="relative w-fit">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt=""
                className="max-h-40 rounded-lg border border-border object-contain"
              />
              <button
                type="button"
                onClick={clearImage}
                aria-label="Убрать фото"
                className="absolute -top-2 -right-2 flex size-6 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-80"
              >
                <XIcon className="size-3.5" />
              </button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="w-fit"
              onClick={() => fileInputRef.current?.click()}
            >
              <ImageIcon className="size-4" />
              Прикрепить фото
            </Button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageChange}
            className="hidden"
          />
          {imageError ? (
            <p className="text-xs break-words text-destructive">{imageError}</p>
          ) : null}
          <Button type="submit" disabled={!canSubmit}>
            Добавить в диалог
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
