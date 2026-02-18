# LLM Integration — Airbnb Analytics

## Overview

This document describes the architecture for integrating OpenAI `gpt-4o-mini` into the Airbnb Analytics dashboard. The design prioritizes cost control, key security, and a minimal data footprint sent to the LLM.

---

## Architecture

```
Browser (React)
    │
    │  POST /api/insights
    │  POST /api/chat
    ▼
Cloudflare Worker  (apps/api)          ← BFF — keys never leave the server
    │  sends compact summarized JSON
    ▼
OpenAI  gpt-4o-mini
```

The Cloudflare Worker acts as a Backend-for-Frontend (BFF). The OpenAI API key is stored as a Cloudflare Worker secret and is never exposed to the browser. All quota enforcement, caching, and prompt assembly happen inside the Worker.

---

## 1. Cloudflare Worker BFF (`apps/api`)

### Project structure

```
apps/api/
├── src/
│   ├── index.ts          # Router — dispatches to handlers
│   ├── insights.ts       # POST /api/insights handler
│   ├── chat.ts           # POST /api/chat handler
│   ├── summarize.ts      # AnalyticsData → compact summary JSON
│   ├── cache.ts          # KV-backed cache keyed by dataset hash
│   └── limits.ts         # Token cap constants and enforcement
├── wrangler.toml
└── package.json
```

### Wrangler config (`wrangler.toml`)

```toml
name = "airbnb-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

kv_namespaces = [
  { binding = "INSIGHTS_CACHE", id = "<KV_NAMESPACE_ID>" }
]

# Store the key with:  wrangler secret put OPENAI_API_KEY
```

### Router (`src/index.ts`)

```ts
import { handleInsights } from "./insights";
import { handleChat } from "./chat";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (request.method === "POST" && pathname === "/api/insights")
      return handleInsights(request, env);

    if (request.method === "POST" && pathname === "/api/chat")
      return handleChat(request, env);

    return new Response("Not found", { status: 404 });
  },
};

export interface Env {
  OPENAI_API_KEY: string;
  INSIGHTS_CACHE: KVNamespace;
}
```

---

## 2. Compact Summary Payload

Raw transaction rows are **never** sent to the LLM. Before any API call the Worker receives a pre-computed summary from the browser (assembled client-side from the already-loaded dataset).

### Summary schema

```ts
interface AnalyticsSummary {
  currency: string;              // e.g. "USD"
  dateRange: { from: string; to: string };  // ISO dates

  kpis: {
    totalRevenue: number;
    avgNightlyRate: number;
    occupancyRate: number;       // 0–1
    totalBookings: number;
    avgLengthOfStay: number;     // nights
  };

  deltas: {                      // period-over-period % change
    revenue: number;
    occupancy: number;
    bookings: number;
    avgRate: number;
  };

  topMovers: {                   // up to 5 listings
    listing: string;
    revenueDelta: number;
    occupancyDelta: number;
  }[];

  warnings: string[];            // e.g. ["3 listings below 40% occupancy"]
}
```

### Client-side assembly (`src/lib/buildSummary.ts` in the React app)

```ts
import { AnalyticsData, AnalyticsSummary } from "@/types";

export function buildSummary(data: AnalyticsData): AnalyticsSummary {
  // Compute KPIs from data.transactions
  // Compute deltas vs previous period
  // Find top movers by revenue delta
  // Collect warnings (low occupancy, outlier rates, etc.)
  return { currency, dateRange, kpis, deltas, topMovers, warnings };
}
```

The summary is serialized to JSON (typically < 1 KB) and sent as the request body to the Worker.

### Dataset hash

The browser also computes a hash of the source data to enable cache lookups:

```ts
import { sha256 } from "@/lib/hash";

const datasetHash = await sha256(JSON.stringify(rawData) + JSON.stringify(settings));
```

This hash is included in every request:

