import { beforeAll, beforeEach, describe, expect, test } from "bun:test";
import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type {
  MlWorkerRequest,
  MlWorkerResponse,
  MlResultMessage,
  TrainingScope,
} from "../src/lib/ml-forecast-refresh-types";

interface WorkerHarness {
  onmessage: ((evt: { data: MlWorkerRequest }) => void) | null;
  postMessage: (msg: MlWorkerResponse) => void;
}

const emitted: MlWorkerResponse[] = [];
const harness: WorkerHarness = {
  onmessage: null,
  postMessage: (msg) => emitted.push(msg),
};

(globalThis as unknown as { self: WorkerHarness }).self = harness;

function makeRow(month: string, listingId: string, accountId = "acc-1"): MonthlyListingPerformance {
  return {
    month,
    accountId,
    listingId,
    listingName: `Listing ${listingId}`,
    currency: "USD",
    bookedNights: 10,
    grossRevenueMinor: 100_000,
    netRevenueMinor: 90_000,
    cleaningFeesMinor: 10_000,
    serviceFeesMinor: -10_000,
    reservationRevenueMinor: 100_000,
    adjustmentRevenueMinor: 0,
    resolutionAdjustmentRevenueMinor: 0,
    cancellationFeeRevenueMinor: 0,
  };
}

function send(message: MlWorkerRequest) {
  if (!harness.onmessage) {
    throw new Error("worker module not loaded");
  }
  harness.onmessage({ data: message });
}

async function waitForResult(datasetId: string, requestId: number): Promise<MlResultMessage> {
  const deadline = Date.now() + 1_000;
  while (Date.now() < deadline) {
    const result = emitted.find(
      (msg): msg is MlResultMessage =>
        msg.type === "result" && msg.datasetId === datasetId && msg.requestId === requestId,
    );
    if (result) return result;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("timed out waiting for worker result");
}

beforeAll(async () => {
  await import("../src/workers/ml-forecast.worker.ts");
});

beforeEach(() => {
  emitted.length = 0;
});

describe("ml-forecast worker", () => {
  test("drops date range as fallback when scoped data is insufficient", async () => {
    const datasetId = "ds-fallback";
    const rows = [
      makeRow("2024-01", "l1"),
      makeRow("2024-02", "l1"),
      makeRow("2024-03", "l1"),
      makeRow("2024-04", "l1"),
    ];

    send({
      type: "init",
      datasetId,
      realizedListingPerformance: rows,
      config: { minTrainingRows: 3, minTrainingMonths: 3, fallback: "drop_date_range" },
    });

    const desiredScope: TrainingScope = {
      currency: "USD",
      accountIds: [],
      listingIds: [],
      dateRangeStart: "2024-04",
      dateRangeEnd: "2024-04",
    };

    send({
      type: "compute",
      datasetId,
      requestId: 1,
      desiredScope,
    });

    const result = await waitForResult(datasetId, 1);

    expect(result.usedFallback).toBe(true);
    expect(result.fallbackReason).toBe("insufficient_data_in_date_range__trained_on_full_history");
    expect(result.effectiveScope.dateRangeStart).toBeNull();
    expect(result.effectiveScope.dateRangeEnd).toBeNull();
    expect(result.trainingMeta.rowCount).toBe(4);
  });

  test("returns insufficient_training_data when fallback is disabled", async () => {
    const datasetId = "ds-no-fallback";
    const rows = [
      makeRow("2024-01", "l1"),
      makeRow("2024-02", "l1"),
      makeRow("2024-03", "l1"),
      makeRow("2024-04", "l1"),
    ];

    send({
      type: "init",
      datasetId,
      realizedListingPerformance: rows,
      config: { minTrainingRows: 3, minTrainingMonths: 3, fallback: "none" },
    });

    send({
      type: "compute",
      datasetId,
      requestId: 1,
      desiredScope: {
        currency: "USD",
        accountIds: [],
        listingIds: [],
        dateRangeStart: "2024-04",
        dateRangeEnd: "2024-04",
      },
    });

    const result = await waitForResult(datasetId, 1);

    expect(result.usedFallback).toBe(false);
    expect(result.fallbackReason).toBe("insufficient_training_data");
    expect(result.result).toBeNull();
    expect(result.trainingMeta.rowCount).toBe(1);
  });

  test("returns insufficient_per_listing_history when rows are sufficient but listings are not trainable", async () => {
    const datasetId = "ds-per-listing";
    const rows = [
      makeRow("2024-01", "l1"),
      makeRow("2024-01", "l2"),
      makeRow("2024-01", "l3"),
    ];

    send({
      type: "init",
      datasetId,
      realizedListingPerformance: rows,
      config: { minTrainingRows: 1, minTrainingMonths: 1, fallback: "none" },
    });

    send({
      type: "compute",
      datasetId,
      requestId: 1,
      desiredScope: {
        currency: "USD",
        accountIds: [],
        listingIds: [],
        dateRangeStart: null,
        dateRangeEnd: null,
      },
    });

    const result = await waitForResult(datasetId, 1);

    expect(result.trainingMeta.rowCount).toBe(3);
    expect(result.fallbackReason).toBe("insufficient_per_listing_history");
    expect(result.result).toBeNull();
  });
});
