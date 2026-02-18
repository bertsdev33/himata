# airbnb-api — Cloudflare Worker BFF

Cloudflare Worker that acts as a Backend-for-Frontend (BFF) between the React dashboard and OpenAI. It exposes two endpoints used by the AI features on the Portfolio Overview tab.

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

**Why a BFF?**

- The `OPENAI_API_KEY` is stored as a Cloudflare Worker secret. It is never included in client bundles, logs, or HTTP responses.
- Raw transaction rows never leave the browser. The React app pre-computes a compact `AnalyticsSummary` (< 1 KB) from the already-loaded dataset and sends only that to the Worker.
- All quota enforcement, prompt assembly, and caching happen server-side.

**KV cache**

Every response is cached in Cloudflare KV for 24 hours, keyed by a hash of the dataset and (for chat) the message. A cache hit returns the stored result immediately with `"cached": true` and incurs zero OpenAI spend. This makes repeated views of the same dataset essentially free.

**Cost controls**

- `gpt-4o-mini` is used for all calls.
- Output is capped at 400 tokens for insights and 300 tokens for chat.
- LLM calls are **never** triggered automatically — only on explicit user action ("Generate Insights" button or "Ask" send).

---

## Project structure

```
apps/api/
├── src/
│   ├── index.ts          # Router — dispatches to handlers
│   ├── insights.ts       # POST /api/insights handler
│   ├── chat.ts           # POST /api/chat handler
│   ├── summarize.ts      # AnalyticsSummary type definition
│   ├── cache.ts          # KV-backed cache (get/set with 24 h TTL)
│   ├── limits.ts         # Token cap constants
│   ├── openai.ts         # Thin fetch wrapper for the OpenAI API
│   └── prompts.ts        # buildInsightsPrompt / buildChatPrompt
├── tsconfig.json
├── wrangler.toml
└── package.json
```

---

## Local dev setup

### 1. Install dependencies

```bash
cd apps/api
bun install
```

### 2. Set the OpenAI secret locally

Wrangler reads `.dev.vars` for local secrets (never commit this file):

```bash
# apps/api/.dev.vars
OPENAI_API_KEY=sk-...
```

### 3. Create a KV namespace (once)

```bash
bunx wrangler kv:namespace create INSIGHTS_CACHE
```

Copy the returned `id` into `wrangler.toml`:

```toml
kv_namespaces = [
  { binding = "INSIGHTS_CACHE", id = "<paste-id-here>" }
]
```

For local dev, also add a `preview_id` (create with `--preview` flag):

```bash
bunx wrangler kv:namespace create INSIGHTS_CACHE --preview
```

```toml
kv_namespaces = [
  { binding = "INSIGHTS_CACHE", id = "<prod-id>", preview_id = "<preview-id>" }
]
```

### 4. Start the Worker

```bash
bun run dev          # wrangler dev — listens on http://localhost:8787
```

### 5. Start the frontend with proxy

The Vite dev server in `apps/web` proxies `/api/*` to `http://localhost:8787`:

```bash
# in a second terminal
cd apps/web
bun run dev          # astro dev — listens on http://localhost:4321
```

All `/api/insights` and `/api/chat` requests from the browser are forwarded to the Worker automatically.

---

## Endpoints

### `POST /api/insights`

Returns a short narrative and prioritized action items.

**Request**
```json
{
  "datasetHash": "abc123...",
  "summary": { ...AnalyticsSummary }
}
```

**Response**
```json
{
  "narrative": "Revenue grew 12% driven by your top 2 listings...",
  "actions": ["Raise nightly rate on Listing A by ~8%.", "Investigate Listing C."],
  "cached": false
}
```

### `POST /api/chat`

Answers a free-form question grounded in the computed metrics.

**Request**
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
  "answer": "Listing C saw the largest occupancy drop...",
  "cached": false
}
```

---

## Frontend components

Both components live in `apps/web/src/components/dashboard/` and are rendered at the bottom of the **Portfolio Overview** tab.

### `InsightsPanel`

```tsx
import { InsightsPanel } from "@/components/dashboard/InsightsPanel";

<InsightsPanel analytics={analytics} />
```

- Renders a "Generate Insights" button.
- On click: builds the summary, computes a dataset hash, calls `POST /api/insights`.
- Displays the narrative and a numbered action list.
- Shows a "cached" badge when the result came from KV.
- Shows a "Regenerate" button after the first result.

### `ChatPanel`

```tsx
import { ChatPanel } from "@/components/dashboard/ChatPanel";

<ChatPanel analytics={analytics} />
```

- Renders a text input and send button (Enter key also submits).
- Maintains a scrollable conversation history.
- Each answer is grounded strictly in the summary metrics — the LLM is instructed to say so if a question falls outside the data.
- Shows a "cached" badge on assistant messages served from KV.

Both components call `buildSummary(analytics)` from `@/lib/buildSummary` and `sha256` from `@/lib/hash` to prepare the request payload. They expect `analytics: AnalyticsData` (the full object from app state), not the filtered sub-views.

---

## Deployment

### 1. Set the production secret

```bash
cd apps/api
bunx wrangler secret put OPENAI_API_KEY
# paste the key when prompted
```

### 2. Update `wrangler.toml` with the production KV namespace ID

The `id` field must point to the production namespace (not the preview one).

### 3. Deploy

```bash
bun run deploy       # wrangler deploy
```

### 4. CORS

For production, restrict CORS in `src/index.ts` to your deployed domain:

```ts
const ALLOWED_ORIGIN = "https://your-domain.com";

// In the fetch handler, add before routing:
if (request.method === "OPTIONS") {
  return new Response(null, {
    headers: {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "POST",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
```

Add `"Access-Control-Allow-Origin": ALLOWED_ORIGIN` to the `jsonResponse` helper headers in `insights.ts` and `chat.ts`.
