import type { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { db, isDatabaseConfigured } from "@/server/db/client";
import { appLogger } from "@/server/observability/logger";
import { assertRateLimit } from "@/server/security/rate-limit";
import { buildTelegramLiveImportContent } from "@/server/services/telegram-live-import";

const telegramUpdateSchema = z.object({
  update_id: z.number().int().optional(),
  message: z
    .object({
      message_id: z.number().int(),
      text: z.string().optional(),
      caption: z.string().optional()
    })
    .passthrough()
    .optional(),
  channel_post: z
    .object({
      message_id: z.number().int(),
      text: z.string().optional(),
      caption: z.string().optional()
    })
    .passthrough()
    .optional()
}).passthrough();

export async function POST(request: Request) {
  const rateLimit = await assertRateLimit("telegram");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const configuredSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
  const receivedSecret = request.headers.get("x-telegram-bot-api-secret-token");

  if (configuredSecret && receivedSecret !== configuredSecret) {
    return NextResponse.json({ error: "Unauthorized webhook request." }, { status: 401 });
  }

  const parsed = telegramUpdateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Webhook payload is invalid." }, { status: 400 });
  }

  const payload = parsed.data;
  const message = payload.channel_post ?? payload.message;

  if (!message) {
    return NextResponse.json({ ok: true, ignored: true }, { status: 202 });
  }

  if (!isDatabaseConfigured) {
    return NextResponse.json(
      {
        ok: true,
        queued: false,
        message: "Webhook validated. Database is not configured in this environment, so the payload was not stored."
      },
      { status: 202 }
    );
  }

  await db.telegramImport.upsert({
    where: { messageId: String(message.message_id) },
    create: {
      messageId: String(message.message_id),
      rawContent: buildTelegramLiveImportContent(message, null),
      status: "queued"
    },
    update: {
      rawContent: buildTelegramLiveImportContent(message, null),
      status: "queued",
      errorMessage: null
    }
  });

  appLogger.info("telegram_webhook_queued", {
    messageId: message.message_id
  });

  return NextResponse.json({ ok: true, queued: true }, { status: 202 });
}
