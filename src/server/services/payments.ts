import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { PaymentProvider } from "@/generated/prisma/enums";

import { db, isDatabaseConfigured } from "@/server/db/client";
import { appLogger } from "@/server/observability/logger";
import { createPremiumAccessToken } from "@/server/services/premium-access";

function asJsonValue(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value ?? null)) as Prisma.InputJsonValue;
}

function buildPaymentReference(provider: PaymentProvider) {
  return `${provider}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function createPaymentIntent(input: {
  provider: PaymentProvider;
  amountCents: number;
  email: string;
  phone?: string;
  contentId: string;
  contentType: string;
}) {
  if (!isDatabaseConfigured) {
    throw new Error("Database is not configured.");
  }

  const reference = buildPaymentReference(input.provider);
  const payment = await db.payment.create({
    data: {
      userRef: input.email.toLowerCase(),
      amountCents: input.amountCents,
      provider: input.provider,
      status: "pending",
      reference,
      callbackPayload: asJsonValue({
        contentId: input.contentId,
        contentType: input.contentType,
        email: input.email,
        phone: input.phone ?? null
      })
    }
  });

  await db.paymentLog.create({
    data: {
      paymentId: payment.id,
      provider: input.provider,
      reference,
      payload: asJsonValue({
        stage: "initiated",
        amountCents: input.amountCents,
        email: input.email,
        phone: input.phone ?? null,
        contentId: input.contentId,
        contentType: input.contentType
      })
    }
  });

  return payment;
}

export async function completePayment(reference: string, status: "completed" | "failed" | "cancelled" | "processing", payload: Record<string, unknown> = {}) {
  if (!isDatabaseConfigured) {
    throw new Error("Database is not configured.");
  }

  const payment = await db.payment.findUnique({
    where: { reference },
    select: {
      id: true,
      reference: true,
      provider: true,
      status: true,
      callbackPayload: true
    }
  });

  if (!payment) {
    throw new Error("Payment reference was not found.");
  }

  const updated = await db.payment.update({
    where: { id: payment.id },
    data: {
      status,
      callbackPayload: asJsonValue({
        ...(typeof payment.callbackPayload === "object" && payment.callbackPayload ? payment.callbackPayload : {}),
        callback: payload
      })
    }
  });

  await db.paymentLog.create({
    data: {
      paymentId: payment.id,
      provider: payment.provider,
      reference: payment.reference,
      payload: asJsonValue({
        stage: "callback",
        status,
        ...payload
      })
    }
  });

  if (status !== "completed") {
    return { payment: updated, accessToken: null };
  }

  const callbackPayload =
    typeof updated.callbackPayload === "object" && updated.callbackPayload
      ? (updated.callbackPayload as Record<string, unknown>)
      : {};

  const contentId = typeof callbackPayload.contentId === "string" ? callbackPayload.contentId : null;
  const contentType = typeof callbackPayload.contentType === "string" ? callbackPayload.contentType : null;

  if (!contentId || !contentType) {
    appLogger.warn("payment_completed_without_content_binding", {
      paymentId: updated.id,
      reference
    });
    return { payment: updated, accessToken: null };
  }

  const accessToken = await createPremiumAccessToken({
    paymentId: updated.id,
    contentId,
    contentType
  });

  return { payment: updated, accessToken };
}
