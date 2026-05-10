import "server-only";

import crypto from "node:crypto";

import { db, isDatabaseConfigured } from "@/server/db/client";

function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export async function createPremiumAccessToken(input: {
  paymentId: string;
  contentId: string;
  contentType: string;
  expiresInDays?: number;
}) {
  if (!isDatabaseConfigured) {
    throw new Error("Database is not configured.");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + (input.expiresInDays ?? 30) * 24 * 60 * 60 * 1000);

  await db.premiumToken.create({
    data: {
      paymentId: input.paymentId,
      contentId: input.contentId,
      contentType: input.contentType,
      tokenHash,
      expiresAt
    }
  });

  return { token, expiresAt };
}

export async function validatePremiumAccessToken(input: {
  contentId: string;
  contentType: string;
  token?: string | null;
}) {
  if (!isDatabaseConfigured || !input.token) {
    return null;
  }

  const tokenHash = hashToken(input.token);
  const record = await db.premiumToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      contentId: true,
      contentType: true,
      expiresAt: true,
      usedAt: true
    }
  });

  if (!record) {
    return null;
  }

  if (record.contentId !== input.contentId || record.contentType !== input.contentType) {
    return null;
  }

  if (record.expiresAt.getTime() < Date.now()) {
    return null;
  }

  return record;
}
