import { NextResponse } from "next/server";

import { readAppEnv } from "@/lib/schemas/env";
import { processQueuedTelegramImports } from "@/server/services/telegram-processing";

export async function POST(request: Request) {
  const env = readAppEnv();
  if (!env.CRON_SECRET) {
    return NextResponse.json({ error: "Cron secret is not configured." }, { status: 503 });
  }

  const authHeader = request.headers.get("authorization");
  const expected = `Bearer ${env.CRON_SECRET}`;
  if (authHeader !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const result = await processQueuedTelegramImports();
  return NextResponse.json({ ok: true, ...result }, { status: 200 });
}
