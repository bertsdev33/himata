# ML Forecast Refresh Plan v2 (Debounced, Cancellable, Non‑Blocking)

**Audience:** Senior/staff engineers + “other agents” implementing or reviewing  
**Goal:** Keep the UI responsive while ML forecasts recompute in the background when filters change, with clear user feedback about freshness and provenance.

This document is **self-contained**: architecture + UX contract + TypeScript snippets.

---

## 0) Changes since v1 (review feedback addressed)

This revision explicitly addresses these review concerns:

1. **Date-range retraining default is risky**
   - `trainingFollowsDateRange` now **defaults to `false`**.
   - Added **training sufficiency checks** and a **fallback-to-full-history** policy (drop date range) when the selected date range yields too little realized data.

2. **Main-thread filtering can still block UI**
   - Training-row filtering is moved **entirely into the Web Worker**.
   - The main thread sends only **(a) dataset init once** and **(b) scope requests**.

3. **Dataset-change invalidation must terminate worker + invalidate in-flight**
   - On `analytics` change, controller now:
     - **terminates worker**
     - **bumps requestId**
     - **clears cache**
     - **re-inits worker with new datasetId**
   - Worker responses include `datasetId` to prevent accidental cross-dataset application.

4. **Integration must preserve existing forecast-display logic**
   - This plan preserves the current **targetMonth date-range filtering**, **portfolio regrouping by targetMonth**, and **excluded filtering** behavior currently implemented in `DashboardLayout.tsx`.
   - We substitute the *source* forecast (refreshed snapshot) but keep the *display transformation* identical.

5. **LRU strict TS typing**
   - LRU eviction now guards `oldestKey` so it can’t be `undefined`.

6. **`result: null` must not silently fall back to upload-time forecast**
   - Distinguish:
     - “no refreshed snapshot yet” vs
     - “refreshed snapshot completed with `result: null` (intentionally unavailable)”.
   - Fallback to upload-time forecast is allowed only before the first refreshed snapshot exists.

7. **Empty post-compute result must include explicit reason**
   - If `computeRevenueForecast` returns no listings, worker returns `result: null` with reason code (e.g. `insufficient_per_listing_history`) so UI messaging is accurate.

8. **Forecast tab enablement contract under v2 states**
   - The Forecast tab should remain available during `stale`, `recomputing`, and `failed` when a previous snapshot or baseline forecast exists.
   - Do not hide the tab purely because refreshed result is `null`.

9. **Astro/Vite worker wiring guidance**
   - Added concrete file placement/import pattern for this Astro app to avoid path/bundling ambiguity.

---

## 1) Problem statement

We have a TypeScript/React dashboard that displays ML-based forecasts derived from “realized” performance data. Users adjust filters (accounts, listings, date range, currency). We need to:

1. Recompute forecasts based on the active filter context (where appropriate).
2. Inform users when the forecast is stale, refreshing, or failed.
3. Do so **without blocking the UI** on every filter change.
4. Debounce recomputation to avoid thrash during rapid filter interaction.
5. Cancel/ignore outdated computations when inputs change.
6. Keep it maintainable, testable, and observable.

---

## 2) Why “filtering the forecast output” is not enough

Many dashboards compute an ML forecast once (e.g., at upload time) and then filter the *forecast outputs* as UI filters change. This can create a trust gap:

- The UI appears scoped to filters,
- but the underlying training data used for the forecast may have been broader.

If we want the forecast to **represent the selected scope**, we must scope the **training inputs** (or use an explicit product decision that training scope is broader, but then we must communicate that).

---

## 3) UX contract (freshness states + provenance)

We expose a small state machine:

- `up_to_date`: forecast snapshot matches current requested training scope (or fallback scope)
- `stale`: filters changed; showing previous snapshot
- `recomputing`: background recompute running
- `failed`: recompute failed; showing previous snapshot (if any)

### Banner copy (suggested)
- **Stale:** “Filters changed. Forecast shown was trained for a previous selection.”
- **Recomputing:** “Updating forecast in the background…”
- **Failed:** “Couldn’t refresh forecast. Showing last available results. Retry.”
- **Fallback notice (when applicable):**
  - “Not enough realized data in the selected date range. Forecast trained on full history for the selected listings.”

### Provenance fields
- trainedAt timestamp
- training window months (realized)
- training row count / listing count
- effective training scope (especially if fallback is used)

---

## 4) Key product decision: does training follow date range?

