import { describe, expect, it } from "bun:test";
import {
  computeEstimatedOccupancy,
  inferListingServiceRanges,
} from "../src/occupancy.js";
import type {
  CanonicalTransaction,
  ListingServiceRange,
  MonthlyListingPerformance,
  YearMonth,
} from "../src/schema/canonical.js";

function makePerf(
  month: string,
  listingId: string,
  bookedNights: number
): MonthlyListingPerformance {
  return {
    month: month as YearMonth,
    accountId: "acc-1",
    listingId,
    listingName: "Test Listing",
    currency: "USD",
    bookedNights,
    grossRevenueMinor: bookedNights * 10000,
    netRevenueMinor: bookedNights * 9000,
    cleaningFeesMinor: 0,
    serviceFeesMinor: 0,
    reservationRevenueMinor: bookedNights * 9000,
    adjustmentRevenueMinor: 0,
    resolutionAdjustmentRevenueMinor: 0,
    cancellationFeeRevenueMinor: 0,
  };
}

describe("computeEstimatedOccupancy", () => {
  it("computes occupancy correctly", () => {
    const perfs = [makePerf("2026-01", "listing-1", 20)];

    const serviceRanges: ListingServiceRange[] = [
      {
        listingId: "listing-1",
        currency: "USD",
        firstStayStart: "2025-12-01",
        lastStayEnd: "2026-02-28",
      },
    ];

    const result = computeEstimatedOccupancy(perfs, serviceRanges);
    expect(result).toHaveLength(1);

    // Jan has 31 days, 1 listing in service
    expect(result[0].daysInMonth).toBe(31);
    expect(result[0].listingsInService).toBe(1);
    expect(result[0].bookedNights).toBe(20);
    // 20 / (31 * 1) ≈ 0.6452
    expect(result[0].estimatedOccupancyRate).toBeCloseTo(0.6452, 3);
  });

  it("includes required label and disclaimer", () => {
    const perfs = [makePerf("2026-01", "listing-1", 10)];
    const serviceRanges: ListingServiceRange[] = [
      {
        listingId: "listing-1",
        currency: "USD",
        firstStayStart: "2026-01-01",
        lastStayEnd: "2026-01-31",
      },
    ];

    const result = computeEstimatedOccupancy(perfs, serviceRanges);
    expect(result[0].label).toBe("Estimated Occupancy (Assumption-Based)");
    expect(result[0].disclaimer).toBe(
      "booked nights / (days_in_month * listings_in_service); not true occupancy"
    );
  });

  it("counts multiple listings in service for a month", () => {
    const perfs = [
      makePerf("2026-01", "listing-1", 15),
      makePerf("2026-01", "listing-2", 20),
    ];

    const serviceRanges: ListingServiceRange[] = [
      {
        listingId: "listing-1",
        currency: "USD",
        firstStayStart: "2026-01-01",
        lastStayEnd: "2026-01-31",
      },
      {
        listingId: "listing-2",
        currency: "USD",
        firstStayStart: "2026-01-01",
        lastStayEnd: "2026-01-31",
      },
    ];

    const result = computeEstimatedOccupancy(perfs, serviceRanges);
    expect(result).toHaveLength(1);
    expect(result[0].listingsInService).toBe(2);
    expect(result[0].bookedNights).toBe(35);
    // 35 / (31 * 2) = 35 / 62 ≈ 0.5645
    expect(result[0].estimatedOccupancyRate).toBeCloseTo(0.5645, 3);
  });

  it("treats lastStayEnd as checkout-exclusive (stay ending on 1st excludes that month)", () => {
    // A stay checking out on Feb 1 means the last occupied night is Jan 31.
    // The listing should NOT be counted as in-service for February.
    const perfs = [
      makePerf("2026-01", "listing-1", 10),
      makePerf("2026-02", "listing-1", 5),
    ];

    const serviceRanges: ListingServiceRange[] = [
      {
        listingId: "listing-1",
        currency: "USD",
        firstStayStart: "2026-01-15",
        lastStayEnd: "2026-02-01", // checkout on Feb 1 = last night Jan 31
      },
    ];

    const result = computeEstimatedOccupancy(perfs, serviceRanges);
    // January should have listing in service
    const jan = result.find((r) => r.month === "2026-01");
    expect(jan).toBeDefined();
    expect(jan!.listingsInService).toBe(1);
    // February should NOT have listing in service (checkout-exclusive)
    const feb = result.find((r) => r.month === "2026-02");
    expect(feb).toBeDefined();
    expect(feb!.listingsInService).toBe(0);
  });

  it("returns null occupancy when no listings in service", () => {
    const perfs = [makePerf("2026-01", "listing-1", 10)];
    // No service ranges at all
    const result = computeEstimatedOccupancy(perfs, []);
    expect(result).toHaveLength(1);
    expect(result[0].listingsInService).toBe(0);
    expect(result[0].estimatedOccupancyRate).toBeNull();
  });
});

describe("inferListingServiceRanges", () => {
  it("infers ranges from transactions with stay windows", () => {
    const txs: CanonicalTransaction[] = [
      {
        transactionId: "tx-1",
        source: "airbnb",
        sourceVersion: "v1",
        datasetKind: "paid",
        kind: "reservation",
        occurredDate: "2026-01-15",
        listing: {
          accountId: "acc-1",
          listingName: "Test",
          normalizedListingName: "test",
          listingId: "listing-1",
        },
        stay: {
          checkInDate: "2026-01-10",
          checkOutDate: "2026-01-15",
          nights: 5,
        },
        netAmount: { currency: "USD", amountMinor: 50000 },
        grossAmount: { currency: "USD", amountMinor: 55000 },
        hostServiceFeeAmount: { currency: "USD", amountMinor: -5000 },
        cleaningFeeAmount: { currency: "USD", amountMinor: 3500 },
        adjustmentAmount: { currency: "USD", amountMinor: 0 },
        rawRowRef: { fileName: "test.csv", rowNumber: 2 },
      },
      {
        transactionId: "tx-2",
        source: "airbnb",
        sourceVersion: "v1",
        datasetKind: "paid",
        kind: "reservation",
        occurredDate: "2026-02-15",
        listing: {
          accountId: "acc-1",
          listingName: "Test",
          normalizedListingName: "test",
          listingId: "listing-1",
        },
        stay: {
          checkInDate: "2026-02-10",
          checkOutDate: "2026-02-20",
          nights: 10,
        },
        netAmount: { currency: "USD", amountMinor: 100000 },
        grossAmount: { currency: "USD", amountMinor: 110000 },
        hostServiceFeeAmount: { currency: "USD", amountMinor: -10000 },
        cleaningFeeAmount: { currency: "USD", amountMinor: 3500 },
        adjustmentAmount: { currency: "USD", amountMinor: 0 },
        rawRowRef: { fileName: "test.csv", rowNumber: 3 },
      },
    ];

    const ranges = inferListingServiceRanges([], txs);
    expect(ranges).toHaveLength(1);
    expect(ranges[0].firstStayStart).toBe("2026-01-10");
    expect(ranges[0].lastStayEnd).toBe("2026-02-20");
  });
});
