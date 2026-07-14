"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import {
  useChatStore,
  type BotBannerPosition,
  type BotBannerTiming,
} from "@cueme/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";

function sliderValue(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}

const POSITION_LABELS: Record<BotBannerPosition, string> = {
  watermark: "Водяной знак (угол)",
  top: "Полоса сверху",
  bottom: "Полоса снизу",
};

const TIMING_LABELS: Record<BotBannerTiming, string> = {
  always: "Весь ролик",
  intro: "В начале",
  outro: "В конце",
  periodic: "Периодически",
};

/**
 * Настройки CTA-баннера с юзернеймом Telegram-бота (packages/remotion/src/BotBanner.tsx).
 * Как и LayoutSettingsPanel, ничего отдельно не превьюит — видео-превью
 * справа уже и есть предпросмотр, значения уходят туда напрямую через store.
 */
export function BotBannerPanel() {
  const botBanner = useChatStore((s) => s.botBanner);
  const setBotBannerEnabled = useChatStore((s) => s.setBotBannerEnabled);
  const setBotBannerText = useChatStore((s) => s.setBotBannerText);
  const setBotBannerPosition = useChatStore((s) => s.setBotBannerPosition);
  const setBotBannerTiming = useChatStore((s) => s.setBotBannerTiming);
  const setBotBannerTimingDurationSec = useChatStore(
    (s) => s.setBotBannerTimingDurationSec
  );
  const setBotBannerPeriodicIntervalSec = useChatStore(
    (s) => s.setBotBannerPeriodicIntervalSec
  );
  const setBotBannerPeriodicVisibleSec = useChatStore(
    (s) => s.setBotBannerPeriodicVisibleSec
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Баннер бота</CardTitle>
        <Button
          type="button"
          variant={botBanner.enabled ? "default" : "outline"}
          size="sm"
          onClick={() => setBotBannerEnabled(!botBanner.enabled)}
        >
          {botBanner.enabled ? <EyeIcon /> : <EyeOffIcon />}
          {botBanner.enabled ? "Показывается" : "Скрыт"}
        </Button>
      </CardHeader>
      {botBanner.enabled ? (
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="bot-banner-text">Текст</Label>
            <Input
              id="bot-banner-text"
              placeholder="@CueMeChatBot"
              value={botBanner.text}
              onChange={(e) => setBotBannerText(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="bot-banner-position">Позиция</Label>
            <Select
              items={POSITION_LABELS}
              value={botBanner.position}
              onValueChange={(v) =>
                setBotBannerPosition(v as BotBannerPosition)
              }
            >
              <SelectTrigger id="bot-banner-position" className="min-w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(POSITION_LABELS) as [
                    BotBannerPosition,
                    string,
                  ][]
                ).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor="bot-banner-timing">Когда показывать</Label>
            <Select
              items={TIMING_LABELS}
              value={botBanner.timing}
              onValueChange={(v) => setBotBannerTiming(v as BotBannerTiming)}
            >
              <SelectTrigger id="bot-banner-timing" className="min-w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(
                  Object.entries(TIMING_LABELS) as [BotBannerTiming, string][]
                ).map(([id, label]) => (
                  <SelectItem key={id} value={id}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {botBanner.timing === "intro" || botBanner.timing === "outro" ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-between">
                <Label>
                  {botBanner.timing === "intro"
                    ? "Видно первые"
                    : "Видно последние"}
                </Label>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {botBanner.timingDurationSec}с
                </span>
              </div>
              <Slider
                value={[botBanner.timingDurationSec]}
                onValueChange={(v) =>
                  setBotBannerTimingDurationSec(sliderValue(v))
                }
                min={1}
                max={10}
                step={1}
              />
            </div>
          ) : null}

          {botBanner.timing === "periodic" ? (
            <>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Интервал повтора</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {botBanner.periodicIntervalSec}с
                  </span>
                </div>
                <Slider
                  value={[botBanner.periodicIntervalSec]}
                  onValueChange={(v) =>
                    setBotBannerPeriodicIntervalSec(sliderValue(v))
                  }
                  min={3}
                  max={20}
                  step={1}
                />
              </div>
              <div className="grid gap-2">
                <div className="flex items-center justify-between">
                  <Label>Длительность показа</Label>
                  <span className="text-xs tabular-nums text-muted-foreground">
                    {botBanner.periodicVisibleSec}с
                  </span>
                </div>
                <Slider
                  value={[botBanner.periodicVisibleSec]}
                  onValueChange={(v) =>
                    setBotBannerPeriodicVisibleSec(sliderValue(v))
                  }
                  min={1}
                  max={6}
                  step={0.5}
                />
              </div>
            </>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Изменения сразу видны в видео-превью справа — нажми «Обновить
            видео», если превью ещё не собрано.
          </p>
        </CardContent>
      ) : null}
    </Card>
  );
}
