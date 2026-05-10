import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db, isDatabaseConfigured } from "@/server/db/client";
import { appLogger } from "@/server/observability/logger";
import { readTelegramImportContent, writeTelegramImportContent } from "@/server/services/telegram-import-content";

type ProcessResult = {
  processed: number;
  failed: number;
};

function normalizeLivePayload(rawContent: unknown): Prisma.InputJsonValue {
  const current = readTelegramImportContent(rawContent);
  return writeTelegramImportContent({
    ...current,
    summary: current.summary ?? current.caption ?? current.text ?? "Telegram channel message"
  });
}

export async function processQueuedTelegramImports(limit = 25): Promise<ProcessResult> {
  if (!isDatabaseConfigured) {
    return { processed: 0, failed: 0 };
  }

  const queued = await db.telegramImport.findMany({
    where: { status: "queued" },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      rawContent: true
    }
  });

  let processed = 0;
  let failed = 0;

  for (const item of queued) {
    try {
      await db.telegramImport.update({
        where: { id: item.id },
        data: {
          rawContent: normalizeLivePayload(item.rawContent),
          status: "pending",
          errorMessage: null
        }
      });
      processed += 1;
    } catch (error) {
      failed += 1;
      await db.telegramImport.update({
        where: { id: item.id },
        data: {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Telegram processing failed."
        }
      });
      appLogger.error("telegram_import_processing_failed", {
        importId: item.id,
        error: error instanceof Error ? error.message : "unknown"
      });
    }
  }

  return { processed, failed };
}
