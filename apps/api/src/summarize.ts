/** Compact analytics summary sent from the browser to the Worker. */
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
