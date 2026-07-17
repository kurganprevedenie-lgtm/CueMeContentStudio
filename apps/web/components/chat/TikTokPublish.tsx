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

interface TikTokAccountJobState {
  accountId: string;
  phase: "uploading" | "polling" | "done" | "error";
  uploadProgress: number;
  publishId?: string;
  tiktokStatus?: string;
  failReason?: string;
  error?: string;
  errorKind?: "not_connected" | "api" | "other";
}

interface TikTokJobSnapshot {
  id: string;
  accounts: TikTokAccountJobState[];
}

interface TikTokAccountInfo {
  id: string;
  label: string;
  expired: boolean;
}

/**
 * Редирект из /api/tiktok/callback возвращается на страницу с флагом в
 * query. window ещё недоступен при серверном рендере статической
 * страницы — тогда читать нечего.
 */
function readOAuthRedirectParams(): { error: string | null } {
  if (typeof window === "undefined") return { error: null };
  const params = new URLSearchParams(window.location.search);
  return { error: params.get("tiktok_connect_error") };
}

/**
 * Блок публикации черновика в TikTok — появляется на странице готового
 * видео (после успешного экспорта .mp4). Мультиаккаунт: чекбоксы вместо
 * одной кнопки — можно выбрать сразу несколько подключённых TikTok-
 * аккаунтов, публикация на них идёт последовательно (см. lib/tiktokJobs.ts).
 * ВСЕГДА черновик: видео уходит во «Входящие»/приватным (SELF_ONLY) на
 * каждый выбранный аккаунт, а не публикуется напрямую.
 */
