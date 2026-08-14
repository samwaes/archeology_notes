"use client";

import { useEffect, useRef } from "react";

const HEARTBEAT_INTERVAL_MS = 60_000;
const ACTIVE_WINDOW_MS = 5 * 60_000;

export default function AccessUsageTracker() {
  const sessionId = useRef<string>("");
  const lastInteractionAt = useRef<number>(Date.now());

  useEffect(() => {
    sessionId.current = crypto.randomUUID();
    const endpoint = "/api/hupla-access/session";

    const post = (action: "start" | "heartbeat" | "end", useBeacon = false) => {
      if (!sessionId.current) return;
      const body = JSON.stringify({
        sessionId: sessionId.current,
        action,
        path: window.location.pathname,
        exitReason: action === "end" ? "page-hidden" : undefined
      });

      if (useBeacon && navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
        return;
      }

      void fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        credentials: "include",
        keepalive: action === "end"
      });
    };

    const markActive = () => { lastInteractionAt.current = Date.now(); };
    const heartbeat = () => {
      const recentlyActive = Date.now() - lastInteractionAt.current < ACTIVE_WINDOW_MS;
      if (document.visibilityState === "visible" && recentlyActive) post("heartbeat");
    };
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") post("end", true);
      else {
        lastInteractionAt.current = Date.now();
        post("start");
      }
    };

    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((event) => window.addEventListener(event, markActive, { passive: true }));
    document.addEventListener("visibilitychange", handleVisibility);
    const timer = window.setInterval(heartbeat, HEARTBEAT_INTERVAL_MS);
    post("start");

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", handleVisibility);
      events.forEach((event) => window.removeEventListener(event, markActive));
      post("end", true);
    };
  }, []);

  return null;
}
