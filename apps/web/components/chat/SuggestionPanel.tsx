"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlayIcon, XIcon } from "lucide-react";
import { useChatStore } from "@cueme/shared";

import { generateVoice, getVoices, type VoiceOption } from "@/actions/elevenlabs";
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
import { Textarea } from "@/components/ui/textarea";

/** Сентинел для «после последнего сообщения» — Select не умеет в value=null для пункта списка */
const AUTO_ANCHOR = "__auto__";

export function SuggestionPanel() {
  const messages = useChatStore((s) => s.messages);
  const suggestion = useChatStore((s) => s.suggestion);
  const setSuggestionText = useChatStore((s) => s.setSuggestionText);
  const setSuggestionAnchor = useChatStore((s) => s.setSuggestionAnchor);
  const setSuggestionVoice = useChatStore((s) => s.setSuggestionVoice);
  const setSuggestionAudio = useChatStore((s) => s.setSuggestionAudio);
  const clearSuggestionAudio = useChatStore((s) => s.clearSuggestionAudio);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicing, setVoicing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getVoices()
      .then((list) => {
        if (!cancelled) setVoices(list);
      })
      .catch(() => {
        // ошибка и так видна в панели «Озвучка» — здесь просто не даём выбрать голос
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const voiceItems = useMemo(
    () => Object.fromEntries(voices.map((v) => [v.id, v.name])),
    [voices]
  );

  const anchorItems = useMemo(() => {
    const items: Record<string, string> = {
      [AUTO_ANCHOR]: "После последнего сообщения (авто)",
    };
    messages.forEach((m, i) => {
      const preview = m.text.length > 28 ? `${m.text.slice(0, 28)}…` : m.text;
      items[m.id] = `${i + 1}. ${m.sender}: ${preview}`;
    });
    return items;
  }, [messages]);

  const handleVoiceOver = async () => {
    if (!suggestion.text.trim() || !suggestion.voiceId) return;
    setError(null);
    setVoicing(true);
    try {
      const audioUrl = await generateVoice(
        suggestion.text.trim(),
        suggestion.voiceId
      );
      setSuggestionAudio(audioUrl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setVoicing(false);
    }
  };

  const playPreview = () => {
    if (!suggestion.audioUrl) return;
    new Audio(suggestion.audioUrl).play().catch(() => {});
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Подсказка от CueMe</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="suggestion-text">Текст подсказки</Label>
          <Textarea
            id="suggestion-text"
            value={suggestion.text}
            onChange={(e) => setSuggestionText(e.target.value)}
            placeholder="Если бы ты был овощем, ты был бы огурчиком"
            rows={2}
          />
        </div>

        {messages.length > 0 ? (
          <div className="grid gap-2">
            <Label htmlFor="suggestion-anchor">Показать после сообщения</Label>
            <Select
              items={anchorItems}
              value={suggestion.afterMessageId ?? AUTO_ANCHOR}
              onValueChange={(value) =>
                setSuggestionAnchor(
                  value === AUTO_ANCHOR ? null : (value as string)
                )
              }
            >
              <SelectTrigger id="suggestion-anchor">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(anchorItems).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : null}

        <div className="grid gap-2">
          <Label htmlFor="suggestion-voice">Голос подсказки</Label>
          <div className="flex items-center gap-2">
            <Select
              items={voiceItems}
              value={suggestion.voiceId ?? null}
              onValueChange={(value) => setSuggestionVoice(value as string)}
            >
              <SelectTrigger id="suggestion-voice" className="flex-1">
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
            {suggestion.audioUrl ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                aria-label="Послушать подсказку"
                onClick={playPreview}
              >
                <PlayIcon />
              </Button>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Button
            type="button"
            disabled={voicing || !suggestion.text.trim() || !suggestion.voiceId}
            onClick={handleVoiceOver}
          >
            {voicing ? (
              <>
                <Loader2Icon className="size-4 animate-spin" /> Озвучиваю…
              </>
            ) : suggestion.audioUrl ? (
              "Переозвучить подсказку"
            ) : (
              "Озвучить подсказку"
            )}
          </Button>
          {suggestion.audioUrl ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearSuggestionAudio}
            >
              <XIcon /> Убрать озвучку
            </Button>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm break-words text-destructive">{error}</p>
        ) : null}
        <p className="text-xs text-muted-foreground">
          Подсказка появится в видео как бейдж с логотипом CueMe снизу экрана
          и плавно исчезнет — на живой чат-превью выше она не влияет.
        </p>
      </CardContent>
    </Card>
  );
}
