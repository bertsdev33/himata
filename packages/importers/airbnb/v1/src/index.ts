/**
 * Airbnb v1 CSV importer.
 *
 * Supports both "paid" and "upcoming" schema variants.
 * Maps raw CSV rows to CanonicalTransaction[] with warnings.
 */

import type {
  CanonicalTransaction,
  DatasetKind,
  ImportResult,
  ImportWarning,
  StayWindow,
  TransactionKind,
} from "@rental-analytics/core/schema/canonical.js";
import { parseCsv, type CsvRow } from "./csv-parser.js";
import { parseAirbnbDate, computeNightsBetween } from "./date-utils.js";
import { buildListingRef } from "./listing-identity.js";
import { parseMoney, zeroMoney } from "./money-utils.js";
import { buildRowFingerprint } from "./row-fingerprint.js";

/** Input to the Airbnb v1 importer */
export interface ImportAirbnbV1Input {
  fileName: string;
  csvText: string;
  /** Explicit account identifier from upload flow */
  accountId: string;
  datasetKind: DatasetKind;
}

/** Map of raw Airbnb Type values to canonical TransactionKind */
const TYPE_MAP: Record<string, TransactionKind> = {
  "Reservation": "reservation",
  "Adjustment": "adjustment",
  "Resolution Adjustment": "resolution_adjustment",
  "Cancellation Fee": "cancellation_fee",
  "Payout": "payout",
  "Resolution Payout": "resolution_payout",
};

/** Kinds that are performance-related and should have a listing */
const PERFORMANCE_KINDS = new Set<TransactionKind>([
  "reservation",
  "adjustment",
  "resolution_adjustment",
  "cancellation_fee",
]);

/** Kinds that are adjustment-like (adjustmentAmount is populated) */
const ADJUSTMENT_KINDS = new Set<TransactionKind>([
  "adjustment",
  "resolution_adjustment",
]);

/**
 * Import a single Airbnb v1 CSV file into canonical transactions.
 */
export function importAirbnbV1(input: ImportAirbnbV1Input): ImportResult {
  const { fileName, csvText, accountId, datasetKind } = input;
  const warnings: ImportWarning[] = [];
  const transactions: CanonicalTransaction[] = [];

  const rows = parseCsv(csvText);

  if (rows.length === 0) {
    return { transactions: [], warnings };
  }

  // Validate required columns
  const firstRow = rows[0];
  const requiredColumns = ["Date", "Type", "Currency"];
  for (const col of requiredColumns) {
    if (!(col in firstRow)) {
      warnings.push({
        code: "MISSING_REQUIRED_FIELD",
        message: `Required column "${col}" not found in CSV headers`,
        fileName,
      });
      return { transactions: [], warnings };
    }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNumber = i + 2; // 1-indexed, +1 for header

    const transaction = mapRow(row, rowNumber, fileName, accountId, datasetKind, warnings);
    if (transaction) {
      transactions.push(transaction);
    }
  }

  return { transactions, warnings };
}

/**
 * Import multiple files and deduplicate across them.
 * This is the session-level entry point.
 */
export function importAirbnbV1Session(
  inputs: ImportAirbnbV1Input[]
): ImportResult {
  const allTransactions: CanonicalTransaction[] = [];
  const allWarnings: ImportWarning[] = [];
  const seenFingerprints = new Set<string>();
  const currencies = new Set<string>();

  for (const input of inputs) {
    const result = importAirbnbV1(input);
    allWarnings.push(...result.warnings);

    for (const tx of result.transactions) {
      if (seenFingerprints.has(tx.transactionId)) {
        allWarnings.push({
          code: "DEDUPLICATED_ROW",
          message: `Duplicate row dropped (fingerprint: ${tx.transactionId})`,
          fileName: tx.rawRowRef.fileName,
          rowNumber: tx.rawRowRef.rowNumber,
        });
        continue;
      }
      seenFingerprints.add(tx.transactionId);
      allTransactions.push(tx);
      currencies.add(tx.netAmount.currency);
    }
  }

  if (currencies.size > 1) {
    allWarnings.push({
      code: "MULTI_CURRENCY_PARTITIONED",
      message: `Multiple currencies detected (${[...currencies].sort().join(", ")}). Aggregations will be partitioned by currency.`,
      fileName: inputs.map((i) => i.fileName).join(", "),
    });
  }

  return { transactions: allTransactions, warnings: allWarnings };
}

