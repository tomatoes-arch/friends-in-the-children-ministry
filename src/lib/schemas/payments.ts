import { z } from "zod";

export const paymentProviderSchema = z.enum(["mpesa", "airtel"]);

export const initiatePaymentSchema = z.object({
  provider: paymentProviderSchema,
  contentId: z.string().trim().uuid(),
  contentType: z.enum(["blog_post"]),
  amountCents: z.number().int().positive(),
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(7).max(24).optional()
});

export const paymentCallbackSchema = z.object({
  reference: z.string().trim().min(6).max(120),
  status: z.enum(["completed", "failed", "cancelled", "processing"]),
  metadata: z.record(z.string(), z.unknown()).optional()
});