### Default (recommended): **NO**
- `trainingFollowsDateRange = false`
- Training uses full realized history for the selected currency/accounts/listings.
- Date range is applied to **display** (filtering forecast target months), preserving existing behavior.

**Why default to false?**
Users often set date ranges into the future (“forecast-heavy”), and realized data in that window can be near-zero, leading to unstable/empty forecasts.

### Optional: YES, with safety
If enabling `trainingFollowsDateRange = true`, require:
- sufficiency checks, and
- fallback-to-full-history when data is insufficient.

This plan supports that via fallback policy.

---

## 5) Architecture overview

### Components
1. **TrainingScope**: normalized representation of training scope.
2. **ForecastRefreshController** (React hook):
   - derives desired scope from UI filters
   - debounces recompute requests
   - caches recent results (LRU)
   - handles dataset invalidation (analytics changes)
   - accepts results only if `{datasetId, requestId}` match latest
3. **Web Worker**:
   - holds the realized dataset in worker memory (initialized once per dataset)
   - filters training rows **inside the worker**
   - computes the forecast
   - applies training-sufficiency fallback policy
4. **Display transformer** (main thread):
   - preserves existing logic: targetMonth filtering + regrouping + excluded filtering.

---

## 6) Cancellation model

There are two levels:

### 6.1 Correctness cancellation (MUST)
Never apply stale results:
- main thread tracks `latestRequestId`
- worker responses include `requestId`
- accept only if `response.requestId === latestRequestId` and `datasetId` matches

### 6.2 CPU cancellation (BEST-EFFORT)
True preemption of synchronous compute is not possible without changing the ML function.
What we can do:
- **terminate worker on dataset changes** (mandatory)
- on scope changes, we rely on debounce + correctness cancellation
- worker also coalesces queued requests (see worker scheduling section) so bursts don’t execute all intermediate scopes

If you later refactor `computeRevenueForecast` to be cooperative (chunked or supports `AbortSignal`), you can implement hard cancellation mid-compute.

---

## 7) TypeScript building blocks

### 7.1 TrainingScope + stable key

```ts
// forecastScope.ts
export type ForecastStatus = "up_to_date" | "stale" | "recomputing" | "failed";

export interface TrainingScope {
  currency: string;
  accountIds: string[];          // sorted
  listingIds: string[];          // sorted
  // Training date range refers to realized months (YYYY-MM), not forecast target months.
  dateRangeStart: string | null; // YYYY-MM or null
  dateRangeEnd: string | null;   // YYYY-MM or null
}

export function normalizeScope(scope: TrainingScope): TrainingScope {
  return {
    ...scope,
    accountIds: [...scope.accountIds].sort(),
    listingIds: [...scope.listingIds].sort(),
    dateRangeStart: scope.dateRangeStart ?? null,
    dateRangeEnd: scope.dateRangeEnd ?? null,
  };
}

export function scopeKey(scope: TrainingScope): string {
  return JSON.stringify(normalizeScope(scope));
}
```

---

### 7.2 LRU cache (strict TS safe)

```ts
// forecastCache.ts
export class LruCache<K, V> {
  private map = new Map<K, V>();
  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const v = this.map.get(key);
    if (v === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, v);
    return v;
  }

  set(key: K, value: V) {
    if (this.map.has(key)) this.map.delete(key);
    this.map.set(key, value);

    if (this.map.size > this.maxSize) {
      const oldestKey = this.map.keys().next().value as K | undefined;
      if (oldestKey !== undefined) this.map.delete(oldestKey);
    }
  }

  clear() {
    this.map.clear();
  }
}
```

---

## 8) Worker design (filters inside worker)

### 8.1 Protocol

Main -> Worker:

- `init` (once per dataset):
  - `{ type: "init", datasetId, realizedListingPerformance, config }`

- `compute`:
  - `{ type: "compute", datasetId, requestId, desiredScope }`

Worker -> Main:

- `ready` (after init)
- `result`:
  - `{ datasetId, requestId, desiredScope, effectiveScope, usedFallback, fallbackReason, trainedAt, trainingMeta, result }`
  - `result` can be `ForecastResult | null`
- `error`

### 8.2 Training sufficiency policy

Define minimum thresholds:
- `minTrainingRows` (default: 3)
- `minTrainingMonths` distinct months (default: 3)

Fallback strategy (default):
- If training rows in requested date range are insufficient:
  - **drop the date range** and train on full realized history for the selected currency/accounts/listings

