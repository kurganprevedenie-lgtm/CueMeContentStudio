"use client";

import { useRef, useState } from "react";
import { XIcon } from "lucide-react";
import { useChatStore } from "@cueme/shared";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = sender.trim().length > 0 && text.trim().length > 0;

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAvatarUrl("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setAvatarUrl(typeof reader.result === "string" ? reader.result : "");
    reader.readAsDataURL(file);
  };

  const clearAvatar = () => {
    setAvatarUrl("");
    if (avatarInputRef.current) avatarInputRef.current.value = "";
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    addMessage({
      sender: sender.trim(),
      text: text.trim(),
      side,
      avatarUrl: avatarUrl || undefined,
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
            <Label htmlFor="avatar">Аватарка (необязательно)</Label>
            <div className="flex items-center gap-2">
              <Avatar size="default">
                {avatarUrl ? (
                  <AvatarImage src={avatarUrl} alt="Превью аватарки" />
                ) : null}
                <AvatarFallback>
                  {sender.trim().charAt(0).toUpperCase() || "?"}
                </AvatarFallback>
              </Avatar>
              <Input
                id="avatar"
                type="file"
                accept="image/*"
                ref={avatarInputRef}
                onChange={handleAvatarChange}
                className="flex-1"
              />
              {avatarUrl ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Убрать аватарку"
                  onClick={clearAvatar}
                >
                  <XIcon />
                </Button>
              ) : null}
            </div>
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
