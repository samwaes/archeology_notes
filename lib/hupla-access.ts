const APPLICATION_SLUG = "archeology-notes";
const CHECK_CACHE_MS = 60_000;

export type HuplaAccessDecision = {
  allowed: boolean;
  userId: string | null;
  accessLevel: "user" | "admin";
};

const accessCache = new Map<string, { decision: HuplaAccessDecision; expiresAt: number }>();

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value || !value.trim()) return fallback;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

export function huplaAccessConfiguration() {
  const apiUrl = (process.env.HUPLA_ACCESS_API_URL || "https://www.hupla.eu/api/access/v1").replace(/\/$/, "");
  const token = process.env.HUPLA_ACCESS_SERVICE_TOKEN?.trim() || "";

  return {
    apiUrl,
    token,
    accountUrl: process.env.HUPLA_ACCOUNT_URL || "https://labs.hupla.eu/account",
    configured: Boolean(token),
    failClosed: parseBoolean(process.env.HUPLA_ACCESS_FAIL_CLOSED, true)
  };
}

export function authenticatedAccessEmail(headers: Headers) {
  const value =
    headers.get("cf-access-authenticated-user-email") ||
    headers.get("x-authenticated-user-email") ||
    headers.get("x-forwarded-email") ||
    "";

  const email = value.trim().toLowerCase();
  if (email.includes("@")) return email;

  if (process.env.NODE_ENV !== "production") {
    const developmentEmail = process.env.ARCHEOLOGY_ACCESS_DEV_EMAIL?.trim().toLowerCase() || "";
    return developmentEmail.includes("@") ? developmentEmail : null;
  }

  return null;
}

async function postToHupla(pathname: string, body: Record<string, unknown>) {
  const config = huplaAccessConfiguration();
  if (!config.configured) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);

  try {
    const response = await fetch(`${config.apiUrl}${pathname}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal
    });

    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null;
    if (!response.ok) {
      const detail = typeof payload?.detail === "string" ? payload.detail : `HTTP ${response.status}`;
      throw new Error(`Hupla access service returned ${detail}.`);
    }

    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

export async function getHuplaAccessDecision(email: string): Promise<HuplaAccessDecision> {
  const cached = accessCache.get(email);
  if (cached && cached.expiresAt > Date.now()) return cached.decision;

  const config = huplaAccessConfiguration();
  const payload = await postToHupla("/check", { email, applicationSlug: APPLICATION_SLUG });

  if (!payload && config.failClosed) {
    return { allowed: false, userId: null, accessLevel: "user" };
  }

  const decision: HuplaAccessDecision = {
    allowed: payload?.allowed !== false,
    userId: typeof payload?.userId === "string" && payload.userId ? payload.userId : null,
    accessLevel: payload?.accessLevel === "admin" ? "admin" : "user"
  };

  accessCache.set(email, { decision, expiresAt: Date.now() + CHECK_CACHE_MS });
  return decision;
}

export async function recordHuplaSession(input: {
  email: string;
  sessionId: string;
  action: "start" | "heartbeat" | "end";
  path?: string;
  exitReason?: string;
  userAgent?: string;
}) {
  return postToHupla("/session", {
    email: input.email,
    applicationSlug: APPLICATION_SLUG,
    sessionId: input.sessionId,
    action: input.action,
    path: input.path,
    exitReason: input.exitReason,
    userAgent: input.userAgent
  });
}