If still insufficient:
- return `result: null` with `fallbackReason: "insufficient_training_data"`

If the compute runs but returns an empty forecast (`result.listings.length === 0`):
- return `result: null` with `fallbackReason: "insufficient_per_listing_history"`

---

### 8.3 Worker implementation

Create `ml-forecast.worker.ts`:

```ts
// ml-forecast.worker.ts
import { computeRevenueForecast } from "@rental-analytics/forecasting";
import type { ForecastResult } from "@rental-analytics/forecasting";
import type { TrainingScope } from "../forecast/forecastScope";

type ListingPerformanceRow = any;

type InitMessage = {
  type: "init";
  datasetId: string;
  realizedListingPerformance: ListingPerformanceRow[];
  config?: {
    minTrainingRows?: number;
    minTrainingMonths?: number;
    fallback?: "drop_date_range" | "none";
  };
};

type ComputeMessage = {
  type: "compute";
  datasetId: string;
  requestId: number;
  desiredScope: TrainingScope;
};

type WorkerMessage = InitMessage | ComputeMessage;

type ReadyMessage = { type: "ready"; datasetId: string };

type ResultMessage = {
  type: "result";
  datasetId: string;
  requestId: number;
  desiredScope: TrainingScope;
  effectiveScope: TrainingScope;
  usedFallback: boolean;
  // reason codes:
  // - "insufficient_data_in_date_range__trained_on_full_history"
  // - "insufficient_training_data"
  // - "insufficient_per_listing_history"
  fallbackReason: string | null;

  trainedAt: number;
  trainingMeta: {
    rowCount: number;
    distinctMonths: number;
    listingCount: number;
    months: { start: string | null; end: string | null };
  };

  result: ForecastResult | null;
};

type ErrorMessage = {
  type: "error";
  datasetId: string | null;
  requestId: number | null;
  error: string;
};

let activeDatasetId: string | null = null;
let byCurrency: Map<string, ListingPerformanceRow[]> = new Map();

let config = {
  minTrainingRows: 3,
  minTrainingMonths: 3,
  fallback: "drop_date_range" as "drop_date_range" | "none",
};

// Scheduling/coalescing: we coalesce queued compute requests into the latest one.
// (Workers are single-threaded; we can't receive messages mid-sync compute,
// but this coalesces bursts that queued up while we were busy.)
let pendingCompute: ComputeMessage | null = null;
let scheduled = false;
let computing = false;

function computeMeta(rows: ListingPerformanceRow[]) {
  let start: string | null = null;
  let end: string | null = null;
  const monthSet = new Set<string>();
  const listingSet = new Set<string>();

  for (const r of rows) {
    const m: string = r.month;
    monthSet.add(m);
    if (start === null || m < start) start = m;
    if (end === null || m > end) end = m;
    listingSet.add(r.listingId);
  }

  return {
    rowCount: rows.length,
    distinctMonths: monthSet.size,
    listingCount: listingSet.size,
    months: { start, end },
  };
}

function filterRows(scope: TrainingScope): ListingPerformanceRow[] {
  const all = byCurrency.get(scope.currency) ?? [];

  const accountSet = scope.accountIds.length ? new Set(scope.accountIds) : null;
  const listingSet = scope.listingIds.length ? new Set(scope.listingIds) : null;

  const out: ListingPerformanceRow[] = [];
  for (const lp of all) {
    if (accountSet && !accountSet.has(lp.accountId)) continue;
    if (listingSet && !listingSet.has(lp.listingId)) continue;

    if (scope.dateRangeStart && lp.month < scope.dateRangeStart) continue;
    if (scope.dateRangeEnd && lp.month > scope.dateRangeEnd) continue;

    out.push(lp);
  }
  return out;
}

function isSufficient(meta: ReturnType<typeof computeMeta>) {
  return meta.rowCount >= config.minTrainingRows && meta.distinctMonths >= config.minTrainingMonths;
}

function dropDateRange(scope: TrainingScope): TrainingScope {
  return { ...scope, dateRangeStart: null, dateRangeEnd: null };
}

function scheduleCompute() {
  if (scheduled || computing) return;
  scheduled = true;

  setTimeout(() => {
    scheduled = false;
    if (!pendingCompute) return;

    const msg = pendingCompute;
    pendingCompute = null;

    computing = true;
    try {
      runCompute(msg);
    } finally {
      computing = false;
      // if more requests queued during compute, they'll run before this next timer,
      // but they won't schedule another timer because scheduled==false only after we exit.
      // If pendingCompute got set by those queued messages, schedule again.
      if (pendingCompute) scheduleCompute();
    }
  }, 0);
}

function runCompute(msg: ComputeMessage) {
  // ignore stale dataset
  if (!activeDatasetId || msg.datasetId !== activeDatasetId) return;

  const desiredScope = msg.desiredScope;

  // Step 1: requested training rows
  let effectiveScope = desiredScope;
  let rows = filterRows(effectiveScope);
  let meta = computeMeta(rows);

  let usedFallback = false;
  let fallbackReason: string | null = null;

  // Step 2: fallback if insufficient and date range was constraining
  const requestedHadDateRange = Boolean(desiredScope.dateRangeStart || desiredScope.dateRangeEnd);

  if (!isSufficient(meta) && requestedHadDateRange && config.fallback === "drop_date_range") {
    const fallbackScope = dropDateRange(desiredScope);
    const fallbackRows = filterRows(fallbackScope);
    const fallbackMeta = computeMeta(fallbackRows);

    if (isSufficient(fallbackMeta)) {
      effectiveScope = fallbackScope;
      rows = fallbackRows;
      meta = fallbackMeta;
      usedFallback = true;
      fallbackReason = "insufficient_data_in_date_range__trained_on_full_history";
    }
  }

  // Step 3: if still insufficient, return null result (up-to-date but unavailable)
  if (!isSufficient(meta)) {
    const out: ResultMessage = {
      type: "result",
      datasetId: msg.datasetId,
      requestId: msg.requestId,
      desiredScope,
      effectiveScope,
      usedFallback,
      fallbackReason: fallbackReason ?? "insufficient_training_data",
      trainedAt: Date.now(),
      trainingMeta: meta,
      result: null,
    };
    (self as DedicatedWorkerGlobalScope).postMessage(out);
    return;
  }

  // Step 4: compute forecast
  try {
    const result = computeRevenueForecast(rows);
    const hasListings = Array.isArray(result.listings) && result.listings.length > 0;
    const emptyResultReason = hasListings ? null : "insufficient_per_listing_history";
    const out: ResultMessage = {
      type: "result",
      datasetId: msg.datasetId,
      requestId: msg.requestId,
      desiredScope,
      effectiveScope,
      usedFallback,
      fallbackReason: fallbackReason ?? emptyResultReason,
      trainedAt: Date.now(),
      trainingMeta: meta,
      result: hasListings ? result : null,
    };
    (self as DedicatedWorkerGlobalScope).postMessage(out);
  } catch (e) {
    const out: ErrorMessage = {
      type: "error",
      datasetId: msg.datasetId,
      requestId: msg.requestId,
      error: e instanceof Error ? e.message : String(e),
    };
    (self as DedicatedWorkerGlobalScope).postMessage(out);
  }
}

self.onmessage = (evt: MessageEvent<WorkerMessage>) => {
  const msg = evt.data;

  if (msg.type === "init") {
    activeDatasetId = msg.datasetId;
    config = {
      minTrainingRows: msg.config?.minTrainingRows ?? 3,
      minTrainingMonths: msg.config?.minTrainingMonths ?? 3,
      fallback: msg.config?.fallback ?? "drop_date_range",
    };

    // Build currency buckets in-worker
    byCurrency = new Map();
    for (const lp of msg.realizedListingPerformance) {
      const arr = byCurrency.get(lp.currency);
      if (arr) arr.push(lp);
      else byCurrency.set(lp.currency, [lp]);
    }

    const ready: ReadyMessage = { type: "ready", datasetId: msg.datasetId };
    (self as DedicatedWorkerGlobalScope).postMessage(ready);
    return;
  }

  if (msg.type === "compute") {
    // Store only latest request and coalesce
    pendingCompute = msg;
    scheduleCompute();
  }
};
```

