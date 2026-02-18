import type { AnalyticsSummary } from "./summarize";

export function buildInsightsPrompt(summary: AnalyticsSummary): string {
  return `
You are a short-term rental revenue analyst. Based ONLY on the metrics below,
return a JSON object with keys "narrative" (2–3 sentences) and "actions"
(array of up to 4 specific, actionable recommendations).

Metrics:
${JSON.stringify(summary, null, 2)}

Respond with valid JSON only.
`.trim();
}

export function buildChatPrompt(summary: AnalyticsSummary, question: string) {
  return [
    {
      role: "system" as const,
      content: `You are a data assistant for a short-term rental portfolio.
Answer questions using ONLY the metrics provided. If the answer cannot be
derived from the metrics, say so clearly. Be concise.

Metrics:
${JSON.stringify(summary, null, 2)}`,
    },
    { role: "user" as const, content: question },
  ];
}
