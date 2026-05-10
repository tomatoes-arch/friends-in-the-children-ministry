import { NextResponse } from "next/server";

import { hasSupabaseAdmin } from "@/server/services/supabase-admin";
import { isDatabaseConfigured } from "@/server/db/client";
import { getSystemReadiness } from "@/server/system/readiness";

export async function GET() {
  const readiness = getSystemReadiness();
  const ok = readiness.checks.every((item) => item.state !== "pending");

  return NextResponse.json(
    {
      ok,
      services: {
        database: isDatabaseConfigured,
        supabaseAdmin: hasSupabaseAdmin
      },
      readiness
    },
    { status: ok ? 200 : 503 }
  );
}
