# ML Forecast Freshness and Non-Blocking Recompute

## Problem Statement

The dashboard currently computes ML forecasts once during analysis (`apps/web/src/app/compute-analytics.ts`) using realized data, then applies UI filters afterward (`apps/web/src/components/dashboard/DashboardLayout.tsx`).

This creates a trust gap:

- Users can change filters (account, listing, date range, currency).
- Displayed forecast may no longer match the data scope they expect it was trained on.
- UI does not clearly communicate training scope, freshness, or background recompute status.

Goal: preserve a responsive UI while making forecast freshness explicit and continuously improving correctness.

## Current Behavior (As Implemented)

- Forecast training runs in the main compute path after upload.
- Forecast rendering is filtered client-side by selected filters.
- No explicit metadata in UI for:
  - training window,
  - training listing count,
  - training timestamp,
  - freshness state.

## Desired Outcomes

1. UI never blocks when filters change.
2. Users always see whether forecast is fresh for current scope.
3. Forecast retrains in background when needed.
4. Users can still work with last known forecast while retraining runs.
5. Recently computed forecasts are reused (cache) to avoid repeat work.

## Non-Goals

- Building a backend forecasting service.
- Redesigning model internals in `packages/algorithms/forecasting`.
- Perfect real-time incremental learning.

## Scope Definitions

Use two explicit scopes:

- `displayScope`: what user is currently filtering/viewing.
- `trainingScope`: what data a specific forecast snapshot was trained on.

Freshness is determined by comparing these scopes under defined rules.

## Options

### Option A: Banner + Manual Retrain

Behavior:

- Show freshness banner when scopes mismatch.
- Provide `Retrain` button.
- Keep existing forecast visible until user action.

Pros:

- Fastest to implement.
- Minimal architectural change.

Cons:

- User must actively manage freshness.
- Easy to ignore stale forecasts.

Best for:

- Short-term stopgap.

### Option B: Automatic Background Retrain (No Cache)

Behavior:

- On qualifying filter changes, mark forecast stale.
- Debounce and launch retrain in background.
- Keep old forecast visible with `Recomputing...` banner.

Pros:

- Better UX and correctness than manual flow.
- No major memory design needed.

Cons:

- Repeats expensive computation for repeated scopes.

Best for:

- Medium-term baseline.

### Option C: Automatic Background Retrain + LRU Cache (Recommended)

Behavior:

- Same as Option B plus in-memory LRU cache of recent snapshots.
- Immediate cache hit for recently used scopes.
- Retrain only when cache miss or invalidation.

Pros:

- Non-blocking UX plus strong performance.
- Predictable memory footprint.
- Avoids unnecessary recomputation during filter exploration.

Cons:

- Slightly more state complexity.

Best for:

- Production-ready client-side architecture.

### Option D: Server-Side Forecast API

Behavior:

- Send scope to API, compute remotely, persist centrally.

Pros:

- Offloads client CPU.
- Enables shared persistence.

Cons:

- Backend complexity, infra, auth, cost.
- Higher latency and new failure modes.

Best for:

- Future phase if client-side performance becomes limiting.

## Recommended Architecture (Option C)

### 1) Forecast Snapshot Model

Add a UI-facing snapshot contract:

```ts
type ForecastStatus = "up_to_date" | "stale" | "recomputing" | "failed";

interface TrainingScope {
  currency: string;
  accountIds: string[];      // sorted
  listingIds: string[];      // sorted
  dateRangeStart: string | null; // YYYY-MM
  dateRangeEnd: string | null;   // YYYY-MM
}

interface ForecastSnapshot {
  scope: TrainingScope;
  result: ForecastResult;
  trainedAt: number;         // epoch ms
  trainingMonths: { start: string | null; end: string | null };
  trainingListingCount: number;
}
```

### 2) State Machine (Non-Blocking)

States:

- `up_to_date`: current snapshot matches current scope.
- `stale`: scope changed; current snapshot does not match.
- `recomputing`: background job running for current scope.
- `failed`: last recompute failed; old snapshot remains visible.

