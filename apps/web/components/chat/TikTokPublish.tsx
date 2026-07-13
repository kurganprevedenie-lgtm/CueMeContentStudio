"use client";

import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2Icon,
  Loader2Icon,
  UploadCloudIcon,
  XCircleIcon,
} from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";

interface TikTokJobSnapshot {
  id: string;
  phase: "uploading" | "polling" | "done" | "error";
  uploadProgress: number;
  publishId?: string;
  tiktokStatus?: string;
  failReason?: string;
  error?: string;
  errorKind?: "not_connected" | "api" | "other";
}

/**
 * Редирект из /api/tiktok/callback возвращается на страницу с флагом в
 * query. window ещё недоступен при серверном рендере статической
 * страницы — тогда читать нечего, конектимся к реальному статусу через
 * /api/tiktok/status чуть ниже.
 */
function readOAuthRedirectParams(): {
  connected: boolean | null;
  error: string | null;
} {
  if (typeof window === "undefined") return { connected: null, error: null };
  const params = new URLSearchParams(window.location.search);
  return {
    connected: params.get("tiktok_connected") === "1" ? true : null,
    error: params.get("tiktok_connect_error"),
  };
}

/**
 * Блок публикации черновика в TikTok — появляется на странице готового
 * видео (после успешного экспорта .mp4). ВСЕГДА черновик: приложение не
 * прошло app review, поэтому единственный доступный privacy_level —
 * SELF_ONLY (см. lib/tiktokApi.ts). Формулировки в UI намеренно не
 * говорят "опубликовано" — до ручной публикации в приложении TikTok это
 * не так.
 */
export function TikTokPublish({ renderJobId }: { renderJobId: string }) {
  const [connected, setConnected] = useState<boolean | null>(
    () => readOAuthRedirectParams().connected
  );
  const [connectError] = useState<string | null>(
    () => readOAuthRedirectParams().error
  );
  const [job, setJob] = useState<TikTokJobSnapshot | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    fetch("/api/tiktok/status")
      .then((r) => r.json())
      .then((d: { connected: boolean }) => setConnected(d.connected))
      .catch(() => setConnected(false));

    // сама подстановка состояния из query — в lazy-инициализаторах выше;
    // здесь только чистим URL, чтобы флаг не всплывал заново при обновлении страницы
    const params = new URLSearchParams(window.location.search);
    if (!params.has("tiktok_connect_error") && !params.has("tiktok_connected")) {
      return;
    }
    params.delete("tiktok_connect_error");
    params.delete("tiktok_connected");
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

  const pollJob = (tiktokJobId: string) => {
    fetch(`/api/tiktok/publish/${tiktokJobId}`)
      .then((r) => r.json())
      .then((data: TikTokJobSnapshot) => {
        setJob(data);
        if (data.phase === "uploading" || data.phase === "polling") {
          pollRef.current = setTimeout(() => pollJob(tiktokJobId), 1500);
        }
      })
      .catch((e: unknown) => {
        setJob({
          id: tiktokJobId,
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
      const res = await fetch("/api/tiktok/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId: renderJobId }),
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
    await fetch("/api/tiktok/status", { method: "DELETE" });
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
          href="/api/tiktok/auth"
          className={buttonVariants({ variant: "outline", className: "w-full" })}
        >
          Подключить TikTok
        </a>
        {connectError ? (
          <p className="text-sm break-words text-destructive">{connectError}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Нужно один раз войти в свой аккаунт TikTok, чтобы сохранять сюда
            черновики видео.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {(!job || job.phase === "error") && job?.errorKind !== "not_connected" ? (
        <>
          <Button type="button" className="w-full" onClick={startPublish}>
            <UploadCloudIcon className="size-4" />
            Сохранить черновик в TikTok
          </Button>
          <p className="text-xs text-muted-foreground">
            Видео попадёт в черновики вашего аккаунта TikTok — откройте
            приложение TikTok, чтобы просмотреть и опубликовать вручную.
          </p>
          <button
            type="button"
            onClick={disconnect}
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Отключить TikTok
          </button>
        </>
      ) : null}

      {job?.phase === "uploading" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          Загружаю видео в TikTok… {Math.round(job.uploadProgress * 100)}%
        </p>
      ) : null}

      {job?.phase === "polling" ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2Icon className="size-4 animate-spin" />
          TikTok обрабатывает видео…
        </p>
      ) : null}

      {job?.phase === "done" ? (
        <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
          <CheckCircle2Icon className="size-4 shrink-0" />
          Черновик готов — откройте приложение TikTok, чтобы просмотреть и
          опубликовать вручную.
        </p>
      ) : null}

      {job?.phase === "error" ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-2 text-sm break-words text-destructive">
            <XCircleIcon className="size-4 shrink-0 translate-y-0.5" />
            {job.failReason ?? job.error ?? "Не удалось сохранить черновик"}
          </p>
          {job.errorKind === "not_connected" ? (
            <a
              href="/api/tiktok/auth"
              className={buttonVariants({ variant: "outline", className: "w-full" })}
            >
              Переподключить TikTok
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
