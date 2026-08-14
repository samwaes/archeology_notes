import { NextResponse } from "next/server";
import { authenticatedAccessEmail, huplaAccessConfiguration, recordHuplaSession } from "@/lib/hupla-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set(["start", "heartbeat", "end"]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const config = huplaAccessConfiguration();
  if (!config.configured) return NextResponse.json({ recorded: false, reason: "not-configured" }, { status: 202 });

  const email = authenticatedAccessEmail(request.headers);
  if (!email) return NextResponse.json({ recorded: false, reason: "identity-missing" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const sessionId = typeof body?.sessionId === "string" ? body.sessionId : "";
  if (!ACTIONS.has(action) || !UUID_PATTERN.test(sessionId)) {
    return NextResponse.json({ recorded: false, reason: "invalid-session" }, { status: 400 });
  }

  try {
    const result = await recordHuplaSession({
      email,
      sessionId,
      action: action as "start" | "heartbeat" | "end",
      path: typeof body?.path === "string" ? body.path.slice(0, 1000) : undefined,
      exitReason: typeof body?.exitReason === "string" ? body.exitReason.slice(0, 120) : undefined,
      userAgent: request.headers.get("user-agent")?.slice(0, 1000)
    });
    return NextResponse.json(result || { recorded: false }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ recorded: false, reason: "service-unavailable" }, { status: 202 });
  }
}
