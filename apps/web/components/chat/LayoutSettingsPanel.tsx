"use client";

import { RotateCcwIcon } from "lucide-react";
import { useChatStore } from "@cueme/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

function sliderValue(v: number | readonly number[]): number {
  return Array.isArray(v) ? v[0] : (v as number);
}

interface RowProps {
  label: string;
  value: number;
  displayValue: string;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
}

function SettingRow({ label, value, displayValue, min, max, step, onChange }: RowProps) {
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-xs tabular-nums text-muted-foreground">
          {displayValue}
        </span>
      </div>
      <Slider
        value={[value]}
        onValueChange={(v) => onChange(sliderValue(v))}
        min={min}
        max={max}
        step={step}
      />
    </div>
  );
}

/**
 * Конструктор геометрии окна переписки и текста сообщений. Ползунки
 * управляют теми же LayoutSettings, что уходят в Remotion-композицию
 * (ChatVideo → ChatWindowCard/cardHeight) — превью и экспорт всегда
 * видят одни и те же значения, отдельного "предпросмотра настроек" не
 * нужно, обычное видео-превью справа уже и есть предпросмотр.
 */
export function LayoutSettingsPanel() {
  const layout = useChatStore((s) => s.layoutSettings);
  const setWindowWidthRatio = useChatStore((s) => s.setWindowWidthRatio);
  const setWindowHeightRatio = useChatStore((s) => s.setWindowHeightRatio);
  const setWindowTopMarginRatio = useChatStore((s) => s.setWindowTopMarginRatio);
  const setMessageFontScale = useChatStore((s) => s.setMessageFontScale);
  const setMessageSpacingScale = useChatStore((s) => s.setMessageSpacingScale);
  const resetLayoutSettings = useChatStore((s) => s.resetLayoutSettings);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Конструктор макета</CardTitle>
        <Button type="button" variant="ghost" size="sm" onClick={resetLayoutSettings}>
          <RotateCcwIcon /> Сбросить
        </Button>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">Окно переписки</p>
        <SettingRow
          label="Ширина окна"
          value={layout.windowWidthRatio * 100}
          displayValue={`${Math.round(layout.windowWidthRatio * 100)}%`}
          min={50}
          max={95}
          step={1}
          onChange={(v) => setWindowWidthRatio(v / 100)}
        />
        <SettingRow
          label="Высота окна"
          value={layout.windowHeightRatio * 100}
          displayValue={`${Math.round(layout.windowHeightRatio * 100)}%`}
          min={15}
          max={80}
          step={1}
          onChange={(v) => setWindowHeightRatio(v / 100)}
        />
        <SettingRow
          label="Отступ окна сверху"
          value={layout.windowTopMarginRatio * 100}
          displayValue={`${Math.round(layout.windowTopMarginRatio * 100)}%`}
          min={0}
          max={40}
          step={1}
          onChange={(v) => setWindowTopMarginRatio(v / 100)}
        />

        <p className="mt-2 text-xs text-muted-foreground">Сообщения</p>
        <SettingRow
          label="Размер текста и аватарок"
          value={layout.messageFontScale * 100}
          displayValue={`${Math.round(layout.messageFontScale * 100)}%`}
          min={50}
          max={150}
          step={5}
          onChange={(v) => setMessageFontScale(v / 100)}
        />
        <SettingRow
          label="Отступы между сообщениями"
          value={layout.messageSpacingScale * 100}
          displayValue={`${Math.round(layout.messageSpacingScale * 100)}%`}
          min={30}
          max={200}
          step={5}
          onChange={(v) => setMessageSpacingScale(v / 100)}
        />

        <p className="text-xs text-muted-foreground">
          Изменения сразу видны в видео-превью справа — нажми «Обновить видео»,
          если превью ещё не собрано.
        </p>
      </CardContent>
    </Card>
  );
}
