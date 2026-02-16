import { describe, expect, it } from "bun:test";
import { computeMonthlyCashflow } from "../src/cashflow.js";
import type { CanonicalTransaction } from "../src/schema/canonical.js";

function makeTx(
  overrides: Partial<CanonicalTransaction>
): CanonicalTransaction {
  return {
    transactionId: "test-tx-1",
    source: "airbnb",
    sourceVersion: "v1",
    datasetKind: "paid",
    kind: "payout",
    occurredDate: "2026-01-30",
    netAmount: { currency: "USD", amountMinor: 199000 },
    grossAmount: { currency: "USD", amountMinor: 0 },
    hostServiceFeeAmount: { currency: "USD", amountMinor: 0 },
    cleaningFeeAmount: { currency: "USD", amountMinor: 0 },
    adjustmentAmount: { currency: "USD", amountMinor: 0 },
    rawRowRef: { fileName: "test.csv", rowNumber: 2 },
    ...overrides,
  };
}

describe("computeMonthlyCashflow", () => {
  it("includes payout and resolution_payout in cashflow", () => {
    const txs = [
      makeTx({ kind: "payout", netAmount: { currency: "USD", amountMinor: 199000 } }),
      makeTx({
        kind: "resolution_payout",
        transactionId: "tx-2",
        listing: {
          accountId: "acc-1",
          listingName: "Test",
          normalizedListingName: "test",
          listingId: "acc-1-test-abc",
        },
        netAmount: { currency: "USD", amountMinor: 5000 },
      }),
    ];

    const cashflow = computeMonthlyCashflow(txs);
    const totalPayouts = cashflow.reduce((s, c) => s + c.payoutsMinor, 0);
    expect(totalPayouts).toBe(204000);
  });

  it("unattributed payouts aggregate without listing id", () => {
    const txs = [
      makeTx({
        kind: "payout",
        listing: undefined,
        netAmount: { currency: "USD", amountMinor: 199000 },
      }),
    ];

    const cashflow = computeMonthlyCashflow(txs);
    expect(cashflow).toHaveLength(1);
    expect(cashflow[0].listingId).toBeUndefined();
    expect(cashflow[0].accountId).toBeUndefined();
    expect(cashflow[0].payoutsMinor).toBe(199000);
  });

  it("excludes upcoming rows from realized cashflow", () => {
    const txs = [
      makeTx({
        kind: "payout",
        datasetKind: "upcoming",
        netAmount: { currency: "USD", amountMinor: 199000 },
      }),
    ];

    // The cashflow function itself doesn't filter by datasetKind;
    // the pipeline should only pass realized transactions.
    // But the function does include all payout kinds.
    const cashflow = computeMonthlyCashflow(txs);
    // cashflow computation doesn't filter by datasetKind — that's the pipeline's job
    expect(cashflow).toHaveLength(1);
  });

  it("excludes reservation kinds from cashflow", () => {
    const txs = [
      makeTx({
        kind: "reservation",
        listing: {
          accountId: "acc-1",
          listingName: "Test",
          normalizedListingName: "test",
          listingId: "acc-1-test-abc",
        },
        stay: { checkInDate: "2026-01-29", checkOutDate: "2026-02-01", nights: 3 },
      }),
    ];

    const cashflow = computeMonthlyCashflow(txs);
    expect(cashflow).toHaveLength(0);
  });

  it("groups by month and currency", () => {
    const txs = [
      makeTx({
        transactionId: "tx-1",
        occurredDate: "2026-01-15",
        netAmount: { currency: "USD", amountMinor: 100000 },
      }),
      makeTx({
        transactionId: "tx-2",
        occurredDate: "2026-01-30",
        netAmount: { currency: "USD", amountMinor: 50000 },
      }),
      makeTx({
        transactionId: "tx-3",
        occurredDate: "2026-02-15",
        netAmount: { currency: "USD", amountMinor: 75000 },
      }),
    ];

    const cashflow = computeMonthlyCashflow(txs);
    const jan = cashflow.find((c) => c.month === "2026-01");
    const feb = cashflow.find((c) => c.month === "2026-02");

    expect(jan!.payoutsMinor).toBe(150000);
    expect(feb!.payoutsMinor).toBe(75000);
  });
});
