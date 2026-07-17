"use client";

import { useEffect, useState } from "react";
import { CheckIcon, Loader2Icon, PencilIcon, XIcon } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface ConnectedAccount {
  id: string;
  platform: "tiktok" | "youtube";
  label: string;
  createdAt: string;
  expired: boolean;
}

const PLATFORM_LABEL: Record<ConnectedAccount["platform"], string> = {
  tiktok: "TikTok",
  youtube: "YouTube",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function AccountRow({
  account,
  onRenamed,
  onRequestDelete,
}: {
  account: ConnectedAccount;
  onRenamed: (id: string, label: string) => void;
  onRequestDelete: (account: ConnectedAccount) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [labelDraft, setLabelDraft] = useState(account.label);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const trimmed = labelDraft.trim();
    if (!trimmed || trimmed === account.label) {
      setLabelDraft(account.label);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/accounts/${account.platform}/${account.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: trimmed }),
      });
      if (res.ok) onRenamed(account.id, trimmed);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span
          className={cn(
            "shrink-0 rounded-full px-2 py-0.5 text-xs font-medium",
            account.platform === "tiktok"
              ? "bg-foreground/10 text-foreground"
              : "bg-red-500/10 text-red-600 dark:text-red-400"
          )}
        >
          {PLATFORM_LABEL[account.platform]}
        </span>
        {editing ? (
          <Input
            autoFocus
            value={labelDraft}
            disabled={saving}
            onChange={(e) => setLabelDraft(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") {
                setLabelDraft(account.label);
                setEditing(false);
              }
            }}
            className="h-7"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex min-w-0 items-center gap-1.5 truncate text-sm hover:underline"
          >
            <span className="truncate">{account.label}</span>
            <PencilIcon className="size-3 shrink-0 text-muted-foreground" />
          </button>
        )}
        <span className="shrink-0 text-xs text-muted-foreground">
          {formatDate(account.createdAt)}
        </span>
        {account.expired ? (
          <span className="shrink-0 text-xs text-destructive">
            токен истёк — переподключите
          </span>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {account.expired ? (
          <a
            href={`/api/${account.platform}/auth`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            Переподключить
          </a>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => onRequestDelete(account)}
        >
          <XIcon className="size-4" /> Отключить
        </Button>
      </div>
    </div>
  );
}

/**
 * Управление подключёнными аккаунтами TikTok/YouTube — мультиаккаунт:
 * список карточек с переименованием и отключением, плюс кнопки "+
 * Добавить аккаунт" на каждую платформу (обычные ссылки на существующие
 * /api/{platform}/auth — тот же OAuth-флоу, что и раньше, просто каждый
 * заход создаёт НОВЫЙ аккаунт, не перезаписывает предыдущий, см.
 * app/api/tiktok/callback/route.ts).
 */
export function ConnectedAccountsList() {
  const [accounts, setAccounts] = useState<ConnectedAccount[] | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ConnectedAccount | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    fetch("/api/accounts")
      .then((r) => r.json())
      .then((d: { accounts: ConnectedAccount[] }) => setAccounts(d.accounts))
      .catch(() => setAccounts([]));
  };

  useEffect(load, []);

  const handleRenamed = (id: string, label: string) => {
    setAccounts((prev) =>
      prev ? prev.map((a) => (a.id === id ? { ...a, label } : a)) : prev
    );
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await fetch(`/api/accounts/${deleteTarget.platform}/${deleteTarget.id}`, {
        method: "DELETE",
      });
      setAccounts((prev) =>
        prev ? prev.filter((a) => a.id !== deleteTarget.id) : prev
      );
      setDeleteTarget(null);
    } finally {
      setDeleting(false);
    }
  };

  if (accounts === null) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2Icon className="size-4 animate-spin" /> Загружаю аккаунты…
      </p>
    );
  }

  const tiktokAccounts = accounts.filter((a) => a.platform === "tiktok");
  const youtubeAccounts = accounts.filter((a) => a.platform === "youtube");

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>TikTok</CardTitle>
          <a
            href="/api/tiktok/auth"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            + Добавить аккаунт TikTok
          </a>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {tiktokAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ничего не подключено.</p>
          ) : (
            tiktokAccounts.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                onRenamed={handleRenamed}
                onRequestDelete={setDeleteTarget}
              />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>YouTube</CardTitle>
          <a
            href="/api/youtube/auth"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            + Добавить аккаунт YouTube
          </a>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {youtubeAccounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ничего не подключено.</p>
          ) : (
            youtubeAccounts.map((a) => (
              <AccountRow
                key={a.id}
                account={a}
                onRenamed={handleRenamed}
                onRequestDelete={setDeleteTarget}
              />
            ))
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отключить «{deleteTarget?.label}»?</AlertDialogTitle>
            <AlertDialogDescription>
              Сохранённый токен будет удалён. Чтобы снова публиковать на этот
              аккаунт, придётся подключить его заново.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
            >
              {deleting ? (
                <>
                  <Loader2Icon className="size-4 animate-spin" /> Отключаю…
                </>
              ) : (
                <>
                  <CheckIcon className="size-4" /> Отключить
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
