import { NextResponse } from "next/server";

import { listTikTokAccounts, listYouTubeAccounts } from "@cueme/publish-clients";

export interface ConnectedAccountSummary {
  id: string;
  platform: "tiktok" | "youtube";
  label: string;
  createdAt: string;
  /**
   * TikTok хранит срок жизни refresh_token — можем проверить локально, без
   * сетевого запроса. Google (YouTube) такого срока не сообщает — реальный
   * статус выясняется только при попытке публикации (errorKind
   * "not_connected", см. lib/youtubeJobs.ts), здесь всегда false.
   */
  expired: boolean;
}

/**
 * Мультиаккаунт: список всех подключённых TikTok/YouTube-аккаунтов — читает
 * apps/web/components/chat/{TikTokPublish,YouTubePublish}.tsx (чекбоксы
 * выбора аккаунтов) и app/accounts/page.tsx (управление подключениями).
 */
export async function GET() {
  const [tiktokAccounts, youtubeAccounts] = await Promise.all([
    listTikTokAccounts(),
    listYouTubeAccounts(),
  ]);

  const accounts: ConnectedAccountSummary[] = [
    ...tiktokAccounts.map((a) => ({
      id: a.id,
      platform: "tiktok" as const,
      label: a.label,
      createdAt: a.createdAt,
      expired: Date.now() >= a.tokens.refreshExpiresAt,
    })),
    ...youtubeAccounts.map((a) => ({
      id: a.id,
      platform: "youtube" as const,
      label: a.label,
      createdAt: a.createdAt,
      expired: false,
    })),
  ];

  return NextResponse.json({ accounts });
}