UI rule:

- Never clear current forecast while recompute runs.
- Always show state via banner/chip.

### 3) Trigger Rules

Retrain-triggering changes:

- Currency changed.
- Selected accounts/listings changed.
- Date range changed (if product decision is “training follows date filter”).

No retrain needed:

- Pure presentation toggles (tab switch, projection toggle, chart mode).

Debounce:

- 300-500ms after final filter change before starting recompute.

### 4) Execution Model

Use a `Web Worker` for retraining. Do not use `setTimeout` for heavy compute.

- `setTimeout` is only for debounce.
- Worker handles CPU-heavy feature build + ridge training to keep main thread responsive.

### 5) Cache Strategy

In-memory LRU cache, max 5 snapshots per currency or global max 5 total.

Cache key:

- Stable JSON hash of normalized `TrainingScope` (sorted arrays, explicit nulls).

Eviction:

- Remove least-recently-used on insert when over capacity.

Memory guidance:

- Typical snapshot is proportional to forecast listing count.
- For most portfolios, 5 snapshots is usually acceptable in browser memory.
- Add a safeguard: if listing count is very large, reduce cache size to 3.

## UX Contract

## Banner States

- Up to date:
  - `Forecast is up to date for current filters.`
- Stale:
  - `Filters changed. Forecast shown is from a previous scope.`
- Recomputing:
  - `Recomputing forecast in background for current filters...`
- Failed:
  - `Could not refresh forecast. Showing last available results. Retry.`

## Provenance Metadata

Show wherever ML forecast appears:

- `Trained on: {start} to {end}`
- `{trainingListingCount} listings`
- `Updated {relativeTime}`

## Suggested Components

- `ForecastStatusBanner`
  - Props: `status`, `onRetry?`, `currentScope`, `snapshotScope`.
- `ForecastProvenanceMeta`
  - Props: `trainedAt`, `trainingMonths`, `trainingListingCount`.
- `useForecastRefreshController`
  - Owns state machine, debounce, cache lookup, worker calls.
- `ml-forecast.worker.ts`
  - Computes `ForecastResult` from filtered realized performance.
- `forecastCache.ts`
  - Small LRU utility (`get`, `set`, `has`, `delete`, `clear`).

## Implementation Plan

### Phase 1: Visibility First

- Add snapshot metadata and provenance UI.
- Add status banner with `up_to_date/stale`.
- Keep existing synchronous forecast path.

### Phase 2: Background Recompute

- Introduce worker compute path.
- Add `recomputing/failed` states and retry action.
- Keep stale snapshot visible during worker execution.

### Phase 3: Cache and Optimizations

- Add LRU cache (last 5).
- Use cache-first on scope changes.
- Add lightweight metrics logs (cache hit rate, recompute duration).

## Acceptance Criteria

1. Changing filters never freezes interaction or blocks rendering.
2. Banner always reflects real freshness status.
3. Provenance metadata always visible with ML forecast.
4. Recompute runs in background and updates forecast when done.
5. Cache hit for recently revisited scopes avoids recompute.
6. On error, old forecast remains available and user can retry.

## Risks and Mitigations

- Risk: scope thrashing from rapid filter edits.
  - Mitigation: debounce + cancel in-flight worker requests by sequence id.
- Risk: race conditions (old result overwrites new).
  - Mitigation: request token/versioning; ignore stale completion.
- Risk: memory growth from cached snapshots.
  - Mitigation: strict LRU cap and optional dynamic downsize.

## Open Product Decisions

1. Should date range always alter training scope, or only display scope?
2. Should account/listing filters always trigger retraining?
3. Do we expose a user setting: `Auto-refresh forecasts` on/off?
4. Should cache be session-only (in-memory) or persisted (localStorage/IndexedDB)?

## Opinionated Recommendation

Implement Option C with worker + LRU (5) now.

- It satisfies your requirement that UI must never block.
- It gives users clear indicators when data is stale or recalculating.
- It avoids repeated CPU work during filter exploration.