function mapRow(
  row: CsvRow,
  rowNumber: number,
  fileName: string,
  accountId: string,
  datasetKind: DatasetKind,
  warnings: ImportWarning[]
): CanonicalTransaction | null {
  const rawType = (row["Type"] ?? "").trim();
  const kind = TYPE_MAP[rawType];

  if (!kind) {
    if (rawType !== "") {
      warnings.push({
        code: "UNKNOWN_TRANSACTION_TYPE",
        message: `Unknown transaction type: "${rawType}"`,
        fileName,
        rowNumber,
      });
    }
    return null;
  }

  // Parse occurred date
  const occurredDate = parseAirbnbDate(row["Date"] ?? "");
  if (!occurredDate) {
    warnings.push({
      code: "INVALID_DATE",
      message: `Invalid or missing Date field`,
      fileName,
      rowNumber,
    });
    return null;
  }

  const currency = (row["Currency"] ?? "").trim();
  if (!currency) {
    warnings.push({
      code: "MISSING_REQUIRED_FIELD",
      message: `Missing Currency field`,
      fileName,
      rowNumber,
    });
    return null;
  }

  // Parse listing
  const rawListingName = (row["Listing"] ?? "").trim();
  const listing = rawListingName
    ? buildListingRef(accountId, rawListingName)
    : undefined;

  // Warn if performance row has no listing
  if (!listing && PERFORMANCE_KINDS.has(kind)) {
    warnings.push({
      code: "MISSING_LISTING_FOR_PERFORMANCE_ROW",
      message: `Performance row (${kind}) has no listing name`,
      fileName,
      rowNumber,
    });
  }

  // Parse stay window
  let stay: StayWindow | undefined;
  const startDate = parseAirbnbDate(row["Start date"] ?? "");
  const endDate = parseAirbnbDate(row["End date"] ?? "");
  const rawNights = parseInt(row["Nights"] ?? "", 10);

  if (startDate && endDate) {
    const computedNights = computeNightsBetween(startDate, endDate);

    if (computedNights <= 0) {
      // End date <= Start date: invalid stay window, skip stay entirely
      warnings.push({
        code: "INVALID_DATE",
        message: `End date (${endDate}) is not after Start date (${startDate}); stay window ignored`,
        fileName,
        rowNumber,
      });
    } else {
      // Warn if CSV nights column disagrees with date-computed nights
      if (
        Number.isFinite(rawNights) &&
        rawNights > 0 &&
        rawNights !== computedNights
      ) {
        warnings.push({
          code: "INVALID_DATE",
          message: `Nights column (${rawNights}) differs from date range (${computedNights}); using date-computed value`,
          fileName,
          rowNumber,
        });
      }

      stay = {
        checkInDate: startDate,
        checkOutDate: endDate,
        nights: computedNights,
      };
    }
  }

  // Validate kind-specific required money fields.
  // Payout kinds (payout, resolution_payout) use "Paid out" when present,
  // falling back to "Amount". Non-payout kinds require "Amount".
  const isPayoutKind = kind === "payout" || kind === "resolution_payout";
  const amountRaw = (row["Amount"] ?? "").trim();
  const paidOutRaw = (row["Paid out"] ?? "").trim();

  if (isPayoutKind && paidOutRaw === "" && amountRaw === "") {
    warnings.push({
      code: "MISSING_REQUIRED_FIELD",
      message: `Payout row (${kind}) is missing both Paid out and Amount fields`,
      fileName,
      rowNumber,
    });
    return null;
  }

  if (!isPayoutKind && amountRaw === "") {
    warnings.push({
      code: "MISSING_REQUIRED_FIELD",
      message: `Row (${kind}) is missing required Amount field`,
      fileName,
      rowNumber,
    });
    return null;
  }

  // Parse money fields
  const amountStr = row["Amount"] ?? "";
  const paidOutStr = row["Paid out"] ?? "";
  const serviceFeeStr = row["Service fee"] ?? "";
  const cleaningFeeStr = row["Cleaning fee"] ?? "";
  const grossEarningsStr = row["Gross earnings"] ?? "";

  const amount = parseMoney(amountStr, currency);
  const paidOut = parseMoney(paidOutStr, currency);
  const serviceFee = parseMoney(serviceFeeStr, currency);
  const cleaningFee = parseMoney(cleaningFeeStr, currency);
  const grossEarnings = parseMoney(grossEarningsStr, currency);

  // Emit warnings for malformed money fields
  const moneyFields = [
    { name: "Amount", result: amount },
    { name: "Paid out", result: paidOut },
    { name: "Service fee", result: serviceFee },
    { name: "Cleaning fee", result: cleaningFee },
    { name: "Gross earnings", result: grossEarnings },
  ];
  for (const { name, result } of moneyFields) {
    if (result.invalid) {
      warnings.push({
        code: "INVALID_MONEY",
        message: `Malformed ${name} value: "${row[name]}"`,
        fileName,
        rowNumber,
      });
    }
  }

  // Skip rows where the required monetary field is malformed (non-empty but unparseable)
  if (isPayoutKind) {
    // Payout kinds: the net source is Paid out (if present) or Amount
    const netSource = paidOutRaw !== "" ? paidOut : amount;
    if (netSource.invalid) {
      // Warning already emitted above; skip row to avoid corrupting metrics
      return null;
    }
  } else {
    if (amount.invalid) {
      // Warning already emitted above; skip row to avoid corrupting metrics
      return null;
    }
  }

  // Net amount: for payout kinds, prefer Paid out when present, else Amount.
  // For non-payout kinds, always use Amount.
  const netAmount = isPayoutKind
    ? (paidOutRaw !== "" ? paidOut.money : amount.money)
    : amount.money;

  // Gross amount: use Gross earnings when the raw field is non-empty and valid,
  // fallback to Amount + Service fee when missing or malformed
  const grossEarningsRaw = (row["Gross earnings"] ?? "").trim();
  const grossFallback = { currency, amountMinor: amount.money.amountMinor + serviceFee.money.amountMinor };
  const grossAmount = (grossEarningsRaw !== "" && !grossEarnings.invalid)
    ? grossEarnings.money
    : grossFallback;

  // Host service fee: negate (host-positive convention)
  const hostServiceFeeAmount = {
    currency,
    amountMinor: -serviceFee.money.amountMinor,
  };

  // Adjustment amount: populated for adjustment-like kinds
  const adjustmentAmount = ADJUSTMENT_KINDS.has(kind)
    ? amount.money
    : zeroMoney(currency);

  // Build fingerprint for dedup
  const transactionId = buildRowFingerprint(accountId, row);

  return {
    transactionId,
    source: "airbnb",
    sourceVersion: "v1",
    datasetKind,
    kind,
    occurredDate,
    listing,
    stay,
    netAmount,
    grossAmount,
    hostServiceFeeAmount,
    cleaningFeeAmount: cleaningFee.money,
    adjustmentAmount,
    rawRowRef: { fileName, rowNumber },
  };
}
