/**
 * Date parsing and validation utilities for Airbnb CSV imports.
 * Airbnb CSV dates use MM/DD/YYYY format.
 */

/**
 * Parse an Airbnb date string (MM/DD/YYYY) to ISO format (YYYY-MM-DD).
 * Returns null if the input is empty or malformed.
 * Validates that the date is a real calendar date.
 */
export function parseAirbnbDate(dateStr: string): string | null {
  const trimmed = dateStr.trim();
  if (trimmed === "") return null;

  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;

  const m = parseInt(match[1], 10);
  const d = parseInt(match[2], 10);
  const y = parseInt(match[3], 10);

  if (m < 1 || m > 12 || d < 1) return null;

  // Validate against actual calendar using Date constructor
  // Date(y, m, 0) gives last day of month m
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d > daysInMonth) return null;

  const month = String(m).padStart(2, "0");
  const day = String(d).padStart(2, "0");
  return `${y}-${month}-${day}`;
}

/**
 * Compute the number of nights between two ISO dates (checkout exclusive).
 */
export function computeNightsBetween(checkIn: string, checkOut: string): number {
  const inDate = new Date(checkIn + "T00:00:00Z");
  const outDate = new Date(checkOut + "T00:00:00Z");
  const diffMs = outDate.getTime() - inDate.getTime();
  return Math.round(diffMs / (24 * 60 * 60 * 1000));
}
