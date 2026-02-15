# Multi-Property Rental Analytics

A web application to analyze rental platform exports (Airbnb first) and present clear financial performance per listing/location.

## What this does (Alpha)

- Upload a daily report spreadsheet (CSV/XLSX) from a supported format (Airbnb v1).
- Parse and normalize data client-side.
- Compute KPIs per listing and per month:
  - Total revenue / net payout per listing
  - Occupancy rate (if available in export)
  - Monthly rollups and comparisons
- Show a dashboard with tables and charts.
- Provide rule-based (non-AI) insights.

> Alpha is designed to work without accounts and (optionally) without persistence.

---

## Tech Stack (Summary)

Frontend:

- Cloudflare Pages
- Astro + React islands
- TypeScript
- Tailwind CSS + shadcn/ui
- Chart.js

Core data processing:

- Client-side parsing (CSV/XLSX) in a Web Worker
- Canonical schema normalization + metrics engine

Analytics:

- PostHog **direct-to-PostHog ingestion** (no Cloudflare proxy)

Backend (when AI is added):

- Cloudflare Workers (BFF/API proxy)
- OpenAI Responses API (MVP+)

Full architecture and decisions: see `TECH_STACK.md`.

---

## Repo Structure (Proposed)

This structure supports multiple agents working in parallel and keeps domain logic testable and reusable.

```
root
├─ .github/
│  └─ workflows/
├─ apps/
│  ├─ web/              # Astro + React frontend (Cloudflare Pages)
│  │  ├─ src/
│  │  ├─ public/
│  │  └─ astro.config.mjs
│  └─ api/              # Cloudflare Worker API (optional in Alpha)
│     ├─ src/
│     └─ wrangler.toml
├─ packages/
│  ├─ core/             # Canonical schema, metrics, insights rules
│  │  ├─ src/
│  │  └─ test/
│  └─ importers/        # Importers per platform/version + fixtures
│     ├─ airbnb/
│     │  └─ v1/
│     └─ test/
├─ scripts/             # Dev scripts, fixture tooling
├─ config/              # Shared config, constants, env templates
├─ docs/                # Additional documentation (optional)
├─ .env.example
├─ package.json
└─ bun.lockb
```

---

## Getting Started

### Prerequisites

- **Bun** (recommended runtime for installs and scripts)
  - If your environment requires Node, use Node LTS, but keep parity with Bun scripts.

### Install

From the repo root:

```bash
bun install
```

### Run the web app

```bash
bun run dev:web
```

Open the printed local URL.

### Run tests

```bash
bun run test
```

### Lint / typecheck

```bash
bun run lint
bun run typecheck
```

---

## Environment Variables

### Web (`apps/web`)

Create `apps/web/.env` (or use repo-level env injection depending on your setup).

PostHog (direct to PostHog, no proxy):

```
PUBLIC_POSTHOG_KEY=...
PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
# or
PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com
```

We intentionally do not set up a reverse proxy through Cloudflare.

### API (`apps/api`) (MVP+)

Only required when adding AI or persistence.

```
OPENAI_API_KEY=...          # stored as Worker secret, not in plaintext files
TURNSTILE_SECRET_KEY=...    # if Turnstile is used
APP_ENV=dev|staging|prod
```

---

## Development Workflow (Multi-Agent)

### Branching

`main` is deployable.

Feature branches:

- `feat/import-airbnb-v1`
- `feat/dashboard-kpis`
- `feat/rules-insights`
- `feat/posthog-events`

### Ownership boundaries

- `packages/core`: canonical schema + KPI calculations + rule engine
- `packages/importers`: file parsing + mapping from raw export → canonical schema
- `apps/web`: UI, upload flow, dashboard, charts
- `apps/api`: only when needed (AI proxy, quotas, persistence)

### Code standards

- Keep importer and KPI logic pure and unit-tested.
- Avoid coupling UI components to raw export columns.
- Prefer typed canonical models as the boundary between importers and UI.

---

## Alpha Feature Checklist

### Import + Normalize

- [ ] Support Airbnb export format v1 (CSV/XLSX)
- [ ] Validate required columns and data types
- [ ] Normalize to `DailyListingMetric[]`

### Metrics

- [ ] Monthly rollups per listing
- [ ] KPIs (occupancy, ADR, RevPAR) where available
- [ ] Guardrails: division by zero, missing fields, currency consistency

### Dashboard

- [ ] KPI summary cards
- [ ] Listings comparison table
- [ ] Time-series revenue chart
- [ ] Monthly breakdown view

### Insights (rules-based)

- [ ] Underperforming listings detection
- [ ] Strong performers detection
- [ ] Data quality warnings

### Analytics (PostHog)

- [ ] `$pageview`
- [ ] `file_uploaded` (metadata only)
- [ ] `report_generated`
- [ ] `export_clicked` (if export exists)

---

## Notes on Privacy

- Default stance: keep spreadsheet processing client-side.
- Do not log or send raw spreadsheet rows to analytics.
- Only send metadata: counts, totals, format version, and anonymized identifiers.

---

## Scripts (Suggested)

Define these in the root `package.json`:

- `dev:web` → runs `apps/web` dev server
- `dev:api` → runs Worker dev server (when present)
- `test` → runs unit tests across packages
- `lint` → lint all workspaces
- `typecheck` → TypeScript checks
- `format` → formatter (if enabled)

---

## Next Steps

1. Implement canonical schema + metrics engine in `packages/core`
2. Build Airbnb v1 importer with fixtures + tests in `packages/importers`
3. Build upload → parse → compute → dashboard flow in `apps/web`
4. Add API layer only when AI is introduced

For full architecture and decisions, see `TECH_STACK.md`.
