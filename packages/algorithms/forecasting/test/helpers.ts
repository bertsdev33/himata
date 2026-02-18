import type { MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";

interface SyntheticDataOptions {
  listingId?: string;
  listingName?: string;
  accountId?: string;
  currency?: string;
  startMonth?: string; // YYYY-MM
  months: number;
  baseRevenue: number; // minor units (cents)
  monthlyGrowth?: number; // additive growth per month in minor units
  seasonalAmplitude?: number; // minor units
  noise?: number; // minor units (max random offset)
}

/** Advance a "YYYY-MM" string by `n` months. */
function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const totalMonths = y * 12 + (m - 1) + n;
  const newYear = Math.floor(totalMonths / 12);
  const newMonth = (totalMonths % 12) + 1;
  return `${newYear}-${String(newMonth).padStart(2, "0")}`;
}

/**
 * Generate synthetic MonthlyListingPerformance data for testing.
 * Revenue follows: base + growth * i + seasonal * sin(2pi * month / 12) + noise
 */
export function generateSyntheticData(opts: SyntheticDataOptions): MonthlyListingPerformance[] {
  const {
    listingId = "listing-1",
    listingName = "Test Listing",
    accountId = "acc-1",
    currency = "USD",
    startMonth = "2024-01",
    months,
    baseRevenue,
    monthlyGrowth = 0,
    seasonalAmplitude = 0,
    noise = 0,
  } = opts;

  const result: MonthlyListingPerformance[] = [];

  // Use a seeded-ish deterministic approach for noise
  let seed = 42;
  function pseudoRandom(): number {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed / 0x7fffffff) * 2 - 1; // -1 to 1
  }

  for (let i = 0; i < months; i++) {
    const month = addMonths(startMonth, i) as YearMonth;
    const mn = parseInt(month.split("-")[1], 10);
    const seasonal = seasonalAmplitude * Math.sin((2 * Math.PI * mn) / 12);
    const noiseVal = noise * pseudoRandom();
    const gross = Math.max(0, Math.round(baseRevenue + monthlyGrowth * i + seasonal + noiseVal));
    const nights = Math.max(1, Math.round(gross / 10000)); // rough approximation

    result.push({
      month,
      accountId,
      listingId,
      listingName,
      currency,
      bookedNights: nights,
      grossRevenueMinor: gross,
      netRevenueMinor: Math.round(gross * 0.85),
      cleaningFeesMinor: Math.round(gross * 0.05),
      serviceFeesMinor: Math.round(gross * 0.1),
      reservationRevenueMinor: gross,
      adjustmentRevenueMinor: 0,
      resolutionAdjustmentRevenueMinor: 0,
      cancellationFeeRevenueMinor: 0,
    });
  }

  return result;
}