### 8.4 Astro/Vite worker integration (this repo)

- Runtime stack here is Astro + React (`client:only`) with Vite bundling.
- Recommended worker location:
  - `apps/web/src/workers/ml-forecast.worker.ts`
- Recommended hook location:
  - `apps/web/src/hooks/useForecastRefreshControllerV2.ts`
- Worker instantiation from hook:

```ts
const worker = new Worker(
  new URL("../workers/ml-forecast.worker.ts", import.meta.url),
  { type: "module" }
);
```

- Keep worker imports ESM-safe and avoid Node-only APIs.
- Ensure the worker file is under `src/` so Vite includes it in the build graph.

---

## 9) Controller hook v2 (dataset-aware, worker init, debounce)

Key changes from v1:
- initializes worker with realized data once per dataset
- sends scopes to worker (no main-thread filtering)
- terminates worker + bumps requestId on dataset change

```ts
// useForecastRefreshControllerV2.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ForecastResult } from "@rental-analytics/forecasting";
import { LruCache } from "./forecastCache";
import { type ForecastStatus, type TrainingScope, normalizeScope, scopeKey } from "./forecastScope";

export interface ForecastSnapshot {
  datasetId: string;
  desiredScope: TrainingScope;
  effectiveScope: TrainingScope;

  usedFallback: boolean;
  fallbackReason: string | null;

  trainedAt: number;
  trainingMeta: {
    rowCount: number;
    distinctMonths: number;
    listingCount: number;
    months: { start: string | null; end: string | null };
  };

  result: ForecastResult | null;
}

type ControllerState = {
  status: ForecastStatus;
  snapshot: ForecastSnapshot | null;
  error: string | null;
  workerReady: boolean;
};

function newDatasetId() {
  // simple unique id; swap with uuid if preferred
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function useForecastRefreshControllerV2(args: {
  analytics: any;

  currency: string;
  selectedAccountIds: string[];
  selectedListingIds: string[];
  dateRange: { start: string | null; end: string | null };

  debounceMs?: number;
  cacheSize?: number;

  // IMPORTANT: now defaults to false.
  trainingFollowsDateRange?: boolean;

  // training sufficiency / fallback
  minTrainingRows?: number;
  minTrainingMonths?: number;
  fallback?: "drop_date_range" | "none";
}) {
  const {
    analytics,
    currency,
    selectedAccountIds,
    selectedListingIds,
    dateRange,
    debounceMs = 400,
    cacheSize = 5,
    trainingFollowsDateRange = false,
    minTrainingRows = 3,
    minTrainingMonths = 3,
    fallback = "drop_date_range",
  } = args;

  const cacheRef = useRef(new LruCache<string, ForecastSnapshot>(cacheSize));
  const workerRef = useRef<Worker | null>(null);

  const datasetIdRef = useRef<string>(newDatasetId());
  // Keep a reactive datasetId for cache-key derivation.
  const [datasetId, setDatasetId] = useState<string>(datasetIdRef.current);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);

  const [state, setState] = useState<ControllerState>({
    status: "stale",
    snapshot: null,
    error: null,
    workerReady: false,
  });

  // Derive desired training scope
  const desiredScope = useMemo<TrainingScope>(() => {
    return normalizeScope({
      currency,
      accountIds: selectedAccountIds,
      listingIds: selectedListingIds,
      dateRangeStart: trainingFollowsDateRange ? dateRange.start : null,
      dateRangeEnd: trainingFollowsDateRange ? dateRange.end : null,
    });
  }, [currency, selectedAccountIds, selectedListingIds, dateRange.start, dateRange.end, trainingFollowsDateRange]);

  // Include datasetId in cache key so cross-dataset reuse is impossible even if cache isn't cleared.
  const desiredKey = useMemo(() => `${datasetId}:${scopeKey(desiredScope)}`, [datasetId, desiredScope]);

  // (Re)initialize worker when analytics changes
  useEffect(() => {
    // Bump requestId so any old results are ignored
    requestIdRef.current += 1;

    // New datasetId (update both ref and reactive state)
    const nextDatasetId = newDatasetId();
    datasetIdRef.current = nextDatasetId;
    setDatasetId(nextDatasetId);

    // Clear cache
    cacheRef.current.clear();

    // Cancel debounce
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);

    // Terminate old worker
    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    // Create new worker
    const worker = new Worker(
      new URL("../workers/ml-forecast.worker.ts", import.meta.url),
      { type: "module" }
    );
    workerRef.current = worker;

    setState((prev) => ({
      ...prev,
      status: prev.snapshot ? "stale" : "stale",
      error: null,
      workerReady: false,
      snapshot: null,
    }));

    const datasetId = nextDatasetId;

    worker.onmessage = (evt: MessageEvent<any>) => {
      const msg = evt.data;

      if (msg.type === "ready") {
        if (msg.datasetId !== datasetIdRef.current) return;
        setState((prev) => ({ ...prev, workerReady: true }));
        return;
      }

      if (msg.type === "result") {
        if (msg.datasetId !== datasetIdRef.current) return;
        if (msg.requestId !== requestIdRef.current) return;

        const snapshot: ForecastSnapshot = {
          datasetId: msg.datasetId,
          desiredScope: msg.desiredScope,
          effectiveScope: msg.effectiveScope,
          usedFallback: msg.usedFallback,
          fallbackReason: msg.fallbackReason,
          trainedAt: msg.trainedAt,
          trainingMeta: msg.trainingMeta,
          result: msg.result,
        };

        cacheRef.current.set(`${msg.datasetId}:${scopeKey(msg.desiredScope)}`, snapshot);

        setState({
          status: "up_to_date",
          snapshot,
          error: null,
          workerReady: true,
        });
        return;
      }

      if (msg.type === "error") {
        // Error could be from current or older request; we keep the strict checks
        if (msg.datasetId && msg.datasetId !== datasetIdRef.current) return;
        if (msg.requestId != null && msg.requestId !== requestIdRef.current) return;

        setState((prev) => ({
          ...prev,
          status: "failed",
          error: msg.error ?? "Forecast compute failed",
        }));
      }
    };

    worker.onerror = (err) => {
      setState((prev) => ({ ...prev, status: "failed", error: err.message || "Worker error" }));
    };

    // Send init dataset (realized view)
    const realized = analytics.views.realized.listingPerformance;

    worker.postMessage({
      type: "init",
      datasetId,
      realizedListingPerformance: realized,
      config: { minTrainingRows, minTrainingMonths, fallback },
    });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analytics, minTrainingRows, minTrainingMonths, fallback]);

  const startCompute = useCallback(() => {
    if (!workerRef.current) return;
    if (!state.workerReady) return;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setState((prev) => ({ ...prev, status: "recomputing", error: null }));

    workerRef.current.postMessage({
      type: "compute",
      datasetId: datasetIdRef.current,
      requestId,
      desiredScope,
    });
  }, [desiredScope, state.workerReady]);

  // Scope change: cache-first, else stale + debounced compute
  useEffect(() => {
    const cached = cacheRef.current.get(desiredKey);
    if (cached) {
      setState((prev) => ({ ...prev, status: "up_to_date", snapshot: cached, error: null }));
      return;
    }

    setState((prev) => ({ ...prev, status: prev.snapshot ? "stale" : "stale", error: null }));

    if (!state.workerReady) return;

    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => startCompute(), debounceMs);

    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    };
  }, [desiredKey, desiredScope, debounceMs, startCompute, state.workerReady]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
      if (workerRef.current) workerRef.current.terminate();
    };
  }, []);

  const refreshNow = useCallback(() => {
    if (!state.workerReady) return;
    if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
    startCompute();
  }, [startCompute, state.workerReady]);

  return {
    status: state.status,
    snapshot: state.snapshot,
    forecast: state.snapshot?.result ?? null,
    error: state.error,
    desiredScope,
    workerReady: state.workerReady,
    refreshNow,
  };
}
```

