"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface InstagramJobSnapshot {
  id: string;
  phase: "creating" | "processing" | "publishing" | "done" | "error";
  containerId?: string;
  mediaId?: string;
  url?: string;
  error?: string;
  errorKind?: "not_connected" | "api" | "other";
}

/**
 * Редирект из /api/instagram/callback возвращается на страницу с флагом в
 * query. window ещё недоступен при серверном рендере статической
 * страницы — тогда читать нечего, конектимся к реальному статусу через
 * /api/instagram/status чуть ниже (тот же паттерн, что в TikTokPublish.tsx).
 */
function readOAuthRedirectParams(): {
  connected: boolean | null;
  error: string | null;
} {
  if (typeof window === "undefined") return { connected: null, error: null };
  const params = new URLSearchParams(window.location.search);
  return {
    connected: params.get("instagram_connected") === "1" ? true : null,
    error: params.get("instagram_connect_error"),
  };
}

/**
 * Блок публикации видео как Reels в Instagram — появляется на странице
 * готового видео (после успешного экспорта .mp4). В отличие от TikTok/YouTube,
 * Instagram сам забирает видео по публичному адресу, поэтому создание
 * контейнера идёт через фазы "creating" → "processing" (Meta скачивает и
 * обрабатывает видео) → "publishing" → "done".
 */
export function InstagramPublish({ renderJobId }: { renderJobId: string }) {
  const [connected, setConnected] = useState<boolean | null>(
    () => readOAuthRedirectParams().connected
  );
  const [connectError] = useState<string | null>(
    () => readOAuthRedirectParams().error
  );
  const [caption, setCaption] = useState("");
  const [job, setJob] = useState<InstagramJobSnapshot | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/instagram/status")
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setConnected(d.connected))
      .catch(() => setConnected(false));

    // сама подстановка состояния из query — в lazy-инициализаторах выше;
    // здесь только чистим URL, чтобы флаг не всплывал заново при обновлении страницы
    const params = new URLSearchParams(window.location.search);
    if (
      !params.has("instagram_connect_error") &&
      !params.has("instagram_connected")
    ) {
      return;
    }
    params.delete("instagram_connect_error");
    params.delete("instagram_connected");
    const search = params.toString();
    window.history.replaceState(
      {},
      "",
      window.location.pathname + (search ? `?${search}` : "")
    );
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const pollJob = (instagramJobId: string) => {
    fetch(`/api/instagram/publish/${instagramJobId}`)
      .then((r) => r.json())
      .then((data: InstagramJobSnapshot) => {
        setJob(data);
        if (data.phase === "creating" || data.phase === "processing" || data.phase === "publishing") {
          pollRef.current = setTimeout(() => pollJob(instagramJobId), 2000);
        }
      })
      .catch((e: unknown) => {
        setJob({
          id: instagramJobId,
          phase: "error",
          errorKind: "other",
          error: e instanceof Error ? e.message : String(e),
        });
      });
  };

  const startPublish = async () => {
    setJob({ id: "", phase: "creating" });
    try {
      const res = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: renderJobId, caption }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setJob(data);
      pollJob(data.id);
    } catch (e: unknown) {
      setJob({
        id: "",
        phase: "error",
        errorKind: "other",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const disconnect = async () => {
    await fetch("/api/instagram/status", { method: "DELETE" });
    setConnected(false);
    setJob(null);
  };

  if (connected === null) {
    return null;
  }

  if (!connected) {
    return (
      <div className="flex flex-col gap-2 border-t pt-4">
        <a
          href="/api/instagram/auth"
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          Подключить Instagram
        </a>
        {connectError ? (
          <p className="text-sm break-words text-destructive">{connectError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Нужно войти через Facebook и указать страницу с привязанным
            Instagram-аккаунтом бизнеса/автора, чтобы публиковать сюда Reels.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {(!job || job.phase === "error") && job?.errorKind !== "not_connected" ? (
        <>
          <Textarea
            placeholder="Подпись к Reels (необязательно)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
          />
          <Button type="button" className="w-full" onClick={startPublish}>
            <UploadCloudIcon className="size-4" />
            Опубликовать как Reels в Instagram
          </Button>
          <button
            type="button"
            onClick={disconnect}
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Отключить Instagram
          </button>
        </>
      ) : null}

      {job?.phase === "creating" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Отправляю видео в Instagram…
        </p>
      ) : null}

      {job?.phase === "processing" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Instagram обрабатывает видео…
        </p>
      ) : null}

      {job?.phase === "publishing" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Публикую Reels…
        </p>
      ) : null}

      {job?.phase === "done" ? (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4 shrink-0" />
          Опубликовано —{" "}
          <a
            href={job.url}
            target="_blank"
            rel="noreferrer"
            className="underline underline-offset-4"
          >
            открыть в Instagram
          </a>
        </p>
      ) : null}

      {job?.phase === "error" ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm break-words text-destructive">
            <XCircleIcon className="size-4 shrink-0 translate-y-0.5" />
            {job.error ?? "Не удалось опубликовать Reels"}
          </p>
          {job.errorKind === "not_connected" ? (
            <a
              href="/api/instagram/auth"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Переподключить Instagram
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
