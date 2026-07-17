import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";

import { ConnectedAccountsList } from "@/components/accounts/ConnectedAccountsList";

export default function AccountsPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 p-6">
      <header className="space-y-1">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline"
        >
          <ArrowLeftIcon className="size-4" /> Назад
        </Link>
        <h1 className="text-2xl font-semibold">Подключённые аккаунты</h1>
        <p className="text-sm text-muted-foreground">
          Можно подключить сразу несколько аккаунтов TikTok и YouTube — при
          публикации видео сможешь выбрать, на какие именно из них отправить.
        </p>
      </header>
      <ConnectedAccountsList />
    </main>
  );
}
