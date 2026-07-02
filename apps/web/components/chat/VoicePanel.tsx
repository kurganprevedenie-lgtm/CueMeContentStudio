"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2Icon, PlayIcon, Trash2Icon } from "lucide-react";
import { useChatStore } from "@cueme/shared";

import {
  generateVoice,
  getCredits,
  getVoices,
  type CreditsInfo,
  type VoiceOption,
} from "@/actions/elevenlabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function VoicePanel() {
  const messages = useChatStore((s) => s.messages);
  const voiceBySender = useChatStore((s) => s.voiceBySender);
  const setVoice = useChatStore((s) => s.setVoice);
  const setMessageAudio = useChatStore((s) => s.setMessageAudio);
  const clearAudio = useChatStore((s) => s.clearAudio);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicesError, setVoicesError] = useState<string | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);
  const [credits, setCredits] = useState<CreditsInfo | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<HTMLAudioElement | null>(null);

  const participants = useMemo(
    () => [...new Set(messages.map((m) => m.sender))],
    [messages]
  );
  const pendingMessages = messages.filter((m) => !m.audioUrl);
  const pendingChars = pendingMessages.reduce(
    (sum, m) => sum + m.text.length,
    0
  );
  const hasAudio = messages.some((m) => m.audioUrl);

  useEffect(() => {
    let cancelled = false;
    getVoices()
      .then((list) => {
        if (cancelled) return;
        setVoices(list);
        setVoicesError(null);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setVoicesError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoadingVoices(false);
      });
    getCredits()
      .then((c) => {
        if (!cancelled) setCredits(c);
      })
      .catch(() => {
        // нет права User Read у ключа — просто не показываем остаток
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // участникам без голоса назначаем первый из списка, чтобы всё работало сразу
  useEffect(() => {
    if (voices.length === 0) return;
    for (const p of participants) {
      if (!voiceBySender[p]) setVoice(p, voices[0].id);
    }
  }, [voices, participants, voiceBySender, setVoice]);

  const voiceItems = useMemo(
    () => Object.fromEntries(voices.map((v) => [v.id, v.name])),
    [voices]
  );

  const playPreview = (url?: string) => {
    if (!url) return;
    previewRef.current?.pause();
    previewRef.current = new Audio(url);
    void previewRef.current.play();
  };

  const handleGenerate = async () => {
    setError(null);
    setGenerating(true);
    setProgress({ done: 0, total: pendingMessages.length });
    try {
      for (const message of pendingMessages) {
        const voiceId = voiceBySender[message.sender];
        if (!voiceId) continue;
        const audioUrl = await generateVoice(message.text, voiceId);
        setMessageAudio(message.id, audioUrl);
        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }
      getCredits()
        .then(setCredits)
        .catch(() => {});
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Озвучка (ElevenLabs)</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {loadingVoices ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2Icon className="size-4 animate-spin" /> Загружаю голоса…
          </p>
        ) : voicesError ? (
          <p className="text-sm break-words text-destructive">{voicesError}</p>
        ) : participants.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Добавь сообщения — здесь появится выбор голосов для участников
          </p>
        ) : (
          <>
            {participants.map((participant) => {
              const selected = voices.find(
                (v) => v.id === voiceBySender[participant]
              );
              return (
                <div key={participant} className="grid gap-2">
                  <Label htmlFor={`voice-${participant}`}>
                    Голос — {participant}
                  </Label>
                  <div className="flex items-center gap-2">
                    <Select
                      items={voiceItems}
                      value={voiceBySender[participant] ?? null}
                      onValueChange={(value) =>
                        setVoice(participant, value as string)
                      }
                    >
                      <SelectTrigger
                        id={`voice-${participant}`}
                        className="flex-1"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {voices.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Послушать голос ${selected?.name ?? ""}`}
                      disabled={!selected?.previewUrl}
                      onClick={() => playPreview(selected?.previewUrl)}
                    >
                      <PlayIcon />
                    </Button>
                  </div>
                </div>
              );
            })}

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                disabled={generating || pendingMessages.length === 0}
                onClick={handleGenerate}
              >
                {generating ? (
                  <>
                    <Loader2Icon className="size-4 animate-spin" />
                    Озвучиваю {progress.done}/{progress.total}…
                  </>
                ) : pendingMessages.length === 0 ? (
                  "Всё озвучено"
                ) : (
                  `Озвучить ${pendingMessages.length} сообщ. (≈ ${pendingChars} кредитов)`
                )}
              </Button>
              {hasAudio ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={clearAudio}
                >
                  <Trash2Icon /> Сбросить озвучку
                </Button>
              ) : null}
            </div>

            {credits ? (
              <p className="text-xs text-muted-foreground">
                Кредиты ElevenLabs: осталось{" "}
                {(credits.limit - credits.used).toLocaleString("ru-RU")} из{" "}
                {credits.limit.toLocaleString("ru-RU")}
              </p>
            ) : null}
            {error ? (
              <p className="text-sm break-words text-destructive">{error}</p>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  );
}