export function TikTokPublish({ renderJobId }: { renderJobId: string }) {
  const [accounts, setAccounts] = useState<TikTokAccountInfo[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [connectError] = useState<string | null>(
    () => readOAuthRedirectParams().error
  );
  const [mode, setMode] = useState<"inbox" | "direct">("inbox");
  const [caption, setCaption] = useState("");
  const [job, setJob] = useState<TikTokJobSnapshot | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAccounts = () => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(
        (d: {
          accounts: { id: string; platform: string; label: string; expired: boolean }[];
        }) => {
          const tiktokAccounts = d.accounts
            .filter((a) => a.platform === "tiktok")
            .map((a) => ({ id: a.id, label: a.label, expired: a.expired }));
          setAccounts(tiktokAccounts);
          // по умолчанию выбраны все неистёкшие — обычно и хотят отправить на все
          setSelectedIds(
            new Set(tiktokAccounts.filter((a) => !a.expired).map((a) => a.id))
          );
        }
      )
      .catch(() => setAccounts([]));
  };

  useEffect(() => {
    loadAccounts();
    fetch("/api/tiktok/status")
      .then((r) => r.json())
      .then((d: { mode?: "inbox" | "direct" }) => {
        if (d.mode) setMode(d.mode);
      })
      .catch(() => {});

    // чистим query-флаг ошибки, чтобы не всплывал заново при обновлении страницы
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
    // если только что подключили новый аккаунт — список нужно перечитать
    loadAccounts();
  }, []);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  const toggleAccount = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const pollJob = (tiktokJobId: string) => {
    fetch(`/api/tiktok/publish/${tiktokJobId}`)
      .then((r) => r.json())
      .then((data: TikTokJobSnapshot) => {
        setJob(data);
        const stillRunning = data.accounts.some(
          (a) => a.phase === "uploading" || a.phase === "polling"
        );
        if (stillRunning) {
          pollRef.current = setTimeout(() => pollJob(tiktokJobId), 1500);
        }
      })
      .catch((e: unknown) => {
        setJob({
          id: tiktokJobId,
          accounts: [
            {
              accountId: "",
              phase: "error",
              uploadProgress: 0,
              errorKind: "other",
              error: e instanceof Error ? e.message : String(e),
            },
          ],
        });
      });
  };

  const startPublish = async () => {
    const accountIds = Array.from(selectedIds);
    if (accountIds.length === 0) return;
    setJob({
      id: "",
      accounts: accountIds.map((accountId) => ({
        accountId,
        phase: "uploading",
        uploadProgress: 0,
      })),
    });
    try {
      const res = await fetch("/api/tiktok/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: renderJobId,
          accountIds,
          ...(mode === "direct" ? { caption } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setJob(data);
      pollJob(data.id);
    } catch (e: unknown) {
      setJob({
        id: "",
        accounts: accountIds.map((accountId) => ({
          accountId,
          phase: "error",
          uploadProgress: 0,
          errorKind: "other",
          error: e instanceof Error ? e.message : String(e),
        })),
      });
    }
  };

  const labelFor = (accountId: string) =>
    accounts?.find((a) => a.id === accountId)?.label ?? accountId;

  if (accounts === null) {
    return null;
  }

  const isRunning =
    job?.accounts.some((a) => a.phase === "uploading" || a.phase === "polling") ??
    false;

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {accounts.length === 0 ? (
        <>
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
        </>
      ) : !job ? (
        <>
          <div className="flex flex-col gap-1.5">
            {accounts.map((a) => (
              <label
                key={a.id}
                className="flex items-center gap-2 text-sm"
                title={a.expired ? "Токен истёк — переподключите аккаунт" : undefined}
              >
                <input
                  type="checkbox"
                  className="size-4 accent-primary"
                  checked={selectedIds.has(a.id)}
                  disabled={a.expired}
                  onChange={() => toggleAccount(a.id)}
                />
                <span className={a.expired ? "text-muted-foreground" : ""}>
                  {a.label}
                  {a.expired ? " — истёк, переподключите" : ""}
                </span>
              </label>
            ))}
          </div>
          <a
            href="/api/tiktok/auth"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            + Добавить ещё аккаунт TikTok
          </a>
          {mode === "direct" ? (
            <Textarea
              placeholder="Описание и хэштеги (необязательно)"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          ) : null}
          <Button
            type="button"
            className="w-full"
            disabled={selectedIds.size === 0}
            onClick={startPublish}
          >
            <UploadCloudIcon className="size-4" />
            Отправить в TikTok{selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
          </Button>
          <p className="text-xs text-muted-foreground">
            {mode === "direct"
              ? "Видео появится в профиле каждого выбранного аккаунта с видимостью «Только я» — опубликовать для всех можно вручную в приложении TikTok."
              : "Видео придёт уведомлением от TikTok на каждый выбранный аккаунт — откройте его в приложении TikTok, чтобы просмотреть и опубликовать вручную. Подпись и хэштеги в режиме «Входящие» можно добавить только там же, вручную."}
          </p>
        </>
      ) : null}

      {job ? (
        <div className="flex flex-col gap-2">
          {job.accounts.map((a) => (
            <div key={a.accountId} className="flex flex-col gap-1">
              <span className="text-xs font-medium text-muted-foreground">
                {labelFor(a.accountId)}
              </span>
              {a.phase === "uploading" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  Загружаю… {Math.round(a.uploadProgress * 100)}%
                </p>
              ) : null}
              {a.phase === "polling" ? (
                <p className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin" />
                  TikTok обрабатывает видео…
                </p>
              ) : null}
              {a.phase === "done" ? (
                <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4 shrink-0" />
                  Готово — проверьте в приложении TikTok.
                </p>
              ) : null}
              {a.phase === "error" ? (
                <div className="flex flex-col gap-2">
                  <p className="flex items-start gap-2 text-sm break-words text-destructive">
                    <XCircleIcon className="size-4 shrink-0 translate-y-0.5" />
                    {a.failReason ?? a.error ?? "Не удалось сохранить черновик"}
                  </p>
                  {a.errorKind === "not_connected" ? (
                    <a
                      href="/api/tiktok/auth"
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                        className: "self-start",
                      })}
                    >
                      Переподключить
                    </a>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
          {!isRunning ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setJob(null)}>
              Отправить ещё раз
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
