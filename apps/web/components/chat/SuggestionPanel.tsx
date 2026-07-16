"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2Icon, PlayIcon, SparklesIcon, XIcon } from "lucide-react";
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
/** Сентинел «сообщение не выбрано» — для селектора уведомления-подсказки */
const NO_MESSAGE_SELECTED = "__none__";

export function SuggestionPanel() {
  const messages = useChatStore((s) => s.messages);
  const themeId = useChatStore((s) => s.themeId);
  const suggestion = useChatStore((s) => s.suggestion);
  const setSuggestionText = useChatStore((s) => s.setSuggestionText);
  const setSuggestionAnchor = useChatStore((s) => s.setSuggestionAnchor);
  const setSuggestionVoice = useChatStore((s) => s.setSuggestionVoice);
  const setSuggestionAudio = useChatStore((s) => s.setSuggestionAudio);
  const clearSuggestionAudio = useChatStore((s) => s.clearSuggestionAudio);
  const setMessageHint = useChatStore((s) => s.setMessageHint);
  const setMessageHintAudio = useChatStore((s) => s.setMessageHintAudio);
  const clearMessageHintAudio = useChatStore((s) => s.clearMessageHintAudio);

  const [voices, setVoices] = useState<VoiceOption[]>([]);
  const [voicing, setVoicing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hintMessageId, setHintMessageId] = useState<string>(
    NO_MESSAGE_SELECTED
  );
  const [hintVoiceId, setHintVoiceId] = useState<string | null>(null);
  const [hintVoicing, setHintVoicing] = useState(false);
  const [hintVoiceError, setHintVoiceError] = useState<string | null>(null);

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

  const hintMessageItems = useMemo(() => {
    const items: Record<string, string> = {
      [NO_MESSAGE_SELECTED]: "Не выбрано",
    };
    messages.forEach((m, i) => {
      const preview = m.text.length > 28 ? `${m.text.slice(0, 28)}…` : m.text;
      items[m.id] = `${m.isHintMoment ? "✨ " : ""}${i + 1}. ${m.sender}: ${preview}`;
    });
    return items;
  }, [messages]);

  const hintMessage =
    hintMessageId === NO_MESSAGE_SELECTED
      ? null
      : (messages.find((m) => m.id === hintMessageId) ?? null);

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

  const handleHintVoiceOver = async () => {
    if (!hintMessage?.hintText?.trim() || !hintVoiceId) return;
    setHintVoiceError(null);
    setHintVoicing(true);
    try {
      const audioUrl = await generateVoice(
        hintMessage.hintText.trim(),
        hintVoiceId
      );
      setMessageHintAudio(hintMessage.id, audioUrl);
    } catch (e: unknown) {
      setHintVoiceError(e instanceof Error ? e.message : String(e));
    } finally {
      setHintVoicing(false);
    }
  };

  const playHintPreview = () => {
    if (!hintMessage?.hintAudioUrl) return;
    new Audio(hintMessage.hintAudioUrl).play().catch(() => {});
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

        <div className="flex flex-col gap-3 border-t pt-4">
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-4 text-muted-foreground" />
            <span className="text-sm font-medium">
              Уведомление CueMe в стиле Telegram
            </span>
          </div>
          {themeId !== "telegram-ios" ? (
            <p className="text-xs text-muted-foreground">
              Доступно только для темы «Telegram iOS» — выбери её в селекторе
              темы, чтобы настроить.
            </p>
          ) : messages.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              Сначала добавь хотя бы одно сообщение в диалог.
            </p>
          ) : (
            <>
              <div className="grid gap-2">
                <Label htmlFor="hint-message">После какого сообщения показать</Label>
                <Select
                  items={hintMessageItems}
                  value={hintMessageId}
                  onValueChange={(value) => setHintMessageId(value as string)}
                >
                  <SelectTrigger id="hint-message">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(hintMessageItems).map(([id, label]) => (
                      <SelectItem key={id} value={id}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {hintMessage ? (
                <div className="grid gap-2">
                  <Label htmlFor="hint-text">Текст уведомления</Label>
                  <Textarea
                    id="hint-text"
                    value={hintMessage.hintText ?? ""}
                    onChange={(e) =>
                      setMessageHint(hintMessage.id, e.target.value)
                    }
                    placeholder="Например: по переписке с ним ты обычно пишешь короче — вот вариант ответа"
                    rows={2}
                  />

                  <Label htmlFor="hint-voice">Голос уведомления</Label>
                  <div className="flex items-center gap-2">
                    <Select
                      items={voiceItems}
                      value={hintVoiceId}
                      onValueChange={(value) => setHintVoiceId(value as string)}
                    >
                      <SelectTrigger id="hint-voice" className="flex-1">
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
                    {hintMessage.hintAudioUrl ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Послушать озвучку уведомления"
                        onClick={playHintPreview}
                      >
                        <PlayIcon />
                      </Button>
                    ) : null}
                  </div>
                  <Button
                    type="button"
                    disabled={
                      hintVoicing || !hintMessage.hintText?.trim() || !hintVoiceId
                    }
                    onClick={handleHintVoiceOver}
                  >
                    {hintVoicing ? (
                      <>
                        <Loader2Icon className="size-4 animate-spin" /> Озвучиваю…
                      </>
                    ) : hintMessage.hintAudioUrl ? (
                      "Переозвучить уведомление"
                    ) : (
                      "Озвучить уведомление"
                    )}
                  </Button>
                  {hintMessage.hintAudioUrl ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => clearMessageHintAudio(hintMessage.id)}
                    >
                      <XIcon /> Убрать озвучку уведомления
                    </Button>
                  ) : null}
                  {hintVoiceError ? (
                    <p className="text-sm break-words text-destructive">
                      {hintVoiceError}
                    </p>
                  ) : null}

                  {hintMessage.isHintMoment ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="self-start"
                      onClick={() => {
                        setMessageHint(hintMessage.id, "");
                        setHintMessageId(NO_MESSAGE_SELECTED);
                      }}
                    >
                      <XIcon /> Убрать уведомление
                    </Button>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
