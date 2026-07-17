import { NextResponse } from "next/server";

import { getTikTokPublishMode as getPublishMode } from "@cueme/publish-clients";

/**
 * Список подключённых аккаунтов и их отключение теперь через /api/accounts
 * (мультиаккаунт) — этот роут остался только за режимом публикации
 * (TIKTOK_PUBLISH_MODE), от него зависят формулировки/поля в UI
 * (TikTokPublish.tsx), а сам режим общий для всех TikTok-аккаунтов, не
 * привязан к конкретному.
 */
export async function GET() {
  return NextResponse.json({ mode: getPublishMode() });
}
