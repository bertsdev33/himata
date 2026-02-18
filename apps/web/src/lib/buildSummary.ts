import type { AnalyticsData } from "@/app/types";

export interface AnalyticsSummary {
  currency: string;
  dateRange: { from: string; to: string };

  kpis: {
    totalRevenue: number;
    avgNightlyRate: number;
    occupancyRate: number; // 0–1
    totalBookings: number;
    avgLengthOfStay: number; // nights
  };

  deltas: {
    // period-over-period % change
    revenue: number;
    occupancy: number;
    bookings: number;
    avgRate: number;
  };

  topMovers: {
    // up to 5 listings
    listing: string;
    revenueDelta: number;
    occupancyDelta: number;
  }[];

  warnings: string[]; // e.g. ["3 listings below 40% occupancy"]
}

export function buildSummary(data: AnalyticsData): AnalyticsSummary {
  const currency = data.currency;

  // Use all-view listing performance filtered to the primary currency
  const listingPerf = data.views.all.listingPerformance.filter(
    (lp) => lp.currency === currency,
  );

  const months = [...new Set(listingPerf.map((lp) => lp.month))].sort();
  const now = new Date();
  const fallbackMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const dateRange = {
    from: months[0] ?? fallbackMonth,
    to: months[months.length - 1] ?? fallbackMonth,
  };

  // Aggregate totals across the full period
  const totalNetMinor = listingPerf.reduce((sum, lp) => sum + lp.netRevenueMinor, 0);
  const totalGrossMinor = listingPerf.reduce((sum, lp) => sum + lp.grossRevenueMinor, 0);
  const totalNights = listingPerf.reduce((sum, lp) => sum + lp.bookedNights, 0);
  const avgNightlyRate = totalNights > 0 ? totalGrossMinor / totalNights / 100 : 0;

  // Occupancy: average of all monthly rates in the primary currency
  const occupancyRows = data.views.all.occupancy.filter(
    (o) => o.currency === currency && o.estimatedOccupancyRate !== null,
  );
  const avgOccupancy =
    occupancyRows.length > 0
      ? occupancyRows.reduce((sum, o) => sum + o.estimatedOccupancyRate!, 0) /
        occupancyRows.length
      : 0;

  // Bookings: distinct reservation transactions for the primary currency
  const reservations = data.transactions.filter(
    (t) => t.kind === "reservation" && t.netAmount.currency === currency,
  );
  const totalBookings = reservations.length;
  const totalStayNights = reservations.reduce((sum, t) => sum + (t.stay?.nights ?? 0), 0);
  const avgLengthOfStay =
    totalBookings > 0 ? Math.round((totalStayNights / totalBookings) * 10) / 10 : 0;

  // Period-over-period deltas: split months chronologically into two equal halves
  const mid = Math.floor(months.length / 2);
  const firstHalf = new Set(months.slice(0, mid));
  const secondHalf = new Set(months.slice(mid));

  const firstPerf = listingPerf.filter((lp) => firstHalf.has(lp.month));
  const secondPerf = listingPerf.filter((lp) => secondHalf.has(lp.month));

  const firstNet = firstPerf.reduce((s, lp) => s + lp.netRevenueMinor, 0);
  const secondNet = secondPerf.reduce((s, lp) => s + lp.netRevenueMinor, 0);
  const firstNights = firstPerf.reduce((s, lp) => s + lp.bookedNights, 0);
  const secondNights = secondPerf.reduce((s, lp) => s + lp.bookedNights, 0);
  const firstGross = firstPerf.reduce((s, lp) => s + lp.grossRevenueMinor, 0);
  const secondGross = secondPerf.reduce((s, lp) => s + lp.grossRevenueMinor, 0);
  const firstAdr = firstNights > 0 ? firstGross / firstNights : 0;
  const secondAdr = secondNights > 0 ? secondGross / secondNights : 0;

  const firstOccRows = data.views.all.occupancy.filter(
    (o) => o.currency === currency && firstHalf.has(o.month) && o.estimatedOccupancyRate !== null,
  );
  const secondOccRows = data.views.all.occupancy.filter(
    (o) =>
      o.currency === currency && secondHalf.has(o.month) && o.estimatedOccupancyRate !== null,
  );
  const firstAvgOcc =
    firstOccRows.length > 0
      ? firstOccRows.reduce((s, o) => s + o.estimatedOccupancyRate!, 0) / firstOccRows.length
      : 0;
  const secondAvgOcc =
    secondOccRows.length > 0
      ? secondOccRows.reduce((s, o) => s + o.estimatedOccupancyRate!, 0) / secondOccRows.length
      : 0;

  const deltaPct = (current: number, base: number) => (base !== 0 ? (current - base) / base : 0);

  const deltas = {
    revenue: deltaPct(secondNet, firstNet),
    occupancy: deltaPct(secondAvgOcc, firstAvgOcc),
    bookings: deltaPct(secondNights, firstNights),
    avgRate: deltaPct(secondAdr, firstAdr),
  };

  // Top movers: up to 5 listings with the largest net revenue delta between halves
  const listingIds = [...new Set(listingPerf.map((lp) => lp.listingId))];

  const movers = listingIds.map((listingId) => {
    const name =
      listingPerf.find((lp) => lp.listingId === listingId)?.listingName ?? listingId;
    const firstRev = firstPerf
      .filter((lp) => lp.listingId === listingId)
      .reduce((s, lp) => s + lp.netRevenueMinor, 0);
    const secondRev = secondPerf
      .filter((lp) => lp.listingId === listingId)
      .reduce((s, lp) => s + lp.netRevenueMinor, 0);
    const firstNts = firstPerf
      .filter((lp) => lp.listingId === listingId)
      .reduce((s, lp) => s + lp.bookedNights, 0);
    const secondNts = secondPerf
      .filter((lp) => lp.listingId === listingId)
      .reduce((s, lp) => s + lp.bookedNights, 0);

    return {
      listing: name,
      revenueDelta: (secondRev - firstRev) / 100, // convert to major currency units
      occupancyDelta: secondNts - firstNts,
    };
  });

  movers.sort((a, b) => Math.abs(b.revenueDelta) - Math.abs(a.revenueDelta));
  const topMovers = movers.slice(0, 5);

  // Warnings: import warnings + low-occupancy detection (~40% threshold = 12 nights/month)
  const warnings: string[] = data.warnings.map((w) => w.message);

  const lowOccupancyListings = listingIds.filter((id) => {
    const rows = listingPerf.filter((lp) => lp.listingId === id);
    if (rows.length === 0) return false;
    const avgNts = rows.reduce((s, lp) => s + lp.bookedNights, 0) / rows.length;
    return avgNts < 12;
  });

  if (lowOccupancyListings.length > 0) {
    const names = lowOccupancyListings
      .map((id) => listingPerf.find((lp) => lp.listingId === id)?.listingName ?? id)
      .join(", ");
    warnings.push(`${lowOccupancyListings.length} listing(s) below ~40% occupancy: ${names}`);
  }

  return {
    currency,
    dateRange,
    kpis: {
      totalRevenue: Math.round(totalNetMinor) / 100,
      avgNightlyRate: Math.round(avgNightlyRate * 100) / 100,
      occupancyRate: Math.round(avgOccupancy * 1000) / 1000,
      totalBookings,
      avgLengthOfStay,
    },
    deltas,
    topMovers,
    warnings,
  };
}
