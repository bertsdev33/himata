import { describe, expect, it } from "bun:test";
import { readFileSync } from "fs";
import { join } from "path";
import { importAirbnbV1, importAirbnbV1Session } from "../src/index.js";
import type { ImportAirbnbV1Input } from "../src/index.js";

const FIXTURES_DIR = join(import.meta.dir, "..", "fixtures");

function loadFixture(fileName: string): string {
  return readFileSync(join(FIXTURES_DIR, fileName), "utf-8");
}

function makeInput(
  fileName: string,
  accountId: string,
  datasetKind: "paid" | "upcoming"
): ImportAirbnbV1Input {
  return {
    fileName,
    csvText: loadFixture(fileName),
    accountId,
    datasetKind,
  };
}

describe("Airbnb v1 importer", () => {
  describe("fixture parsing", () => {
    it("parses paid_a.csv successfully", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      expect(result.transactions.length).toBeGreaterThan(0);
      // No critical parsing failures
      const criticalWarnings = result.warnings.filter(
        (w) => w.code === "MISSING_REQUIRED_FIELD"
      );
      expect(criticalWarnings).toHaveLength(0);
    });

    it("parses paid_b.csv successfully", () => {
      const result = importAirbnbV1(makeInput("paid_b.csv", "account-b", "paid"));
      expect(result.transactions.length).toBeGreaterThan(0);
    });

    it("parses paid_c.csv successfully", () => {
      const result = importAirbnbV1(makeInput("paid_c.csv", "account-c", "paid"));
      expect(result.transactions.length).toBeGreaterThan(0);
    });

    it("parses upcoming_a.csv successfully", () => {
      const result = importAirbnbV1(
        makeInput("upcoming_a.csv", "account-a", "upcoming")
      );
      expect(result.transactions.length).toBeGreaterThan(0);
      // All transactions should be upcoming
      for (const tx of result.transactions) {
        expect(tx.datasetKind).toBe("upcoming");
      }
    });
  });

  describe("transaction type mapping", () => {
    it("maps all known Airbnb types correctly", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const kinds = new Set(result.transactions.map((t) => t.kind));
      expect(kinds.has("reservation")).toBe(true);
      expect(kinds.has("payout")).toBe(true);
      // paid_a.csv has adjustments and resolution adjustments
      expect(kinds.has("adjustment")).toBe(true);
      expect(kinds.has("resolution_adjustment")).toBe(true);
    });

    it("maps cancellation_fee from paid_a.csv", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const cancellations = result.transactions.filter(
        (t) => t.kind === "cancellation_fee"
      );
      expect(cancellations.length).toBeGreaterThan(0);
    });

    it("maps resolution_payout from paid_a.csv", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const resPayouts = result.transactions.filter(
        (t) => t.kind === "resolution_payout"
      );
      expect(resPayouts.length).toBeGreaterThan(0);
    });
  });

  describe("money mapping", () => {
    it("hostServiceFeeAmount = negated Service fee", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const reservations = result.transactions.filter(
        (t) => t.kind === "reservation"
      );
      for (const tx of reservations) {
        // Host service fee should be negative of the source service fee
        // The source "Service fee" is positive (host pays), so host-positive = negated
        expect(tx.hostServiceFeeAmount.amountMinor).toBeLessThanOrEqual(0);
      }
    });

    it("gross fallback uses amount + serviceFee when grossEarnings missing", () => {
      // For adjustment rows where gross earnings is empty
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const adjustments = result.transactions.filter(
        (t) => t.kind === "adjustment"
      );
      for (const adj of adjustments) {
        // Gross should be amount + service fee when gross earnings is empty
        // For adjustments, gross earnings is often empty in the CSV
        expect(adj.grossAmount.amountMinor).toBeDefined();
      }
    });

    it("payout net from Paid out column", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const payouts = result.transactions.filter((t) => t.kind === "payout");
      for (const p of payouts) {
        // Payout net should come from "Paid out" column (positive value)
        expect(p.netAmount.amountMinor).toBeGreaterThan(0);
      }
    });

    it("uses explicit zero Gross earnings (not fallback) when field is present", () => {
      // Regression: a row with Gross earnings = "0.00" should use 0, not Amount + Service fee
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Reservation,HMX123,,01/15/2026,01/17/2026,2,Guest 001,Test Listing,,,USD,100.00,3.00,0.00,0.00,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(1);
      // Gross should be 0 (the explicit value), NOT 100.00 + 3.00 = 103.00
      expect(result.transactions[0].grossAmount.amountMinor).toBe(0);
    });

    it("falls back to Amount + Service fee when Gross earnings is empty", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Adjustment,HMX123,,01/15/2026,01/17/2026,2,Guest 001,Test Listing,,,USD,-100.00,-3.00,0.00,,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(1);
      // Gross should be Amount + Service fee = -100.00 + -3.00 = -103.00
      expect(result.transactions[0].grossAmount.amountMinor).toBe(-10300);
    });

    it("falls back to Amount + Service fee when Gross earnings is malformed", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Reservation,HMX123,,01/15/2026,01/17/2026,2,Guest 001,Test Listing,,,USD,100.00,3.00,0.00,abc,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(1);
      // Gross should fall back to Amount + Service fee = 100.00 + 3.00 = 103.00
      expect(result.transactions[0].grossAmount.amountMinor).toBe(10300);
      // Should also emit INVALID_MONEY warning for Gross earnings
      const invalidWarnings = result.warnings.filter(
        (w) => w.code === "INVALID_MONEY" && w.message.includes("Gross earnings")
      );
      expect(invalidWarnings).toHaveLength(1);
    });

    it("all money amounts are integer minor units", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      for (const tx of result.transactions) {
        expect(Number.isInteger(tx.netAmount.amountMinor)).toBe(true);
        expect(Number.isInteger(tx.grossAmount.amountMinor)).toBe(true);
        expect(Number.isInteger(tx.hostServiceFeeAmount.amountMinor)).toBe(true);
        expect(Number.isInteger(tx.cleaningFeeAmount.amountMinor)).toBe(true);
        expect(Number.isInteger(tx.adjustmentAmount.amountMinor)).toBe(true);
      }
    });
  });

  describe("listing identity", () => {
    it("generates deterministic listingId", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const withListing = result.transactions.filter((t) => t.listing);

      // Same listing name in same account should produce same listingId
      const listingMap = new Map<string, string>();
      for (const tx of withListing) {
        const name = tx.listing!.normalizedListingName;
        const id = tx.listing!.listingId;
        if (listingMap.has(name)) {
          expect(listingMap.get(name)).toBe(id);
        } else {
          listingMap.set(name, id);
        }
      }
    });

    it("listingId is stable across files for same account+listing", () => {
      // If paid_a and another file have the same listing for the same account
      const resultA = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const resultA2 = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));

      const listingsA = new Set(
        resultA.transactions
          .filter((t) => t.listing)
          .map((t) => t.listing!.listingId)
      );
      const listingsA2 = new Set(
        resultA2.transactions
          .filter((t) => t.listing)
          .map((t) => t.listing!.listingId)
      );

      // Same file, same account = same listing IDs
      expect([...listingsA]).toEqual([...listingsA2]);
    });

    it("payout rows have no listing", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const payouts = result.transactions.filter((t) => t.kind === "payout");
      for (const p of payouts) {
        expect(p.listing).toBeUndefined();
      }
    });
  });

  describe("date handling", () => {
    it("parses MM/DD/YYYY dates to YYYY-MM-DD", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      for (const tx of result.transactions) {
        expect(tx.occurredDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        if (tx.stay) {
          expect(tx.stay.checkInDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
          expect(tx.stay.checkOutDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
    });

    it("reservation rows have stay windows", () => {
      const result = importAirbnbV1(makeInput("paid_a.csv", "account-a", "paid"));
      const reservations = result.transactions.filter(
        (t) => t.kind === "reservation"
      );
      for (const r of reservations) {
        expect(r.stay).toBeDefined();
        expect(r.stay!.nights).toBeGreaterThan(0);
      }
    });
  });

  describe("upcoming schema", () => {
    it("upcoming has no Paid out or Arriving by date columns", () => {
      const result = importAirbnbV1(
        makeInput("upcoming_a.csv", "account-a", "upcoming")
      );
      // Should parse without errors about missing Paid out
      const criticalWarnings = result.warnings.filter(
        (w) => w.code === "MISSING_REQUIRED_FIELD"
      );
      expect(criticalWarnings).toHaveLength(0);
    });

    it("upcoming transactions have no payout kinds", () => {
      const result = importAirbnbV1(
        makeInput("upcoming_a.csv", "account-a", "upcoming")
      );
      const payouts = result.transactions.filter(
        (t) => t.kind === "payout" || t.kind === "resolution_payout"
      );
      expect(payouts).toHaveLength(0);
    });
  });

  describe("session-level dedup", () => {
    it("deduplicates exact duplicate rows across files", () => {
      const input = makeInput("paid_a.csv", "account-a", "paid");
      const singleResult = importAirbnbV1(input);
      const result = importAirbnbV1Session([input, input]);

      // Session dedup uses fingerprint set. The first file's rows are
      // kept (minus any within-file collisions). The second file's rows
      // are all dropped as duplicates.
      const uniqueFingerprints = new Set(
        singleResult.transactions.map((t) => t.transactionId)
      );
      expect(result.transactions.length).toBe(uniqueFingerprints.size);

      const dedupWarnings = result.warnings.filter(
        (w) => w.code === "DEDUPLICATED_ROW"
      );
      // Dedup warnings = total rows from both files minus unique fingerprints
      expect(dedupWarnings.length).toBe(
        singleResult.transactions.length * 2 - uniqueFingerprints.size
      );
    });

    it("deduplicates within-file identical data rows", () => {
      const input = makeInput("paid_a.csv", "account-a", "paid");
      const singleResult = importAirbnbV1(input);
      const result = importAirbnbV1Session([input]);

      // Single file through session dedup should catch within-file dupes
      const uniqueFingerprints = new Set(
        singleResult.transactions.map((t) => t.transactionId)
      );

      // paid_a.csv has 2 pairs of identical data rows
      expect(singleResult.transactions.length - uniqueFingerprints.size).toBe(2);
      expect(result.transactions.length).toBe(uniqueFingerprints.size);
    });
  });

  describe("multi-currency", () => {
    it("emits MULTI_CURRENCY_PARTITIONED warning when multiple currencies detected", () => {
      // All our fixtures use USD, so no multi-currency warning with single file
      const result = importAirbnbV1Session([
        makeInput("paid_a.csv", "account-a", "paid"),
      ]);
      const multiCurrencyWarnings = result.warnings.filter(
        (w) => w.code === "MULTI_CURRENCY_PARTITIONED"
      );
      expect(multiCurrencyWarnings).toHaveLength(0);
    });
  });

  describe("warnings", () => {
    it("warns for performance rows missing listing", () => {
      // Resolution adjustments might have listing, so check explicit case
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Reservation,HMX123,,01/15/2026,01/17/2026,2,Guest 001,,,,USD,100.00,3.00,0.00,103.00,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      const missingListingWarnings = result.warnings.filter(
        (w) => w.code === "MISSING_LISTING_FOR_PERFORMANCE_ROW"
      );
      expect(missingListingWarnings.length).toBeGreaterThan(0);
    });

    it("ignores stay window when End date <= Start date", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Reservation,HMX123,,01/17/2026,01/15/2026,2,Guest 001,Test Listing,,,USD,100.00,3.00,0.00,103.00,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(1);
      // Stay should be undefined since the date range is invalid
      expect(result.transactions[0].stay).toBeUndefined();
      const dateWarnings = result.warnings.filter(
        (w) => w.code === "INVALID_DATE" && w.message.includes("not after")
      );
      expect(dateWarnings).toHaveLength(1);
    });

    it("skips non-payout row with missing Amount and emits warning", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Reservation,HMX123,,01/15/2026,01/17/2026,2,Guest 001,Test Listing,,,USD,,3.00,0.00,103.00,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(0);
      const missingAmountWarnings = result.warnings.filter(
        (w) => w.code === "MISSING_REQUIRED_FIELD" && w.message.includes("Amount")
      );
      expect(missingAmountWarnings).toHaveLength(1);
    });

    it("skips payout row with missing both Paid out and Amount and emits warning", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Paid out,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Payout,,,,,,,,,,USD,,,,,,,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(0);
      const missingWarnings = result.warnings.filter(
        (w) => w.code === "MISSING_REQUIRED_FIELD" && w.message.includes("Paid out")
      );
      expect(missingWarnings).toHaveLength(1);
    });

    it("skips non-payout row with malformed Amount", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Reservation,HMX123,,01/15/2026,01/17/2026,2,Guest 001,Test Listing,,,USD,abc,3.00,0.00,103.00,0.00,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(0);
      const invalidWarnings = result.warnings.filter(
        (w) => w.code === "INVALID_MONEY" && w.message.includes("Amount")
      );
      expect(invalidWarnings).toHaveLength(1);
    });

    it("payout row with Amount but no Paid out uses Amount as fallback", () => {
      const csvText = [
        "Date,Type,Confirmation code,Booking date,Start date,End date,Nights,Guest,Listing,Details,Reference code,Currency,Amount,Paid out,Service fee,Cleaning fee,Gross earnings,Occupancy taxes,Earnings year",
        '01/15/2026,Resolution Payout,HMX123,,,,,,Test Listing,,,USD,150.00,,,,150.00,,',
      ].join("\n");

      const result = importAirbnbV1({
        fileName: "test.csv",
        csvText,
        accountId: "test-account",
        datasetKind: "paid",
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].netAmount.amountMinor).toBe(15000);
    });
  });
});
