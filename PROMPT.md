# Implementation Prompt (Alpha Phase, AI Agent)

You are implementing the next phase of this project. Follow the repository documentation first, then execute.

## Required Reading Order (Source of Truth)
1. `docs/RULES.md`
2. `docs/TECH_STACK.md`
3. `README.md`
4. `docs/alpha-plan.md`

If instructions conflict, follow that order.

## Scope for This Phase (Strict)
- Build the Alpha implementation defined in `docs/alpha-plan.md`.
- Focus on Airbnb v1 importer and canonical analytics pipeline.
- Keep logic pure and testable in shared packages.
- Use repository-relative paths only.

## Out of Scope for This Phase
- Multi-platform auto-detection (Hotels.com, Vrbo, etc.).
- Generic fallback algorithm for unknown file formats.
- AI chat features, auth, persistence, and backend-heavy MVP+ work unless explicitly required by alpha plan.

If you want to prepare for future multi-platform support, do it only via clean extension points (interfaces/abstractions) without implementing new importers now.

## Current Repo Reality
- The repo is documentation-first.
- Airbnb fixtures already exist at `packages/importers/airbnb/v1/fixtures`.
- Some directories and implementation files may not exist yet; create them as needed following the planned monorepo structure.

## Deliverables (Alpha)
Implement the plan end-to-end with tests:

1. Core canonical schema and API
- Add canonical types in `packages/core/src/schema/canonical.ts` as defined in `docs/alpha-plan.md`.
- Add core API surface in `packages/core/src/index.ts` with the specified function signatures.

2. Airbnb v1 importer
- Implement importer API in `packages/importers/airbnb/v1/src/index.ts`.
- Support `paid` and `upcoming` schema differences.
- Implement mapping, date parsing, money normalization (minor units), deterministic listing identity, dedup policy, warning emission, and realized vs forecast split exactly as described in `docs/alpha-plan.md`.

3. Allocation and KPI engine
- Implement month-overlap allocation and reconciliation rules.
- Implement KPI outputs and trailing/seasonality logic per alpha plan.
- Implement cashflow and occupancy outputs with required labels/disclaimers.

4. Tests and fixtures
- Add importer, allocation, KPI, cashflow, multi-currency, and scope/filter tests described in `docs/alpha-plan.md`.
- Use existing fixtures and add minimal new fixtures only when necessary.

5. Project wiring
- Scaffold required package setup/scripts if missing (Bun + TypeScript + test/lint/typecheck scripts) while keeping changes minimal and aligned with docs.
- Update docs when commands/workflow change.

## Hard Constraints
- TypeScript-first, strong typing, avoid `any`.
- No duplicate logic; keep modules small and focused.
- Explicit error handling and validation/sanitization of external input.
- Never log PII or raw spreadsheet content.
- PostHog must remain direct-to-PostHog from client (no proxy).
- Keep frontend bundle size lean for Cloudflare Pages: avoid unnecessary heavy client dependencies and prefer lazy loading/code splitting when appropriate.

## Acceptance Criteria
The work is complete only when alpha criteria from `docs/alpha-plan.md` are satisfied, including:
- Correct month-overlap allocation for spanning reservations.
- Realized outputs exclude `upcoming`; forecast uses only `upcoming` with required label.
- Default portfolio scope is all accounts with optional account/listing drill-down.
- Multi-currency partitioning works and warning is emitted.
- Lint, typecheck, and tests pass.

## Execution Expectations
- Make incremental, reviewable commits (Conventional Commits).
- Before every commit, run Codex CLI against staged files and request a review using `docs/RULES.md`, `docs/TECH_STACK.md`, `README.md`, `docs/alpha-plan.md`, and `docs/AGENTS.md` as constraints. Ask for bugs, regressions, security issues, missing tests, and workflow/architecture violations; apply all required feedback before committing.
- Do not refactor unrelated areas.
- At the end, report:
  - Files added/changed
  - Commands run and results
  - Any assumptions and open risks
  - What remains (if anything)