```json
{ "datasetHash": "abc123...", "summary": { ... } }
```

---

## 3. Endpoints

### `POST /api/insights`

Returns a short narrative and prioritized action items based on the current metrics.

**Request body**
```json
{
  "datasetHash": "abc123...",
  "summary": { ...AnalyticsSummary }
}
```

**Response**
```json
{
  "narrative": "Revenue grew 12% YoY driven by your top 2 listings...",
  "actions": [
    "Raise nightly rate on Listing A by ~8% — occupancy remains above 80%.",
    "Investigate Listing C: occupancy dropped 15 pp this quarter."
  ],
  "cached": false
}
```

**Worker handler (`src/insights.ts`)**

```ts
import { Env } from "./index";
import { buildInsightsPrompt } from "./prompts";
import { getCached, setCached } from "./cache";
import { MAX_TOKENS_INSIGHTS } from "./limits";
import { callOpenAI } from "./openai";

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
```

---

### `POST /api/chat`

Answers a free-form question grounded in the computed metrics. Does **not** hallucinate data outside the summary.

**Request body**
```json
{
  "datasetHash": "abc123...",
  "summary": { ...AnalyticsSummary },
  "message": "Which listing had the biggest occupancy drop?"
}
```

**Response**
```json
{
  "answer": "Listing C saw the largest occupancy drop, down 15 percentage points...",
  "cached": false
}
```

**Worker handler (`src/chat.ts`)**

```ts
import { Env } from "./index";
import { buildChatPrompt } from "./prompts";
import { getCached, setCached } from "./cache";
import { MAX_TOKENS_CHAT } from "./limits";
import { callOpenAI } from "./openai";

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
```

---

## 4. Cost Controls

### Token caps (`src/limits.ts`)

```ts
export const MAX_TOKENS_INSIGHTS = 400;  // ~300 words of output
export const MAX_TOKENS_CHAT     = 300;  // shorter conversational answer
```

`gpt-4o-mini` input costs are negligible for a ~1 KB summary payload. Output is the main driver — these caps keep each call under ~$0.001.

### On-demand only

LLM calls are **never** triggered automatically (no background jobs, no debounced watchers). The user must explicitly press an "Generate Insights" or "Ask" button. The React app dispatches the fetch only on that explicit user action.

### KV cache (`src/cache.ts`)

```ts
const TTL_SECONDS = 60 * 60 * 24; // 24 hours

export async function getCached(kv: KVNamespace, key: string) {
  const raw = await kv.get(key, "json");
  return raw ?? null;
}

export async function setCached(kv: KVNamespace, key: string, value: unknown) {
  await kv.put(key, JSON.stringify(value), { expirationTtl: TTL_SECONDS });
}
```

Cache key = `insights:<datasetHash>` or `chat:<datasetHash>:<messageHash>`.
A cache hit returns the stored result immediately with `"cached": true` and incurs zero OpenAI spend.

---

## 5. Prompts

### Insights prompt

```ts
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
```

### Chat system prompt

```ts
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
```

---

## 6. Browser Integration

```ts
// React — triggered only by explicit user action
async function fetchInsights() {
  const summary = buildSummary(analyticsData);
  const datasetHash = await sha256(JSON.stringify(rawData) + JSON.stringify(settings));

  const res = await fetch("/api/insights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ datasetHash, summary }),
  });

  const data = await res.json();
  setInsights(data);
}
```

The Vite dev proxy (`vite.config.ts`) forwards `/api/*` to the local Worker (`wrangler dev --port 8787`) during development:

```ts
server: {
  proxy: {
    "/api": "http://localhost:8787",
  },
},
```

---

## Security Notes

- The `OPENAI_API_KEY` is a Cloudflare Worker secret — it never appears in client bundles, logs, or responses.
- No raw transaction data leaves the browser; only the pre-aggregated summary is transmitted.
- CORS should be restricted to the production domain in the Worker once deployed.
