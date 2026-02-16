# Tech Stack & Architecture Specification

Project: Multi-Property Rental Financial Analytics
Stage: Alpha → MVP (AI + persistence later)
Last updated: 2026-02-15

---

## 1) Goal and Context

We are building a web application that helps owners with multiple rentals (Airbnb and similar) understand financial performance per listing/location.

### Alpha release goals

- User uploads a spreadsheet export (CSV/XLSX) in a supported format (Airbnb v1).
- App extracts key metrics:
  - Total revenue / net payout per listing
  - Average occupancy rates (where available)
  - Monthly rollups and comparisons
  - Rule-based insights (non-AI)
- Simple dashboard showing charts + tables.
- **No accounts and no persistence required** for the first alpha (unless explicitly added).

### MVP / later goals

- Accounts, orgs, saved dashboards, historical comparisons.
- AI insights + chat about uploaded data.
- Multiple importers (Vrbo, Booking.com, custom templates).
- More robust profitability (requires expenses inputs/integrations).

---

## 2) Key Architectural Decisions

### 2.1 Backend philosophy

Even if the product is mostly frontend, **AI integration requires a backend** (to keep secrets and enforce quotas). The Alpha can ship with no backend _if it has no AI_.

**Principles**

- Browser is untrusted: never store AI keys client-side.
- Minimize backend scope: use a thin BFF (Backend-for-Frontend).
- Client-side parsing reduces cost and avoids edge runtime constraints.
- When AI exists, enforce quotas, rate limiting, and abuse controls.

---

## 3) Final Stack (Recommended)

### 3.1 Frontend (Web App)

**Hosting**

- **Cloudflare Pages** (global CDN, simple deploy)

**Framework**

- **Astro** for static portions + performance
- **React** islands for interactive dashboard components

**Language**

- **TypeScript** (required)

**Styling/UI**

- **Tailwind CSS**
- **shadcn/ui** components

**Charts**

- **Chart.js** (Alpha)
  - Upgrade path: consider ECharts / Visx / Recharts if needs outgrow Chart.js

**Spreadsheet Parsing**

- Client-side parsing in a Web Worker:
  - CSV: PapaParse (or equivalent)
  - XLSX: SheetJS (or equivalent)

**Why client-side parsing**

- Lower infra cost
- Better privacy posture (we can avoid uploading raw spreadsheets)
- Avoid edge runtime memory/CPU limitations
- Faster iteration for alpha
- Keep frontend bundles lean for Cloudflare Pages delivery; avoid large client payloads and unnecessary dependencies.

---

### 3.2 Backend (BFF / API)

**When needed**

- Required for any AI functionality
- Optional for persistence, sharing, or multi-user collaboration

**Runtime**

- **Cloudflare Workers** (recommended)

**Responsibilities**

- Proxy AI requests (keep secrets server-side)
- Rate limit + quota enforcement
- Turnstile verification (if used)
- Usage metering
- Optional: persistence API (save report summary, user settings)

**Endpoints (proposed)**

- `POST /api/analyze`
  Input: normalized aggregated JSON
  Output: computed insights (rule-based now, AI later)

- `POST /api/chat` (MVP+)
  Input: conversation + dataset summary
  Output: AI response + citations to computed metrics (where possible)

- `GET /api/health`
  Output: status/version

- `GET /api/usage` (MVP+)
  Output: user/org usage and quota status

---

### 3.3 Data Storage (MVP+)

Alpha does not require persistence. For MVP+:

**Relational**

- Cloudflare **D1**: users, orgs, properties, reports metadata

**Object storage**

- Cloudflare **R2** (optional): store raw uploads _only if needed_
  - Default stance: do not store raw spreadsheet unless user opts in

**Caching**

- Workers **KV** for small cached artifacts (non-sensitive)
- Durable Objects if strong coordination is needed (later)

---

### 3.4 AI Integration (MVP+)

**Primary**

- OpenAI **Responses API**
- Keep AI keys in Worker secrets

**Data strategy**

- Prefer sending compact, normalized summaries (JSON), not full spreadsheets.
- Use bounded prompts, with strict token and time limits.

**Budget controls**

- Per-user/per-org quotas (daily/monthly)
- Per-request caps (max tokens, max data size)
- Hard "deny-by-default" when over budget

**Observability**

- Log request metadata and spend estimates (no raw PII)

**Optional**

- Cloudflare AI Gateway for centralized logging, caching, and routing (later)

---

### 3.5 Analytics: PostHog (Direct-to-PostHog, No Cloudflare Proxy)

#### Requirement

**All PostHog events MUST go directly from client → PostHog ingestion.**
We do **NOT** proxy PostHog through Cloudflare Workers/Pages Functions.

#### Why

- Avoid additional Worker/Function requests tied to analytics volume
- Simpler, less operational overhead
- Lower Cloudflare billing risk
- Clear separation: Pages serves the app; PostHog receives analytics

#### PostHog configuration (client-side)

We will configure PostHog to send to PostHog's ingestion host.

**Example (TypeScript)**

