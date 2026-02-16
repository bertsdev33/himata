# Repository Guidelines

## Source of Truth
- `README.md`: product scope, setup commands, env examples, and feature/workflow checklists
- `docs/TECH_STACK.md`: architecture decisions, runtime/infrastructure choices, and API/analytics strategy
- `docs/RULES.md`: mandatory coding, security, testing, and commit/branch discipline

When guidance conflicts, use `docs/RULES.md` first, then `docs/TECH_STACK.md`, then `README.md`.

## Project Structure & Module Organization
This repository is currently documentation-first. The active files are `README.md`, `docs/TECH_STACK.md`, and `docs/RULES.md`, which define product scope, architecture, and engineering rules.

The target layout is a Bun-managed monorepo:
- `apps/web`: Astro + React frontend
- `apps/api`: Cloudflare Worker API (MVP+)
- `packages/core`: canonical schema, KPI logic, insights rules
- `packages/importers`: platform importers (Airbnb v1 first)
- `scripts`, `config`, and optional `docs`

Treat `packages/core` and `packages/importers` as pure, testable domain boundaries; UI should consume normalized models, not raw spreadsheet columns.

## Build, Test, and Development Commands
After scaffolding, run commands from repo root:
- `bun install`: install dependencies
- `bun run dev:web`: run the frontend locally
- `bun run lint`: run linting checks
- `bun run typecheck`: run TypeScript checks
- `bun run test`: run automated tests

If scripts change, update `README.md` in the same PR.

## Coding Style & Naming Conventions
- Language: TypeScript-first, strong typing required; avoid `any`
- Naming: `camelCase` (variables/functions), `PascalCase` (components/classes), `SCREAMING_SNAKE_CASE` (constants)
- Files: kebab-case by default; React components may use PascalCase (for example, `RevenueChart.tsx`)
- Design: small focused modules, no duplicate logic, explicit error handling
- Deployment awareness: keep frontend bundle size lean for Cloudflare Pages (avoid unnecessary heavy client dependencies)

Follow repository quality gates; do not bypass checks or pre-commit hooks.

## Testing Guidelines
Place tests close to domain modules (for example, `packages/core/test`, `packages/importers/test`). Prioritize coverage for importer mappings, KPI calculations, and edge cases (missing fields, zero division, currency mismatches).

Before opening a PR, run: `bun run lint && bun run typecheck && bun run test`.

## Commit & Pull Request Guidelines
There is no existing commit history yet; use Conventional Commits from day one (`feat:`, `fix:`, `chore:`, `test:`). Keep commits small and single-purpose. Do not commit directly to `main`; use feature branches such as `feat/import-airbnb-v1`.
Run `./scripts/setup.sh` once per local clone to install local hooks.
Before every commit, run a Codex CLI review on staged files and include `docs/RULES.md`, `docs/TECH_STACK.md`, `README.md`, `docs/alpha-plan.md`, and `docs/AGENTS.md` as review constraints. Apply all required feedback before committing.

PRs should include:
- Clear summary and scope
- Linked issue/ticket (if available)
- Validation evidence (commands run + results)
- Screenshots for UI changes
- Documentation updates for workflow or command changes

## Security & Configuration Tips
Never commit secrets. Use `.env` files and Worker secrets for sensitive values. Do not log PII or raw spreadsheet content. Validate and sanitize all external input, and keep analytics metadata-only.
