import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { AnalyticsData } from "@/app/types";
import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type {
  MlForecastRefreshStatus,
  MlForecastSnapshot,
  TrainingScope,
  MlWorkerResponse,
  MlWorkerRequest,
} from "@/lib/ml-forecast-refresh-types";
import { normalizeTrainingScope, trainingScopeKey } from "@/lib/ml-forecast-refresh-types";

interface IdleDeadlineLike {
  didTimeout: boolean;
  timeRemaining: () => number;
}

interface IdleApi {
  requestIdleCallback?: (
    callback: (deadline: IdleDeadlineLike) => void,
    options?: { timeout?: number },
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}

interface IdleTask {
  kind: "idle" | "timeout";
  id: number;
}

class LruCache<K, V> {
  private map = new Map<K, V>();

  constructor(private readonly maxSize: number) {}

  get(key: K): V | undefined {
    const value = this.map.get(key);
    if (value === undefined) return undefined;
    this.map.delete(key);
    this.map.set(key, value);
    return value;
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

function newDatasetId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function buildDesiredTrainingScope(args: {
  currency: string;
  selectedAccountIds: string[];
  selectedListingIds: string[];
  dateRange: { start: string | null; end: string | null };
  trainingFollowsDateRange: boolean;
}): TrainingScope {
  return normalizeTrainingScope({
    currency: args.currency,
    accountIds: args.selectedAccountIds,
    listingIds: args.selectedListingIds,
    dateRangeStart: args.trainingFollowsDateRange ? args.dateRange.start : null,
    dateRangeEnd: args.trainingFollowsDateRange ? args.dateRange.end : null,
  });
}

export function shouldScheduleAutoRefresh(args: {
  autoRefreshEnabled: boolean;
  workerReady: boolean;
}): boolean {
  return args.autoRefreshEnabled && args.workerReady;
}

export function deriveRefreshStatus(args: {
  hasCached: boolean;
  hasSnapshot: boolean;
}): MlForecastRefreshStatus {
  if (args.hasCached) return "up_to_date";
  return args.hasSnapshot ? "stale" : "idle";
}

export interface UseMlForecastRefreshArgs {
  analytics: AnalyticsData;
  realizedListingPerformance?: MonthlyListingPerformance[];
  currency: string;
  selectedAccountIds: string[];
  selectedListingIds: string[];
  dateRange: { start: string | null; end: string | null };
  autoRefreshEnabled: boolean;
  trainingFollowsDateRange?: boolean;
  debounceMs?: number;
  cacheSize?: number;
  minTrainingRows?: number;
  minTrainingMonths?: number;
  fallback?: "drop_date_range" | "none";
}

interface UseMlForecastRefreshState {
  status: MlForecastRefreshStatus;
  snapshot: MlForecastSnapshot | null;
  error: string | null;
  workerReady: boolean;
}

export function useMlForecastRefresh({
  analytics,
  realizedListingPerformance,
  currency,
  selectedAccountIds,
  selectedListingIds,
  dateRange,
  autoRefreshEnabled,
  trainingFollowsDateRange = false,
  debounceMs = 400,
  cacheSize = 5,
  minTrainingRows = 3,
  minTrainingMonths = 3,
  fallback = "drop_date_range",
}: UseMlForecastRefreshArgs) {
  const cacheRef = useRef(new LruCache<string, MlForecastSnapshot>(cacheSize));
  const workerRef = useRef<Worker | null>(null);
  const requestIdRef = useRef(0);
  const debounceTimerRef = useRef<number | null>(null);
  const idleTaskRef = useRef<IdleTask | null>(null);
  const datasetIdRef = useRef<string>(newDatasetId());
  const [datasetId, setDatasetId] = useState<string>(datasetIdRef.current);

  const [state, setState] = useState<UseMlForecastRefreshState>({
    status: "idle",
    snapshot: null,
    error: null,
    workerReady: false,
  });

  const desiredScope = useMemo<TrainingScope>(
    () =>
      buildDesiredTrainingScope({
        currency,
        selectedAccountIds,
        selectedListingIds,
        dateRange,
        trainingFollowsDateRange,
      }),
    [
      currency,
      selectedAccountIds,
      selectedListingIds,
      dateRange.start,
      dateRange.end,
      trainingFollowsDateRange,
    ],
  );

  const desiredKey = useMemo(
    () => `${datasetId}:${trainingScopeKey(desiredScope)}`,
    [datasetId, desiredScope],
  );

  const cancelIdleTask = useCallback(() => {
    if (!idleTaskRef.current) return;
    const idleWindow = window as Window & IdleApi;
    if (idleTaskRef.current.kind === "idle" && typeof idleWindow.cancelIdleCallback === "function") {
      idleWindow.cancelIdleCallback(idleTaskRef.current.id);
    } else {
      window.clearTimeout(idleTaskRef.current.id);
    }
    idleTaskRef.current = null;
  }, []);

  const cancelAllScheduledWork = useCallback(() => {
    if (debounceTimerRef.current !== null) {
      window.clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }
    cancelIdleTask();
  }, [cancelIdleTask]);

  const startCompute = useCallback(() => {
    if (!workerRef.current || !state.workerReady) return false;

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    setState((prev) => ({ ...prev, status: "recomputing", error: null }));

    const message: MlWorkerRequest = {
      type: "compute",
      datasetId: datasetIdRef.current,
      requestId,
      desiredScope,
    };
    workerRef.current.postMessage(message);
    return true;
  }, [desiredScope, state.workerReady]);

  useEffect(() => {
    requestIdRef.current += 1;

    const nextDatasetId = newDatasetId();
    datasetIdRef.current = nextDatasetId;
    setDatasetId(nextDatasetId);

    cacheRef.current.clear();
    cancelAllScheduledWork();

    if (workerRef.current) {
      workerRef.current.terminate();
      workerRef.current = null;
    }

    const worker = new Worker(
      new URL("../workers/ml-forecast.worker.ts", import.meta.url),
      { type: "module" },
    );
    workerRef.current = worker;

    setState({
      status: "idle",
      snapshot: null,
      error: null,
      workerReady: false,
    });

    worker.onmessage = (event: MessageEvent<MlWorkerResponse>) => {
      const message = event.data;

      if (message.type === "ready") {
        if (message.datasetId !== datasetIdRef.current) return;
        setState((prev) => ({ ...prev, workerReady: true }));
        return;
      }

      if (message.type === "result") {
        if (message.datasetId !== datasetIdRef.current) return;
        if (message.requestId !== requestIdRef.current) return;

        const snapshot: MlForecastSnapshot = {
          datasetId: message.datasetId,
          desiredScope: message.desiredScope,
          effectiveScope: message.effectiveScope,
          usedFallback: message.usedFallback,
          fallbackReason: message.fallbackReason,
          trainedAt: message.trainedAt,
          trainingMeta: message.trainingMeta,
          result: message.result,
        };

        cacheRef.current.set(
          `${message.datasetId}:${trainingScopeKey(message.desiredScope)}`,
          snapshot,
        );
        setState({
          status: "up_to_date",
          snapshot,
          error: null,
          workerReady: true,
        });
        return;
      }

      if (message.type === "error") {
        if (message.datasetId && message.datasetId !== datasetIdRef.current) return;
        if (message.requestId != null && message.requestId !== requestIdRef.current) return;
        setState((prev) => ({
          ...prev,
          status: "failed",
          error: message.error || "Forecast compute failed",
        }));
      }
    };

    worker.onerror = (error) => {
      setState((prev) => ({
        ...prev,
        status: "failed",
        error: error.message || "Worker error",
      }));
    };

    const initMessage: MlWorkerRequest = {
      type: "init",
      datasetId: nextDatasetId,
      realizedListingPerformance:
        realizedListingPerformance ?? analytics.views.realized.listingPerformance,
      config: { minTrainingRows, minTrainingMonths, fallback },
    };
    worker.postMessage(initMessage);

    return () => {
      cancelAllScheduledWork();
      worker.terminate();
      workerRef.current = null;
    };
  }, [
    analytics,
    realizedListingPerformance,
    minTrainingRows,
    minTrainingMonths,
    fallback,
    cancelAllScheduledWork,
  ]);

  useEffect(() => {
    const cached = cacheRef.current.get(desiredKey);
    if (cached) {
      setState((prev) => ({
        ...prev,
        status: deriveRefreshStatus({ hasCached: true, hasSnapshot: prev.snapshot !== null }),
        snapshot: cached,
        error: null,
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      status: deriveRefreshStatus({ hasCached: false, hasSnapshot: prev.snapshot !== null }),
      error: null,
    }));

    cancelAllScheduledWork();

    if (!shouldScheduleAutoRefresh({ autoRefreshEnabled, workerReady: state.workerReady })) return;

    debounceTimerRef.current = window.setTimeout(() => {
      const idleWindow = window as Window & IdleApi;
      if (typeof idleWindow.requestIdleCallback === "function") {
        idleTaskRef.current = {
          kind: "idle",
          id: idleWindow.requestIdleCallback(
            () => {
              idleTaskRef.current = null;
              startCompute();
            },
            { timeout: 1500 },
          ),
        };
      } else {
        idleTaskRef.current = {
          kind: "timeout",
          id: window.setTimeout(() => {
            idleTaskRef.current = null;
            startCompute();
          }, 0),
        };
      }
    }, debounceMs);
  }, [
    autoRefreshEnabled,
    cancelAllScheduledWork,
    debounceMs,
    desiredKey,
    startCompute,
    state.workerReady,
  ]);

  const refreshNow = useCallback(() => {
    cancelAllScheduledWork();
    return startCompute();
  }, [cancelAllScheduledWork, startCompute]);

  return {
    status: state.status,
    snapshot: state.snapshot,
    forecast: state.snapshot?.result ?? null,
    error: state.error,
    workerReady: state.workerReady,
    desiredScope,
    refreshNow,
  };
}
