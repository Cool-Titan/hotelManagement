import { afterEach, describe, expect, it, vi } from "vitest";
import { aiProvider, modelCall } from "../src/lib/ai/llm";
import { callGemini } from "../src/lib/ai/gemini";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const ok = (text: string) =>
  new Response(JSON.stringify({ modelVersion: "gemini-test", candidates: [{ content: { parts: [{ text }] } }] }), { status: 200 });

describe("provider selection", () => {
  it("prefers Gemini, then xAI, else none (fallback rules)", () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    vi.stubEnv("XAI_API_KEY", "");
    expect(aiProvider()).toBeNull();
    expect(modelCall()).toBeNull();
    vi.stubEnv("XAI_API_KEY", "x");
    expect(aiProvider()).toBe("xai");
    vi.stubEnv("GEMINI_API_KEY", "g");
    expect(aiProvider()).toBe("gemini");
  });
});

describe("Gemini client", () => {
  it("sends the schema and returns the model's JSON text", async () => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    const fetchMock = vi.fn().mockResolvedValue(ok('{"category":"ROOM"}'));
    vi.stubGlobal("fetch", fetchMock);
    const res = await callGemini({ system: "s", user: "u" });
    expect(res).toEqual({ content: '{"category":"ROOM"}', model: "gemini-test" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toMatch(/models\/gemini-3\.5-flash-lite:generateContent$/);
    expect(init.headers["x-goog-api-key"]).toBe("test-key");
    const body = JSON.parse(init.body);
    expect(body.generationConfig.responseMimeType).toBe("application/json");
    expect(body.generationConfig.responseJsonSchema.required).toContain("draft_reply");
  });

  it("retries once when the model is overloaded", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response("busy", { status: 503 })).mockResolvedValueOnce(ok("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callGemini({ system: "s", user: "u" })).resolves.toMatchObject({ content: "{}" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("moves to the next model when one stays overloaded", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "model-a, model-b");
    const busy = () => new Response("busy", { status: 503 });
    const fetchMock = vi.fn().mockResolvedValueOnce(busy()).mockResolvedValueOnce(busy()).mockResolvedValueOnce(ok("{}"));
    vi.stubGlobal("fetch", fetchMock);
    await expect(callGemini({ system: "s", user: "u" })).resolves.toMatchObject({ content: "{}" });
    expect(fetchMock.mock.calls.map((c) => String(c[0]).match(/models\/([^:]+)/)?.[1])).toEqual(["model-a", "model-a", "model-b"]);
  });

  it("gives up after every model is overloaded", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubEnv("GEMINI_MODEL", "model-a");
    vi.stubGlobal("fetch", vi.fn().mockImplementation(async () => new Response("busy", { status: 503 })));
    await expect(callGemini({ system: "s", user: "u" })).rejects.toThrow(/503 \(model-a\)/);
  });

  it("throws (so triage falls back) on errors and empty answers", async () => {
    vi.stubEnv("GEMINI_API_KEY", "k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("bad key", { status: 400 })));
    await expect(callGemini({ system: "s", user: "u" })).rejects.toThrow(/400/);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ candidates: [{ finishReason: "SAFETY" }] }))));
    await expect(callGemini({ system: "s", user: "u" })).rejects.toThrow(/SAFETY/);
  });
});
