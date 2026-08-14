import { NextResponse } from "next/server";
import { databaseConfiguration, validateDatabaseConnection } from "@/lib/db";
import { huplaAccessConfiguration } from "@/lib/hupla-access";
import { r2Configuration, validateR2Connection } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const deep = url.searchParams.get("deep") === "1";
  const database = databaseConfiguration();
  const r2 = r2Configuration();
  const hupla = huplaAccessConfiguration();

  const base = {
    service: "archeology-notes",
    status: "ok",
    timestamp: new Date().toISOString(),
    configuration: {
      database: database.configured,
      r2: r2.configured,
      huplaAccess: hupla.configured,
      failClosed: hupla.failClosed
    }
  };

  if (!deep) return NextResponse.json(base, { headers: { "Cache-Control": "no-store" } });

  const checks: Record<string, unknown> = {};
  let healthy = true;

  try {
    checks.database = database.configured ? await validateDatabaseConnection() : { configured: false };
    if (!database.configured) healthy = false;
  } catch (error) {
    healthy = false;
    checks.database = { error: error instanceof Error ? error.message : "database check failed" };
  }

  try {
    checks.r2 = r2.configured ? await validateR2Connection() : { configured: false };
    if (!r2.configured) healthy = false;
  } catch (error) {
    healthy = false;
    checks.r2 = { error: error instanceof Error ? error.message : "R2 check failed" };
  }

  if (!hupla.configured) healthy = false;
  checks.huplaAccess = { configured: hupla.configured, failClosed: hupla.failClosed };

  return NextResponse.json({ ...base, status: healthy ? "ready" : "degraded", checks }, {
    status: healthy ? 200 : 503,
    headers: { "Cache-Control": "no-store" }
  });
}
