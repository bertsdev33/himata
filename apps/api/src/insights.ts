import type { Env } from "./index";
import { buildInsightsPrompt } from "./prompts";
import { getCached, setCached } from "./cache";
import { MAX_TOKENS_INSIGHTS } from "./limits";
import { callOpenAI } from "./openai";

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function handleInsights(req: Request, env: Env): Promise<Response> {
  const { datasetHash, summary } = await req.json();

  const cached = await getCached(env.INSIGHTS_CACHE, `insights:${datasetHash}`);
  if (cached) return jsonResponse({ ...cached, cached: true });

  const prompt = buildInsightsPrompt(summary);
  const result = await callOpenAI(env.OPENAI_API_KEY, {
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    max_tokens: MAX_TOKENS_INSIGHTS,
    response_format: { type: "json_object" },
  });

  const parsed = JSON.parse(result.choices[0].message.content);
  await setCached(env.INSIGHTS_CACHE, `insights:${datasetHash}`, parsed);

  return jsonResponse({ ...parsed, cached: false });
}
