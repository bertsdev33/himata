import { computeRevenueForecast } from "@rental-analytics/forecasting";
import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type {
  MlWorkerRequest,
  MlWorkerResponse,
  TrainingScope,
  TrainingMeta,
  FallbackReason,
} from "../lib/ml-forecast-refresh-types";

let activeDatasetId: string | null = null;
let byCurrency = new Map<string, MonthlyListingPerformance[]>();

let config = {
  minTrainingRows: 3,
  minTrainingMonths: 3,
  fallback: "drop_date_range" as "drop_date_range" | "none",
};

let pendingCompute: Extract<MlWorkerRequest, { type: "compute" }> | null = null;
let scheduled = false;
let computing = false;

function postMessageSafe(message: MlWorkerResponse) {
  (
    self as unknown as {
      postMessage: (msg: MlWorkerResponse) => void;
    }
  ).postMessage(message);
}

function computeMeta(rows: MonthlyListingPerformance[]): TrainingMeta {
  let start: string | null = null;
  let end: string | null = null;
  const monthSet = new Set<string>();
  const listingSet = new Set<string>();

  for (const row of rows) {
    const month = row.month;
    monthSet.add(month);
    if (start === null || month < start) start = month;
    if (end === null || month > end) end = month;
    listingSet.add(row.listingId);
  }

  return {
    rowCount: rows.length,
    distinctMonths: monthSet.size,
    listingCount: listingSet.size,
    months: { start, end },
  };
}

function isSufficient(meta: TrainingMeta): boolean {
  return (
    meta.rowCount >= config.minTrainingRows &&
    meta.distinctMonths >= config.minTrainingMonths
  );
}

function dropDateRange(scope: TrainingScope): TrainingScope {
  return { ...scope, dateRangeStart: null, dateRangeEnd: null };
}

function filterRows(scope: TrainingScope): MonthlyListingPerformance[] {
  const all = byCurrency.get(scope.currency) ?? [];
  const accountSet = scope.accountIds.length > 0 ? new Set(scope.accountIds) : null;
  const listingSet = scope.listingIds.length > 0 ? new Set(scope.listingIds) : null;

  const out: MonthlyListingPerformance[] = [];
  for (const row of all) {
    if (accountSet && !accountSet.has(row.accountId)) continue;
    if (listingSet && !listingSet.has(row.listingId)) continue;
    if (scope.dateRangeStart && row.month < scope.dateRangeStart) continue;
    if (scope.dateRangeEnd && row.month > scope.dateRangeEnd) continue;
    out.push(row);
  }
  return out;
}

function runCompute(msg: Extract<MlWorkerRequest, { type: "compute" }>) {
  if (!activeDatasetId || msg.datasetId !== activeDatasetId) return;

  const desiredScope = msg.desiredScope;
  let effectiveScope = desiredScope;
  let rows = filterRows(effectiveScope);
  let meta = computeMeta(rows);
  let usedFallback = false;
  let fallbackReason: FallbackReason = null;

  const requestedHadDateRange = Boolean(
    desiredScope.dateRangeStart || desiredScope.dateRangeEnd,
  );

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

  if (!isSufficient(meta)) {
    postMessageSafe({
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
    });
    return;
  }

  try {
    const result = computeRevenueForecast(rows);
    const hasListings = result.listings.length > 0;
    postMessageSafe({
      type: "result",
      datasetId: msg.datasetId,
      requestId: msg.requestId,
      desiredScope,
      effectiveScope,
      usedFallback,
      fallbackReason:
        fallbackReason ??
        (hasListings ? null : "insufficient_per_listing_history"),
      trainedAt: Date.now(),
      trainingMeta: meta,
      result: hasListings ? result : null,
    });
  } catch (error) {
    postMessageSafe({
      type: "error",
      datasetId: msg.datasetId,
      requestId: msg.requestId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
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
      if (pendingCompute) scheduleCompute();
    }
  }, 0);
}

self.onmessage = (evt: MessageEvent<MlWorkerRequest>) => {
  const msg = evt.data;

  if (msg.type === "init") {
    activeDatasetId = msg.datasetId;
    config = {
      minTrainingRows: msg.config?.minTrainingRows ?? 3,
      minTrainingMonths: msg.config?.minTrainingMonths ?? 3,
      fallback: msg.config?.fallback ?? "drop_date_range",
    };

    byCurrency = new Map();
    for (const row of msg.realizedListingPerformance) {
      const group = byCurrency.get(row.currency);
      if (group) group.push(row);
      else byCurrency.set(row.currency, [row]);
    }

    pendingCompute = null;
    scheduled = false;
    computing = false;

    postMessageSafe({ type: "ready", datasetId: msg.datasetId });
    return;
  }

  if (msg.type === "compute") {
    pendingCompute = msg;
    scheduleCompute();
  }
};
