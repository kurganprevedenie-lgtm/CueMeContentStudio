"use client";

import { themes, useChatStore, type ThemeId } from "@cueme/shared";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const themeItems = Object.fromEntries(
  Object.values(themes).map((t) => [t.id, t.name])
);

export function ThemeSelector() {
  const themeId = useChatStore((s) => s.themeId);
  const setTheme = useChatStore((s) => s.setTheme);

  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="theme">Тема</Label>
      <Select
        items={themeItems}
        value={themeId}
        onValueChange={(value) => setTheme(value as ThemeId)}
      >
        <SelectTrigger id="theme" className="min-w-52">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(themes).map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
