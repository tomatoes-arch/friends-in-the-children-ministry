import { NextResponse } from "next/server";

import { paymentCallbackSchema } from "@/lib/schemas/payments";
import { completePayment } from "@/server/services/payments";

export async function POST(request: Request) {
  const parsed = paymentCallbackSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await completePayment(parsed.data.reference, parsed.data.status, {
      provider: "airtel",
      ...(parsed.data.metadata ?? {})
    });

    return NextResponse.json(
      {
        ok: true,
        status: result.payment.status,
        accessToken: result.accessToken?.token ?? null,
        expiresAt: result.accessToken?.expiresAt ?? null
      },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to process callback.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
