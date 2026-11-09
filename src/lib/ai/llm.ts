// Picks the configured LLM provider. Gemini if GEMINI_API_KEY is set,
// otherwise xAI Grok if XAI_API_KEY is set, otherwise none (rule-based fallback).
import { callGrok, type ModelCall } from "./grok";
import { callGemini } from "./gemini";

export type Provider = "gemini" | "xai" | null;

export function aiProvider(): Provider {
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.XAI_API_KEY) return "xai";
  return null;
}

export function modelCall(): ModelCall | null {
  const p = aiProvider();
  return p === "gemini" ? callGemini : p === "xai" ? callGrok : null;
}
