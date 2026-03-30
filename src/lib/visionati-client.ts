/**
 * Visionati API client — UPDATED with correct endpoint and auth format.
 *
 * Correct API (confirmed from docs.visionati.com/api/analyze/):
 *   Base URL : https://api.visionati.com/api
 *   Endpoint : /fetch
 *   Auth     : X-API-Key: Token <key>
 *   Method   : POST
 *   Payload  : { url, backend?, feature?, role?, prompt?, language? }
 *
 * Env vars used:
 *   VISIONATI_API_KEY
 *   VISIONATI_BASE_URL        (default: https://api.visionati.com/api)
 *   VISIONATI_TIMEOUT_MS      (default: 45000)
 *   VISIONATI_DESCRIPTION_BACKENDS  (comma-separated, e.g. "openai")
 *   VISIONATI_FEATURES             (comma-separated, e.g. "descriptions")
 *   VISIONATI_ROLE                (default: "general")
 *   VISIONATI_LANGUAGE            (default: "English")
 *   VISIONATI_CUSTOM_PROMPT       (optional — overrides role)
 */

import { VISIONATI_SYSTEM_PROMPT } from "./visionati-prompt";

export type VisionatiDescribeInput = {
  imageUrl: string;
  userPrompt?: string; // optional — overrides system prompt
};

export type VisionatiDescribeOutput = {
  text: string;
  raw: unknown;
  model?: string;
};

// ── Env helpers ──────────────────────────────────────────────────────────────

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

// ── Visionati API call ───────────────────────────────────────────────────────

export async function describeImageWithVisionati(
  input: VisionatiDescribeInput
): Promise<VisionatiDescribeOutput> {
  // Default base URL is https://api.visionati.com/api (confirmed from docs)
  const baseUrl =
    process.env["VISIONATI_BASE_URL"] ?? "https://api.visionati.com/api";
  const apiKey = requiredEnv("VISIONATI_API_KEY");
  const timeoutMs = Number(process.env["VISIONATI_TIMEOUT_MS"] ?? "45000");

  const backends = (process.env["VISIONATI_DESCRIPTION_BACKENDS"] ?? "openai")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const features = (process.env["VISIONATI_FEATURES"] ?? "descriptions")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);

  const role =
    process.env["VISIONATI_ROLE"] ?? "general";
  const language =
    process.env["VISIONATI_LANGUAGE"] ?? "English";
  const customPrompt = process.env["VISIONATI_CUSTOM_PROMPT"];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  /**
   * Visionati payload (confirmed from docs.visionati.com/api/analyze/):
   * POST https://api.visionati.com/api/fetch
   * Auth: X-API-Key: Token <key>
   */
  const payload: Record<string, unknown> = {
    url: input.imageUrl,
    backend: backends,
    feature: features,
    role: role,
    language: language,
  };

  // If custom prompt is set, use it (overrides role for description persona)
  // Otherwise build from system + user prompt
  if (customPrompt) {
    payload.prompt = customPrompt;
  } else if (input.userPrompt) {
    // Visionati uses "prompt" field to pass custom prompt text
    // We pass the full system prompt + user context as one string
    payload.prompt = `${VISIONATI_SYSTEM_PROMPT}\n\n${input.userPrompt}`;
  }

  try {
    const res = await fetch(`${baseUrl}/fetch`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": `Token ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Visionati API error ${res.status}: ${body}`);
    }

    const json = (await res.json()) as Record<string, unknown>;

    // ── Extract description from sync response ────────────────────────────
    // Sync response shape (confirmed from docs):
    // {
    //   all: {
    //     assets: [{
    //       descriptions: [{ description: "...", source: "openai" }]
    //     }],
    //     errors: ["error message if URL fetch failed"]
    //   }
    // }
    const all = json["all"] as Record<string, unknown> | undefined;
    const assets = all?.["assets"] as Array<Record<string, unknown>> | undefined;
    const errors = all?.["errors"] as Array<string> | undefined;
    const firstAsset = assets?.[0];
    const descriptions = firstAsset?.["descriptions"] as
      | Array<Record<string, unknown>>
      | undefined;

    const firstDesc = descriptions?.[0];
    const text =
      (typeof firstDesc?.["description"] === "string"
        ? firstDesc["description"]
        : "") ?? "";

    const model =
      (typeof firstDesc?.["source"] === "string"
        ? firstDesc["source"]
        : undefined) ?? undefined;

    // Surface download errors clearly rather than giving a generic message
    if (errors && errors.length > 0 && (!text || !text.trim())) {
      throw new Error(
        `Visionati could not fetch image: ${errors.join("; ")}`
      );
    }

    if (!text || typeof text !== "string" || !text.trim()) {
      throw new Error(
        `Visionati response did not contain a usable description. Raw: ${JSON.stringify(json).slice(0, 300)}`
      );
    }

    return { text: text.trim(), raw: json, model };
  } finally {
    clearTimeout(timeout);
  }
}
