/**
 * Money parsing and normalization utilities.
 * All amounts are converted to minor units (cents) as integers.
 */

import type { Money } from "@rental-analytics/core/schema/canonical.js";

/** Result of parsing a money string */
export interface MoneyParseResult {
  amountMinor: number;
  /** true if the input was non-empty but could not be parsed */
  invalid: boolean;
}

/**
 * Parse a string amount to minor units (cents).
 * Handles negative values, commas, and empty strings.
 * Returns { amountMinor: 0, invalid: false } for empty/missing values.
 * Returns { amountMinor: 0, invalid: true } for malformed non-empty values.
 */
export function parseToMinorUnits(amountStr: string): MoneyParseResult {
  const trimmed = amountStr.trim().replace(/,/g, "");
  if (trimmed === "" || trimmed === "-") {
    return { amountMinor: 0, invalid: false };
  }

  // Strict numeric validation: only allow optional sign, digits, optional decimal point + digits
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return { amountMinor: 0, invalid: true };
  }

  const parsed = parseFloat(trimmed);
  if (!Number.isFinite(parsed)) {
    return { amountMinor: 0, invalid: true };
  }

  // Deterministic rounding to cents
  return { amountMinor: Math.round(parsed * 100), invalid: false };
}

/**
 * Create a Money object from a string amount and currency.
 */
export function parseMoney(amountStr: string, currency: string): { money: Money; invalid: boolean } {
  const result = parseToMinorUnits(amountStr);
  return {
    money: { currency, amountMinor: result.amountMinor },
    invalid: result.invalid,
  };
}

/**
 * Create a zero Money object for a given currency.
 */
export function zeroMoney(currency: string): Money {
  return { currency, amountMinor: 0 };
}
