# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install
bun install

# Dev
bun run dev:web                          # Astro dev server (apps/web)

# Build
bun run build:web                        # Astro production build

# Type checking
bun run typecheck                        # All packages + Astro check

# Tests (bun:test, NOT vitest)
bun test --recursive                     # All tests (247 across 22 files)
cd packages/core && bun test             # Single package
cd packages/core && bun test allocation.test.ts  # Single file

# Pre-commit setup (once per clone)
./scripts/setup.sh
```

## Architecture

Bun monorepo with 4 packages connected by a canonical schema contract:

```
Upload CSV → importers/airbnb/v1 → CanonicalTransaction[] → core (KPIs) → apps/web (dashboard)
                                                           → algorithms/forecasting (ML)
```

- **`packages/core`** — Pure functions: `computeMonthlyPortfolioPerformance()`, `computeEstimatedOccupancy()`, `computeTrailingComparisons()`, `computeMonthlyCashflow()`, etc. Exports canonical schema types.
- **`packages/importers/airbnb/v1`** — Parses Airbnb CSV exports into `CanonicalTransaction[]`. Handles deduplication via row fingerprinting, multi-currency partitioning, validation warnings. Has CSV fixtures in `fixtures/`.
- **`packages/algorithms/forecasting`** — Ridge Regression revenue forecasting. Partitioned by currency. Returns `ForecastResult`.
- **`apps/web`** — Astro 5 + React 19 frontend. All data processing is client-side (no backend in Alpha). Deployed to Cloudflare Pages.

**Key boundary:** Dashboard components consume only canonical schema and pre-computed metrics, never raw CSV columns.

## State Management (apps/web)

- **AppContext** (`app/state.ts`) — `useReducer` with actions: `ADD_FILES`, `REMOVE_FILE`, `SET_ANALYTICS`, `SET_FILTER`, `RESET`. State has `phase: "upload" | "dashboard"`, `analytics: AnalyticsData | null`, `filter: FilterState`.
- **SettingsContext** (`app/settings-context.ts` + `hooks/useSettings.ts`) — Persisted to localStorage. Custom listing/account names, sort orders, filter preferences, locale.
- **LocaleProvider** (`i18n/LocaleProvider.tsx`) — Wraps i18next, syncs with SettingsContext.
- **Data flow:** Upload → `compute-analytics.ts` orchestrates importer + core + forecasting → `dispatch(SET_ANALYTICS)` → phase switches to dashboard → `FilterState` applied at render time in `DashboardLayout`.

## i18n

3 locales (`en`, `es`, `fr`), 10 namespaces. Locale JSON files in `apps/web/src/i18n/locales/{en,es,fr}/`. New user-facing strings must have entries in all 3 locales. Use `useTranslation("namespace")` in components.

Namespaces: `common`, `dashboard`, `upload`, `forecast`, `cashflow`, `settings`, `data-quality`, `insights`, `errors`, `notifications`.

## Responsive UI

Mandatory: all pages must work at 360px, 375px, 390px, 414px, and desktop. No page-level horizontal scroll. Charts must be responsive to container. UI PRs require mobile + desktop screenshots.

## Git Workflow

- **All PRs must fill out the PR template** (`.github/PULL_REQUEST_TEMPLATE.md`) — no placeholder text.
- **All PRs target `develop`**, never `main`. Main is updated only through develop → main promotion.
- **All AI-created PRs must be drafts** (`gh pr create --draft`). Only human maintainers mark PRs as ready.
- **AI agents must never merge PRs.** Only human maintainers merge via GitHub UI.
- Never commit to `main` directly. Use feature branches (`feat/...`, `fix/...`).
- Conventional Commits: `feat:`, `fix:`, `chore:`, `test:`.
- Pre-commit hooks are mandatory (lint, typecheck, tests, Codex AI review). Never use `--no-verify`.

## Pre-commit Hooks

After `./scripts/setup.sh`, every commit runs: lint → typecheck → unit tests → Codex CLI review (reads `docs/RULES.md`, `docs/TECH_STACK.md`, `README.md`, `docs/AGENTS.md` as constraints). All must pass.

## Testing

Tests use `bun:test` (not vitest/jest). Tests live in `test/` directories adjacent to `src/`. Importers use CSV fixtures from `fixtures/`. Prioritize coverage for: importer mappings, KPI calculations, edge cases (missing fields, zero division, currency mismatches).

## Documentation Hierarchy

When guidance conflicts: `docs/RULES.md` > `docs/TECH_STACK.md` > `README.md`.

## Key Conventions

- TypeScript strict mode, no `any` without justification
- Naming: `camelCase` (vars/fns), `PascalCase` (components), `SCREAMING_SNAKE_CASE` (constants), `kebab-case` (files)
- UI components use shadcn/ui. Charts use Recharts.
- Acronyms as single words: `urlParser` not `uRLParser`
- No dead code, no commented-out blocks, no unused imports
