import { NextResponse } from "next/server";

import { PaymentProvider } from "@/generated/prisma/enums";
import { initiatePaymentSchema } from "@/lib/schemas/payments";
import { assertRateLimit } from "@/server/security/rate-limit";
import { createPaymentIntent } from "@/server/services/payments";

export async function POST(request: Request) {
  const rateLimit = await assertRateLimit("payment");
  if (!rateLimit.allowed) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  const parsed = initiatePaymentSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const payment = await createPaymentIntent({
      provider: parsed.data.provider as PaymentProvider,
      amountCents: parsed.data.amountCents,
      email: parsed.data.email,
      phone: parsed.data.phone,
      contentId: parsed.data.contentId,
      contentType: parsed.data.contentType
    });

    return NextResponse.json(
      {
        ok: true,
        reference: payment.reference,
        status: payment.status,
        provider: payment.provider,
        message:
          "Payment intent created. Complete the provider callback wiring to finalize access token delivery."
      },
      { status: 201 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to initiate payment.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
