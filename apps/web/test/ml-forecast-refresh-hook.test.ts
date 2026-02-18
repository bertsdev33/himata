import { describe, expect, test } from "bun:test";
import {
  buildDesiredTrainingScope,
  deriveRefreshStatus,
  shouldScheduleAutoRefresh,
} from "../src/hooks/useMlForecastRefresh";

describe("useMlForecastRefresh helpers", () => {
  test("buildDesiredTrainingScope ignores date range when trainingFollowsDateRange is false", () => {
    const scope = buildDesiredTrainingScope({
      currency: "USD",
      selectedAccountIds: ["b", "a"],
      selectedListingIds: ["l2", "l1"],
      dateRange: { start: "2024-01", end: "2024-12" },
      trainingFollowsDateRange: false,
    });

    expect(scope).toEqual({
      currency: "USD",
      accountIds: ["a", "b"],
      listingIds: ["l1", "l2"],
      dateRangeStart: null,
      dateRangeEnd: null,
    });
  });

  test("buildDesiredTrainingScope includes date range when enabled", () => {
    const scope = buildDesiredTrainingScope({
      currency: "USD",
      selectedAccountIds: ["a"],
      selectedListingIds: ["l1"],
      dateRange: { start: "2024-06", end: "2024-09" },
      trainingFollowsDateRange: true,
    });

    expect(scope.dateRangeStart).toBe("2024-06");
    expect(scope.dateRangeEnd).toBe("2024-09");
  });

  test("shouldScheduleAutoRefresh requires both auto mode and ready worker", () => {
    expect(
      shouldScheduleAutoRefresh({ autoRefreshEnabled: true, workerReady: true }),
    ).toBe(true);
    expect(
      shouldScheduleAutoRefresh({ autoRefreshEnabled: false, workerReady: true }),
    ).toBe(false);
    expect(
      shouldScheduleAutoRefresh({ autoRefreshEnabled: true, workerReady: false }),
    ).toBe(false);
  });

  test("deriveRefreshStatus transitions between idle, stale, and up_to_date", () => {
    expect(deriveRefreshStatus({ hasCached: false, hasSnapshot: false })).toBe("idle");
    expect(deriveRefreshStatus({ hasCached: false, hasSnapshot: true })).toBe("stale");
    expect(deriveRefreshStatus({ hasCached: true, hasSnapshot: false })).toBe("up_to_date");
  });
});
