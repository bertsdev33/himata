import type { Env } from "./index";
import { buildChatPrompt } from "./prompts";
import { getCached, setCached } from "./cache";
import { MAX_TOKENS_CHAT } from "./limits";
import { callOpenAI } from "./openai";

async function sha256(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleChat(req: Request, env: Env): Promise<Response> {
  const { datasetHash, summary, message } = await req.json();

  const cacheKey = `chat:${datasetHash}:${await sha256(message)}`;
  const cached = await getCached(env.INSIGHTS_CACHE, cacheKey);
  if (cached) return jsonResponse({ ...cached, cached: true });

  const messages = buildChatPrompt(summary, message);
  const result = await callOpenAI(env.OPENAI_API_KEY, {
    model: "gpt-4o-mini",
    messages,
    max_tokens: MAX_TOKENS_CHAT,
  });

  const answer = result.choices[0].message.content.trim();
  await setCached(env.INSIGHTS_CACHE, cacheKey, { answer });

  return jsonResponse({ answer, cached: false });
}
