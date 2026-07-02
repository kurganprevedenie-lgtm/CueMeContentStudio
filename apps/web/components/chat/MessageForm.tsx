"use client";

import { useState } from "react";
import { useChatStore } from "@cueme/shared";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function MessageForm() {
  const addMessage = useChatStore((s) => s.addMessage);
  const [sender, setSender] = useState("");
  const [text, setText] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [side, setSide] = useState<"left" | "right">("left");

  const canSubmit = sender.trim().length > 0 && text.trim().length > 0;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    addMessage({
      sender: sender.trim(),
      text: text.trim(),
      side,
      avatarUrl: avatarUrl.trim() || undefined,
    });
    setText("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Новое сообщение</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="sender">Отправитель</Label>
            <Input
              id="sender"
              value={sender}
              onChange={(e) => setSender(e.target.value)}
              placeholder="Аня"
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="text">Текст</Label>
            <Textarea
              id="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Ты не поверишь, что сейчас было…"
              rows={3}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="avatarUrl">Аватар (URL, необязательно)</Label>
            <Input
              id="avatarUrl"
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>
          <div className="grid gap-2">
            <Label>Сторона экрана</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={side === "left" ? "default" : "outline"}
                onClick={() => setSide("left")}
              >
                Слева
              </Button>
              <Button
                type="button"
                variant={side === "right" ? "default" : "outline"}
                onClick={() => setSide("right")}
              >
                Справа
              </Button>
            </div>
          </div>
          <Button type="submit" disabled={!canSubmit}>
            Добавить в диалог
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
