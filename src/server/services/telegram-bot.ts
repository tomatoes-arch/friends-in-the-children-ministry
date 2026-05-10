import "server-only";

import { hasConfiguredValue, readAppEnv } from "@/lib/schemas/env";
import { appLogger } from "@/server/observability/logger";
import { readSystemSetting, writeSystemSetting } from "@/server/system/settings";

export type TelegramRuntimeConfig = {
  mode: "webhook" | "polling";
  webhookUrl?: string | null;
};

const TELEGRAM_SETTING_KEY = "telegram.runtime";

export async function readTelegramRuntimeConfig(): Promise<TelegramRuntimeConfig> {
  const stored = await readSystemSetting<TelegramRuntimeConfig>(TELEGRAM_SETTING_KEY);
  return {
    mode: stored?.mode === "polling" ? "polling" : "webhook",
    webhookUrl: stored?.webhookUrl ?? null
  };
}

export async function writeTelegramRuntimeConfig(config: TelegramRuntimeConfig) {
  await writeSystemSetting(TELEGRAM_SETTING_KEY, {
    mode: config.mode,
    webhookUrl: config.webhookUrl ?? null
  });
}

function getBotApiUrl(method: string) {
  const env = readAppEnv();
  if (!hasConfiguredValue(env.TELEGRAM_BOT_TOKEN)) {
    throw new Error("Telegram bot token is not configured.");
  }

  return `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`;
}

export async function registerTelegramWebhook(webhookUrl: string) {
  const env = readAppEnv();
  const response = await fetch(getBotApiUrl("setWebhook"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: env.TELEGRAM_WEBHOOK_SECRET,
      allowed_updates: ["channel_post", "message"]
    })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    appLogger.error("telegram_webhook_registration_failed", {
      status: response.status,
      payload
    });
    throw new Error("Telegram webhook registration failed.");
  }

  return payload;
}

export async function clearTelegramWebhook() {
  const response = await fetch(getBotApiUrl("deleteWebhook"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ drop_pending_updates: false })
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.ok) {
    appLogger.error("telegram_webhook_clear_failed", {
      status: response.status,
      payload
    });
    throw new Error("Telegram webhook removal failed.");
  }

  return payload;
}
