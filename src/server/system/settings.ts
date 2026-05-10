import "server-only";

import type { Prisma } from "@/generated/prisma/client";

import { db, isDatabaseConfigured } from "@/server/db/client";

export async function readSystemSetting<T>(key: string): Promise<T | null> {
  if (!isDatabaseConfigured) {
    return null;
  }

  const setting = await db.systemSetting.findUnique({
    where: { key },
    select: { value: true }
  });

  return (setting?.value as T | undefined) ?? null;
}

export async function writeSystemSetting(key: string, value: Prisma.InputJsonValue) {
  if (!isDatabaseConfigured) {
    return null;
  }

  return db.systemSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value }
  });
}
