export type TranscriptionStatus = "not_requested" | "pending" | "completed" | "failed" | "disabled";

export function transcriptionConfiguration() {
  const apiKey = process.env.OPENAI_API_KEY?.trim() || "";
  const providerSetting = process.env.TRANSCRIPTION_PROVIDER?.trim().toLowerCase() || (apiKey ? "openai" : "disabled");
  const provider = providerSetting === "openai" ? "openai" : "disabled";
  const model = process.env.OPENAI_TRANSCRIPTION_MODEL?.trim() || "gpt-4o-mini-transcribe";
  const baseUrl = (process.env.OPENAI_API_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");

  return {
    provider,
    model,
    baseUrl,
    configured: provider === "openai" && Boolean(apiKey),
    apiKey
  };
}

export async function transcribeAudio(input: { bytes: Uint8Array; filename: string; mimeType: string }) {
  const config = transcriptionConfiguration();
  if (!config.configured) {
    throw new Error("Transcription is not configured.");
  }

  const arrayBuffer = new ArrayBuffer(input.bytes.byteLength);
  new Uint8Array(arrayBuffer).set(input.bytes);

  const body = new FormData();
  body.append("model", config.model);
  body.append("file", new File([arrayBuffer], input.filename, { type: input.mimeType || "application/octet-stream" }));

  const response = await fetch(`${config.baseUrl}/audio/transcriptions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body,
    cache: "no-store"
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Transcription service returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 240)}` : ""}`);
  }

  const result = await response.json() as { text?: string };
  const text = result.text?.trim() || "";
  if (!text) throw new Error("Transcription service returned no text.");

  return {
    text,
    provider: config.provider,
    model: config.model
  };
}
