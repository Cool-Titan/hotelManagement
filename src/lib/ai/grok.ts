// Thin client for xAI's chat completions API (OpenAI-compatible) using
// structured outputs, so the model must answer in our JSON schema.

export type ModelCall = (args: { system: string; user: string }) => Promise<{ content: string; model: string }>;

export const TRIAGE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["category", "confidence", "complaint_signal", "summary", "urgency", "extracted", "missing_info", "draft_reply"],
  properties: {
    category: { type: "string", enum: ["ROOM", "WEDDING", "OFFSITE", "COMPLAINT", "OTHER"] },
    confidence: { type: "number", description: "0 to 1. How sure you are of the category." },
    complaint_signal: { type: "boolean", description: "True if the guest is unhappy about anything, even inside another kind of enquiry." },
    summary: { type: "string", description: "One line, at most 140 characters, for the inbox list." },
    urgency: { type: "string", enum: ["low", "normal", "high"] },
    extracted: {
      type: "object",
      additionalProperties: false,
      required: ["check_in", "check_out", "date_text", "nights", "adults", "children", "guests", "budget_inr", "room_preference"],
      properties: {
        check_in: { type: ["string", "null"], description: "YYYY-MM-DD only when a specific day is stated" },
        check_out: { type: ["string", "null"], description: "YYYY-MM-DD only when it can be derived" },
        date_text: { type: ["string", "null"], description: "Dates exactly as the guest wrote them" },
        nights: { type: ["integer", "null"] },
        adults: { type: ["integer", "null"] },
        children: { type: ["integer", "null"] },
        guests: { type: ["integer", "null"], description: "Total headcount" },
        budget_inr: { type: ["integer", "null"], description: "Budget in rupees if stated, e.g. 5 lakh = 500000" },
        room_preference: { type: ["string", "null"], enum: ["ROOM", "SUITE", "VILLA", null] },
      },
    },
    missing_info: { type: "array", items: { type: "string" }, description: "Facts staff must ask for before quoting" },
    draft_reply: { type: "string" },
  },
} as const;

export function grokConfigured(): boolean {
  return Boolean(process.env.XAI_API_KEY);
}

export function grokModelName(): string {
  return process.env.XAI_MODEL || "grok-4-fast-non-reasoning";
}

export const callGrok: ModelCall = async ({ system, user }) => {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY is not set");
  const model = grokModelName();
  const res = await fetch(`${process.env.XAI_BASE_URL || "https://api.x.ai/v1"}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(20_000),
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "enquiry_triage", strict: true, schema: TRIAGE_JSON_SCHEMA },
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`xAI API ${res.status}: ${body.slice(0, 200)}`);
  }
  const json = (await res.json()) as { model?: string; choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error("xAI API returned no content");
  return { content, model: json.model ?? model };
};