---

## 10) Preserving existing display logic in `DashboardLayout.tsx`

**Important:** your current UI behavior does **all** of the following (must keep):
1. Filters ML forecast listings by:
   - selected accounts/listings
   - **date range applied to `ListingForecast.targetMonth`**
2. Recomputes portfolio by **grouping by `targetMonth`** and using the **largest group** to build a portfolio
3. Filters `excluded` by account/listing (date range is not applied)

We preserve this by extracting it into a helper that you can apply to either:
- upload-time forecast (`analytics.mlForecasts[currency]`) **or**
- refreshed forecast snapshot from the controller.

### 10.1 Display transformer helper (copy from current behavior)

```ts
// mlForecastDisplayTransform.ts
import { buildPortfolio } from "@rental-analytics/forecasting";
import type { ForecastResult, ListingForecast } from "@rental-analytics/forecasting";

export function transformForecastForDisplay(args: {
  forecast: ForecastResult | null;
  currency: string;
  selectedAccountIds: string[];
  selectedListingIds: string[];
  dateRange: { start: string | null; end: string | null };
}): ForecastResult | null {
  const { forecast, selectedAccountIds, selectedListingIds, dateRange } = args;
  if (!forecast || forecast.listings.length === 0) return null;

  let filtered: ListingForecast[] = forecast.listings;

  if (selectedAccountIds.length > 0) {
    const accountSet = new Set(selectedAccountIds);
    filtered = filtered.filter((l) => accountSet.has(l.accountId));
  }
  if (selectedListingIds.length > 0) {
    const listingSet = new Set(selectedListingIds);
    filtered = filtered.filter((l) => listingSet.has(l.listingId));
  }

  // Date range applies to forecast targetMonth (NOT realized months)
  if (dateRange.start) filtered = filtered.filter((l) => l.targetMonth >= dateRange.start!);
  if (dateRange.end) filtered = filtered.filter((l) => l.targetMonth <= dateRange.end!);

  if (filtered.length === 0) return null;

  // Recompute portfolio from filtered listings: group by targetMonth and use largest group
  const byMonth = new Map<string, ListingForecast[]>();
  for (const l of filtered) {
    const group = byMonth.get(l.targetMonth);
    if (group) group.push(l);
    else byMonth.set(l.targetMonth, [l]);
  }

  let largestGroup: ListingForecast[] = [];
  for (const group of byMonth.values()) {
    if (group.length > largestGroup.length) largestGroup = group;
  }

  // Excluded: only filter by account/listing (preserve existing behavior)
  let filteredExcluded = forecast.excluded;
  if (selectedAccountIds.length > 0) {
    const accountSet = new Set(selectedAccountIds);
    filteredExcluded = filteredExcluded.filter((e) => accountSet.has(e.accountId));
  }
  if (selectedListingIds.length > 0) {
    const listingSet = new Set(selectedListingIds);
    filteredExcluded = filteredExcluded.filter((e) => listingSet.has(e.listingId));
  }

  return {
    portfolio: buildPortfolio(largestGroup),
    listings: filtered,
    excluded: filteredExcluded,
  };
}
```