```ts
import posthog from "posthog-js";

posthog.init(import.meta.env.PUBLIC_POSTHOG_KEY, {
  api_host: import.meta.env.PUBLIC_POSTHOG_HOST, // e.g. "https://us.i.posthog.com" or "https://eu.i.posthog.com"
  autocapture: false, // default recommendation for predictable event volume
  capture_pageview: true,
  capture_pageleave: true,
  // session_recording: false (enable later only if needed)
});
```

**Environment variables**

- `PUBLIC_POSTHOG_KEY` = PostHog project API key
- `PUBLIC_POSTHOG_HOST` = ingestion host:
  - US: `https://us.i.posthog.com`
  - EU: `https://eu.i.posthog.com`

**Important**

- Do not set up a reverse proxy.
- Do not route through `yourdomain.com/ingest`.
- Do not use Workers/Functions to forward analytics.

#### Event strategy (recommended for Alpha)

- Keep event volume intentional:
  - `$pageview` (enabled)
  - `file_uploaded` (when a file is selected and parsed)
  - `report_generated` (when dashboard is computed successfully)
  - `export_clicked` (if exporting is added)
- Prefer `autocapture: false` until we need deeper UI analytics.

#### Privacy

- Avoid capturing raw spreadsheet content.
- Avoid capturing PII fields.
- Keep properties to metadata: row count, file type, import format version, listing count, currency.

---

### 3.6 Authentication (MVP+)

Not required for Alpha. When introduced:

- Use email/password + magic links or OAuth (provider TBD)
- Store auth session tokens securely (HttpOnly cookies if using a backend domain)
- Consider Cloudflare Turnstile on signup/login to prevent abuse

---

## 4) Development Runtime: Bun.js (Suggested)

### Recommendation

Use **Bun** as the development runtime and package manager to speed installs and scripts.

**Pros**

- Fast installs and script execution
- Can run many Node-compatible tools
- Good DX for mono-repo scripting

**Considerations**

- Some ecosystem edge cases still exist vs Node
- CI should standardize the runtime to avoid agent drift

### Policy

- Primary runtime for local dev: **Bun**
- CI may run either:
  - Bun (preferred if stable across the toolchain)
  - or Node LTS for maximum compatibility
- If we use Bun, document it clearly and pin versions (via `.tool-versions` or similar).

---

## 5) Importer & Metrics Design (Core Domain)

### 5.1 Canonical schema (internal)

We normalize all imports to a stable internal schema.

**Example:**
`DailyListingMetric`

- `date` (ISO)
- `listing_id` (string)
- `listing_name` (string)
- `booked_nights` (number)
- `available_nights` (number)
- `gross_revenue` (number)
- `platform_fees` (number)
- `net_payout` (number)
- `currency` (string)
- `source` (e.g., "airbnb")
- `source_version` (e.g., "v1")

### 5.2 KPI definitions

- Occupancy rate = `booked_nights / available_nights` (if available)
- ADR = `gross_revenue / booked_nights` (if booked_nights > 0)
- RevPAR = `gross_revenue / available_nights` (if available_nights > 0)
- Net payout = export-provided payout after platform fees
- Profitability (alpha) = net payout only
  Profitability (later) = net payout - expenses (user-provided)

### 5.3 Rule-based insights (Alpha)

Implement as deterministic rules over computed metrics:

- Listing underperforming: bottom quartile revenue and occupancy
- Strong performer: top quartile revenue with stable occupancy
- Seasonality hints: month-over-month variance thresholds
- Missing data warnings: null fields, inconsistent currency, zero available nights

All rule outputs should include:

- rule id
- short explanation
- metric evidence (numbers)
- confidence (low/medium/high)

---

## 6) Security & Abuse Mitigation

### Alpha

- No backend secrets required (if no AI).
- Keep processing local.
- File size limits enforced client-side.

### AI-enabled phases

- Backend required:
  - AI keys in Worker secrets
  - quotas + rate limits
  - Turnstile for bot mitigation on AI endpoints

**Never rely on CORS as security.** It is a browser policy, not an access control boundary.

---

## 7) Observability

### Frontend

- PostHog for product analytics (direct-to-PostHog)
- Optional: Sentry for errors (later)

### Backend (Workers)

- Structured logs (request id, user id, endpoint, latency, quota result)
- Redact raw inputs

---

## 8) CI/CD and Environments

### Environments

- `dev` (local)
- `staging` (preview)
- `prod`

### Deployment

- Frontend: Cloudflare Pages (Git integration)
- Backend: Wrangler deploy (Workers)

### Required checks

- Lint + typecheck
- Unit tests for importer + metrics engine
- Basic e2e smoke test (upload sample → dashboard renders)

---

## 9) Ownership & Working Agreement (Multi-Agent)

To avoid stepping on each other:

- All domain logic lives in a shared package (e.g., `packages/core`)
- Importers are versioned (e.g., `airbnb/v1`, `airbnb/v2`)
- Every importer has:
  - sample fixture file
  - unit tests proving output schema is stable
- Dashboard UI consumes only canonical schema + computed summary, never raw parsing internals

---

## 10) Future Extensions (Not Alpha)

- Saved reports
- Team sharing
- Expense entry and profit reporting
- Multi-platform importers
- AI chat with persisted dataset references
- Export to PDF/CSV, scheduled email reports
