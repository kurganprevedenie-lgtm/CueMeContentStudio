"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { YouTubePrivacyStatus } from "@cueme/publish-clients";

interface YouTubeJobSnapshot {
  id: string;
  phase: "uploading" | "done" | "error";
  uploadProgress: number;
  videoId?: string;
  url?: string;
  error?: string;
  errorKind?: "not_connected" | "api" | "other";
}

/**
 * Редирект из /api/youtube/callback возвращается на страницу с флагом в
 * query. window ещё недоступен при серверном рендере статической
 * страницы — тогда читать нечего, конектимся к реальному статусу через
 * /api/youtube/status чуть ниже (тот же паттерн, что в TikTokPublish.tsx).
 */
function readOAuthRedirectParams(): {
  connected: boolean | null;
  error: string | null;
} {
  if (typeof window === "undefined") return { connected: null, error: null };
  const params = new URLSearchParams(window.location.search);
  return {
    connected: params.get("youtube_connected") === "1" ? true : null,
    error: params.get("youtube_connect_error"),
  };
}

/**
 * Блок публикации видео на YouTube (Shorts) — появляется на странице
 * готового видео (после успешного экспорта .mp4). В отличие от TikTok,
 * загрузка на YouTube требует заголовка и уровня приватности сразу —
 * этому и служит форма ниже.
 */
export function YouTubePublish({ renderJobId }: { renderJobId: string }) {
  const [connected, setConnected] = useState<boolean | null>(
    () => readOAuthRedirectParams().connected
  );
  const [connectError] = useState<string | null>(
    () => readOAuthRedirectParams().error
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] =
    useState<YouTubePrivacyStatus>("unlisted");
  const [job, setJob] = useState<YouTubeJobSnapshot | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/youtube/status")
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setConnected(d.connected))
      .catch(() => setConnected(false));

    // сама подстановка состояния из query — в lazy-инициализаторах выше;
    // здесь только чистим URL, чтобы флаг не всплывал заново при обновлении страницы
    const params = new URLSearchParams(window.location.search);
    if (!params.has("youtube_connect_error") && !params.has("youtube_connected")) {
      return;
    }
    params.delete("youtube_connect_error");
    params.delete("youtube_connected");
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

  const pollJob = (youtubeJobId: string) => {
    fetch(`/api/youtube/publish/${youtubeJobId}`)
      .then((r) => r.json())
      .then((data: YouTubeJobSnapshot) => {
        setJob(data);
        if (data.phase === "uploading") {
          pollRef.current = setTimeout(() => pollJob(youtubeJobId), 1000);
        }
      })
      .catch((e: unknown) => {
        setJob({
          id: youtubeJobId,
          phase: "error",
          uploadProgress: 0,
          errorKind: "other",
          error: e instanceof Error ? e.message : String(e),
        });
      });
  };

  const startPublish = async () => {
    setJob({ id: "", phase: "uploading", uploadProgress: 0 });
    try {
      const res = await fetch("/api/youtube/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: renderJobId,
          title: title.trim(),
          description,
          privacyStatus,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setJob(data);
      pollJob(data.id);
    } catch (e: unknown) {
      setJob({
        id: "",
        phase: "error",
        uploadProgress: 0,
        errorKind: "other",
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  const disconnect = async () => {
    await fetch("/api/youtube/status", { method: "DELETE" });
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
          href="/api/youtube/auth"
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          Подключить YouTube
        </a>
        {connectError ? (
          <p className="text-sm break-words text-destructive">{connectError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Нужно один раз войти в свой аккаунт Google, чтобы публиковать сюда
            видео.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {(!job || job.phase === "error") && job?.errorKind !== "not_connected" ? (
        <>
          <Input
            placeholder="Название видео"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            placeholder="Описание (необязательно)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <select
            className="h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none"
            value={privacyStatus}
            onChange={(e) =>
              setPrivacyStatus(e.target.value as YouTubePrivacyStatus)
            }
          >
            <option value="private">Приватное</option>
            <option value="unlisted">По ссылке</option>
            <option value="public">Публичное</option>
          </select>
          <Button
            type="button"
            className="w-full"
            disabled={!title.trim()}
            onClick={startPublish}
          >
            <UploadCloudIcon className="size-4" />
            Опубликовать в YouTube
          </Button>
          <button
            type="button"
            onClick={disconnect}
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Отключить YouTube
          </button>
        </>
      ) : null}

      {job?.phase === "uploading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Загружаю видео на YouTube… {Math.round(job.uploadProgress * 100)}%
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
            открыть на YouTube
          </a>
        </p>
      ) : null}

      {job?.phase === "error" ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm break-words text-destructive">
            <XCircleIcon className="size-4 shrink-0 translate-y-0.5" />
            {job.error ?? "Не удалось опубликовать видео"}
          </p>
          {job.errorKind === "not_connected" ? (
            <a
              href="/api/youtube/auth"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Переподключить YouTube
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