### 10.2 Updated integration pattern

You should **not** remove your existing targetMonth filtering/regrouping logic.  
Instead, replace only the **source** forecast:

- prior source: `analytics.mlForecasts[currency]`
- new source:
  - use upload-time baseline only before first refreshed snapshot exists
  - once a refreshed snapshot exists, use its `result` even when that result is `null`

Then apply the same display transformer.

```ts
const controller = useForecastRefreshControllerV2({
  analytics,
  currency,
  selectedAccountIds: filter.selectedAccountIds,
  selectedListingIds: filter.selectedListingIds,
  dateRange: { start: filter.dateRange.start ?? null, end: filter.dateRange.end ?? null },
  debounceMs: 400,
  cacheSize: 5,
  trainingFollowsDateRange: false,     // recommended default
  minTrainingRows: 3,
  minTrainingMonths: 3,
  fallback: "drop_date_range",
});

// IMPORTANT:
// - If snapshot is null => no refreshed run completed yet: may use baseline upload-time forecast.
// - If snapshot exists and result is null => refreshed run says "unavailable": DO NOT fallback silently.
const baseForecast =
  controller.snapshot === null
    ? (analytics.mlForecasts[currency] ?? null)
    : controller.snapshot.result;

const displayedMlForecast = useMemo(
  () =>
    transformForecastForDisplay({
      forecast: baseForecast,
      currency,
      selectedAccountIds: filter.selectedAccountIds,
      selectedListingIds: filter.selectedListingIds,
      dateRange: { start: filter.dateRange.start ?? null, end: filter.dateRange.end ?? null },
    }),
  [baseForecast, currency, filter.selectedAccountIds, filter.selectedListingIds, filter.dateRange],
);
```

