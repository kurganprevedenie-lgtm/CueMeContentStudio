"use client";

import { useRef, useState } from "react";
import { useChatStore, type ParticipantIndex } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function ParticipantCard({ index }: { index: ParticipantIndex }) {
  const participant = useChatStore((s) => s.participants[index]);
  const setParticipant = useChatStore((s) => s.setParticipant);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // сбрасываем value сразу — иначе повторный выбор того же файла
    // (например, после конвертации HEIC→JPEG) не вызовет onChange
    event.target.value = "";
    if (!file) return;

    // <img> не умеет показывать HEIC/HEIF (формат камеры iPhone по умолчанию) —
    // ни в браузере, ни в headless Chrome при серверном рендере видео
    const isHeic =
      file.type === "image/heic" ||
      file.type === "image/heif" ||
      /\.(heic|heif)$/i.test(file.name);
    if (isHeic) {
      setAvatarError(
        "HEIC не поддерживается — выбери JPG или PNG. На iPhone: при отправке фото выбери «Наибольшая совместимость», или Настройки → Камера → Форматы → «Наиболее совместимые»."
      );
      return;
    }
    setAvatarError(null);

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setParticipant(index, { avatarUrl: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="cursor-pointer rounded-full transition-opacity hover:opacity-80"
        aria-label={`Загрузить аватарку — ${participant.name || `участник ${index + 1}`}`}
      >
        <Avatar size="lg">
          {participant.avatarUrl ? (
            <AvatarImage src={participant.avatarUrl} alt={participant.name} />
          ) : null}
          <AvatarFallback>
            {participant.name.charAt(0).toUpperCase() || "?"}
          </AvatarFallback>
        </Avatar>
      </button>
      <Input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        className="hidden"
      />
      {avatarError ? (
        <p className="max-w-40 text-center text-xs break-words text-destructive">
          {avatarError}
        </p>
      ) : null}
      <div className="grid w-full gap-1.5">
        <Label htmlFor={`participant-name-${index}`} className="sr-only">
          Имя участника {index + 1}
        </Label>
        <Input
          id={`participant-name-${index}`}
          value={participant.name}
          onChange={(e) => setParticipant(index, { name: e.target.value })}
          placeholder={`Участник ${index + 1}`}
          className="text-center"
        />
      </div>
    </div>
  );
}

export function ParticipantsEditor() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Участники переписки</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-4">
        <ParticipantCard index={0} />
        <ParticipantCard index={1} />
      </CardContent>
    </Card>
  );
}
