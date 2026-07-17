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

interface YouTubeAccountJobState {
  accountId: string;
  phase: "uploading" | "done" | "error";
  uploadProgress: number;
  videoId?: string;
  url?: string;
  error?: string;
  errorKind?: "not_connected" | "api" | "other";
}

interface YouTubeJobSnapshot {
  id: string;
  accounts: YouTubeAccountJobState[];
}

interface YouTubeAccountInfo {
  id: string;
  label: string;
  expired: boolean;
}

/**
 * Редирект из /api/youtube/callback возвращается на страницу с флагом в
 * query. window ещё недоступен при серверном рендере статической
 * страницы — тогда читать нечего.
 */
function readOAuthRedirectParams(): { error: string | null } {
  if (typeof window === "undefined") return { error: null };
  const params = new URLSearchParams(window.location.search);
  return { error: params.get("youtube_connect_error") };
}

/**
 * Блок публикации видео на YouTube (Shorts) — появляется на странице
 * готового видео (после успешного экспорта .mp4). Мультиаккаунт: чекбоксы
 * вместо одной кнопки — можно выбрать сразу несколько подключённых
 * YouTube-аккаунтов, загрузка на них идёт последовательно (см.
 * lib/youtubeJobs.ts). В отличие от TikTok, загрузка на YouTube требует
 * заголовка и уровня приватности сразу — этому и служит форма ниже (одна
 * на все выбранные аккаунты).
 */
export function YouTubePublish({ renderJobId }: { renderJobId: string }) {
  const [accounts, setAccounts] = useState<YouTubeAccountInfo[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [connectError] = useState<string | null>(
    () => readOAuthRedirectParams().error
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [privacyStatus, setPrivacyStatus] =
    useState<YouTubePrivacyStatus>("unlisted");
  const [job, setJob] = useState<YouTubeJobSnapshot | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadAccounts = () => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then(
        (d: {
          accounts: { id: string; platform: string; label: string; expired: boolean }[];
        }) => {
          const youtubeAccounts = d.accounts
            .filter((a) => a.platform === "youtube")
            .map((a) => ({ id: a.id, label: a.label, expired: a.expired }));
          setAccounts(youtubeAccounts);
          setSelectedIds(
            new Set(youtubeAccounts.filter((a) => !a.expired).map((a) => a.id))
          );
        }
      )
      .catch(() => setAccounts([]));
  };

  useEffect(() => {
    loadAccounts();

    // чистим query-флаг ошибки, чтобы не всплывал заново при обновлении страницы
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

  const pollJob = (youtubeJobId: string) => {
    fetch(`/api/youtube/publish/${youtubeJobId}`)
      .then((r) => r.json())
      .then((data: YouTubeJobSnapshot) => {
        setJob(data);
        const stillRunning = data.accounts.some((a) => a.phase === "uploading");
        if (stillRunning) {
          pollRef.current = setTimeout(() => pollJob(youtubeJobId), 1000);
        }
      })
      .catch((e: unknown) => {
        setJob({
          id: youtubeJobId,
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
      const res = await fetch("/api/youtube/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId: renderJobId,
          accountIds,
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

  const isRunning = job?.accounts.some((a) => a.phase === "uploading") ?? false;

  return (
    <div className="flex flex-col gap-2 border-t pt-4">
      {accounts.length === 0 ? (
        <>
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
            href="/api/youtube/auth"
            className="self-start text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            + Добавить ещё аккаунт YouTube
          </a>
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
            disabled={selectedIds.size === 0 || !title.trim()}
            onClick={startPublish}
          >
            <UploadCloudIcon className="size-4" />
            Опубликовать на YouTube
            {selectedIds.size > 1 ? ` (${selectedIds.size})` : ""}
          </Button>
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
              {a.phase === "done" ? (
                <p className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2Icon className="size-4 shrink-0" />
                  Опубликовано —{" "}
                  <a
                    href={a.url}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-4"
                  >
                    открыть на YouTube
                  </a>
                </p>
              ) : null}
              {a.phase === "error" ? (
                <div className="flex flex-col gap-2">
                  <p className="flex items-start gap-2 text-sm break-words text-destructive">
                    <XCircleIcon className="size-4 shrink-0 translate-y-0.5" />
                    {a.error ?? "Не удалось опубликовать видео"}
                  </p>
                  {a.errorKind === "not_connected" ? (
                    <a
                      href="/api/youtube/auth"
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