Then pass:
- `mlForecast={displayedMlForecast}` (preserves existing UX)
- plus status/meta for banners

### 10.3 Forecast tab enablement contract (v2)

Keep tab availability stable while refresh states evolve:

- Let:
  - `hasUpcoming` = existing upcoming-reservations forecast data availability
  - `hasBaselineMl` = `Boolean(analytics.mlForecasts[currency]?.listings.length)`
  - `hasSnapshot` = `controller.snapshot !== null`
  - `hasDisplayedMl` = `Boolean(displayedMlForecast?.listings.length)`
- Forecast tab should be enabled when:
  - `hasUpcoming || hasDisplayedMl || hasSnapshot || hasBaselineMl`
- Rationale:
  - preserves access during `stale`/`recomputing`/`failed`
  - avoids tab disappearing while background refresh is in progress
  - allows showing banner + provenance even when refreshed `result` is `null`

---

## 11) UI: banner + provenance (including fallback messaging)

```tsx
import type { ForecastStatus } from "./forecastScope";
import type { ForecastSnapshot } from "./useForecastRefreshControllerV2";

export function ForecastFreshnessBanner(props: {
  status: ForecastStatus;
  snapshot: ForecastSnapshot | null;
  error: string | null;
  onRetry?: () => void;
}) {
  const { status, snapshot, error, onRetry } = props;

  // Optional: show a subtle fallback notice even when up-to-date
  const showFallback =
    snapshot?.usedFallback ||
    snapshot?.fallbackReason === "insufficient_data_in_date_range__trained_on_full_history";

  return (
    <div className="space-y-2">
      {status === "stale" ? (
        <div className="rounded border p-3 text-sm">
          <strong>Forecast may be out of date.</strong> Filters changed. The forecast shown was trained for a previous selection.
        </div>
      ) : null}

      {status === "recomputing" ? (
        <div className="rounded border p-3 text-sm">
          <strong>Updating forecast…</strong> Recomputing in the background.
        </div>
      ) : null}

      {status === "failed" ? (
        <div className="rounded border p-3 text-sm">
          <strong>Couldn’t refresh forecast.</strong> {error ?? "Unknown error"}{" "}
          {onRetry ? <button className="underline" onClick={onRetry}>Retry</button> : null}
        </div>
      ) : null}

      {showFallback ? (
        <div className="rounded border p-3 text-sm">
          <strong>Using full history for training.</strong>{" "}
          Not enough realized data in the selected date range; trained on full realized history for the selected listings.
        </div>
      ) : null}

      {snapshot?.fallbackReason === "insufficient_per_listing_history" ? (
        <div className="rounded border p-3 text-sm">
          <strong>Forecast unavailable for selected scope.</strong>{" "}
          Realized data exists, but listing-level history is insufficient to produce forecast rows.
        </div>
      ) : null}

      {snapshot ? (
        <div className="text-xs opacity-80">
          <div>Trained at: {new Date(snapshot.trainedAt).toLocaleString()}</div>
          <div>Training window: {snapshot.trainingMeta.months.start ?? "?"} → {snapshot.trainingMeta.months.end ?? "?"}</div>
          <div>Training rows: {snapshot.trainingMeta.rowCount} • Listings: {snapshot.trainingMeta.listingCount}</div>
        </div>
      ) : null}
    </div>
  );
}
```

