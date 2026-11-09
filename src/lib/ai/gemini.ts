// Google Gemini API client (generateContent) with JSON-schema structured output.
import { TRIAGE_JSON_SCHEMA, type ModelCall } from "./grok";

/** Models to try in order (comma-separated GEMINI_MODEL); the next one is used if one is overloaded. */
export function geminiModels(): string[] {
  const list = (process.env.GEMINI_MODEL || "gemini-3.5-flash-lite,gemini-3.1-flash-lite")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return list.length ? list : ["gemini-3.5-flash-lite"];
}

const RETRYABLE = new Set([429, 500, 503]);

export const callGemini: ModelCall = async ({ system, user }) => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.2,
      responseMimeType: "application/json",
      responseJsonSchema: TRIAGE_JSON_SCHEMA,
    },
  });

  // Each model gets one retry for rate limits / overload (free tier); then the
  // next model is tried; if all fail the caller falls back to keyword rules.
  const models = geminiModels();
  let lastError = "";
  for (const model of models) for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": key },
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 20_000),
      body,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      lastError = `Gemini API ${res.status} (${model}): ${text.slice(0, 200)}`;
      if (!RETRYABLE.has(res.status)) throw new Error(lastError);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 1500));
      continue;
    }
    const json = (await res.json()) as {
      modelVersion?: string;
      candidates?: { content?: { parts?: { text?: string }[] }; finishReason?: string }[];
    };
    const cand = json.candidates?.[0];
    const content = cand?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!content) throw new Error(`Gemini returned no content (${cand?.finishReason ?? "no candidate"})`);
    return { content, model: json.modelVersion ?? model };
  }
  throw new Error(lastError || "Gemini unavailable");
};
