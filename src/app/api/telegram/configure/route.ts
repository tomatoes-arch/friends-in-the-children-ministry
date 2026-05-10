import { NextResponse } from "next/server";

import { telegramConfigureSchema } from "@/lib/schemas/telegram";
import { isSystemAdminRole } from "@/lib/roles";
import { getAdminSession } from "@/server/auth/session";
import { assertRateLimit } from "@/server/security/rate-limit";
import {
  clearTelegramWebhook,
  registerTelegramWebhook,
  writeTelegramRuntimeConfig
} from "@/server/services/telegram-bot";

export async function POST(request: Request) {
  const rateLimit = await assertRateLimit("telegram");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isSystemAdminRole(session.role)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  const parsed = telegramConfigureSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const config = parsed.data;

  try {
    if (config.mode === "webhook" && config.webhookUrl) {
      await registerTelegramWebhook(config.webhookUrl);
    }

    if (config.mode === "polling") {
      await clearTelegramWebhook();
    }

    await writeTelegramRuntimeConfig({
      mode: config.mode,
      webhookUrl: config.webhookUrl ?? null
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to configure Telegram.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  return NextResponse.json(
    {
      ok: true,
      mode: config.mode,
      webhookUrl: config.webhookUrl ?? null,
      message:
        config.mode === "webhook"
          ? "Telegram webhook configuration was saved and registered."
          : "Telegram polling mode was saved and the webhook was cleared."
    },
    { status: 200 }
  );
}
