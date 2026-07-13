import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { NextConfig } from "next";

// Next сам читает .env только из apps/web — подхватываем ключи из корня монорепо,
// не перезаписывая уже заданные переменные
try {
  const rootEnv = readFileSync(join(process.cwd(), "..", "..", ".env"), "utf8");
  for (const line of rootEnv.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)\s*$/);
    if (!match) continue;
    const [, name, rawValue] = match;
    if (process.env[name] === undefined) {
      process.env[name] = rawValue.replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // корневого .env может не быть — это не ошибка
}

const nextConfig: NextConfig = {
  transpilePackages: ["@cueme/shared", "@cueme/remotion"],
  // @remotion/renderer и @remotion/bundler запускают Chromium/ffmpeg — не бандлить
  serverExternalPackages: ["@remotion/renderer", "@remotion/bundler"],
  // Next в dev-режиме по умолчанию блокирует запросы к dev-ассетам с чужого
  // origin — нужно для тестирования TikTok OAuth через ngrok-туннель
  // (адрес меняется при каждом перезапуске ngrok, поэтому wildcard)
  allowedDevOrigins: ["*.ngrok-free.app", "*.ngrok-free.dev"],
};

export default nextConfig;