---

## 12) Performance considerations

1. **Dataset init payload**
   - Initial `init` sends `realizedView.listingPerformance` to worker once per dataset.
   - If very large, consider sending only fields required by `computeRevenueForecast` (shallow mapping), still on init.

2. **Main thread**
   - Heavy training filtering is now in the worker.
   - Display filtering still happens on main thread; if it becomes heavy, it can also move to worker, but preserve the same transformation semantics.

3. **React rendering**
   - If filter interactions themselves cause heavy re-rendering, consider `startTransition` for filter state updates and/or `useDeferredValue`.

---

## 13) Dataset invalidation (complete)

On dataset change (`analytics` changes), controller performs:
- `requestId++` (invalidates in-flight)
- `datasetId = newDatasetId()`
- `cache.clear()`
- `terminate worker`
- `create worker`
- `post init` with new datasetId + realized data

Worker responses include datasetId so accidental cross-dataset application is prevented even if requestId checks fail.

---

## 14) Testing plan

### Unit tests
- scope normalization/key stability
- LRU eviction and guard

### Worker tests (can be “pure” tests by extracting filtering/meta into helper functions)
- filtering correctness matches scope
- fallback triggers only when needed
- insufficient training yields `result: null`
- datasetId mismatch results are ignored

### Controller tests
- debounce behavior
- cache hit avoids recompute
- dataset change terminates worker and invalidates old results
- status transitions: stale -> recomputing -> up_to_date, and failure path

### Integration/e2e tests
- rapid filter changes do not freeze UI
- displayed ML forecast retains existing targetMonth grouping semantics

---

## 15) Rollout plan

1. Add behind feature flag: `forecast_refresh_v2`
2. Ship internally, collect:
   - worker init time
   - forecast compute duration
   - stale time
   - failure rate
3. Ramp up

---

## 16) Future enhancements

- Cooperative cancellation: refactor forecasting compute to check `AbortSignal` between chunks
- Progress updates from worker (e.g., percent complete)
- Adaptive debounce (based on recent compute duration)
- Persist cache across sessions for repeated workflows
