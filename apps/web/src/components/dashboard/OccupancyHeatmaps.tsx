import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatPercent } from "@/lib/format";
import type { CanonicalTransaction } from "@rental-analytics/core";

interface OccupancyHeatmapsProps {
  transactions: CanonicalTransaction[];
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DOM_LABELS = Array.from({ length: 31 }, (_, i) => i + 1);

/**
 * Enumerate all occupied dates from a stay window (checkIn inclusive, checkOut exclusive).
 */
function enumerateStayDates(checkIn: string, checkOut: string): Date[] {
  const dates: Date[] = [];
  const start = new Date(checkIn + "T12:00:00"); // noon to avoid DST issues
  const end = new Date(checkOut + "T12:00:00");
  const current = new Date(start);
  while (current < end) {
    dates.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

interface HeatmapData {
  dowCounts: number[]; // 7 entries (Mon=0..Sun=6)
  dowTotals: number[]; // total possible days per DOW
  domCounts: number[]; // 31 entries (day 1..31)
  domTotals: number[]; // total possible days per DOM
  listingCount: number;
}

function computeHeatmapData(transactions: CanonicalTransaction[]): HeatmapData {
  const stayTxs = transactions.filter((tx) => tx.stay && tx.kind === "reservation");
  const listingIds = new Set(stayTxs.map((tx) => tx.listing?.listingId).filter(Boolean));
  const listingCount = listingIds.size || 1;

  // Count occupied nights by DOW and DOM
  const dowCounts = new Array(7).fill(0);
  const domCounts = new Array(31).fill(0);
  const seenDates = new Set<string>(); // deduplicate by listing+date

  for (const tx of stayTxs) {
    if (!tx.stay) continue;
    const listingId = tx.listing?.listingId ?? "unknown";
    const dates = enumerateStayDates(tx.stay.checkInDate, tx.stay.checkOutDate);
    for (const d of dates) {
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const key = `${listingId}:${yyyy}-${mm}-${dd}`;
      if (seenDates.has(key)) continue;
      seenDates.add(key);

      // JS getDay: 0=Sun, 1=Mon... Convert to Mon=0..Sun=6
      const jsDay = d.getDay();
      const dowIdx = jsDay === 0 ? 6 : jsDay - 1;
      dowCounts[dowIdx]++;

      const dom = d.getDate();
      domCounts[dom - 1]++;
    }
  }

  // Compute total possible days in the date range per DOW and DOM
  // Find min/max dates across all stays
  let minDate: Date | null = null;
  let maxDate: Date | null = null;
  for (const tx of stayTxs) {
    if (!tx.stay) continue;
    const ci = new Date(tx.stay.checkInDate + "T12:00:00");
    const co = new Date(tx.stay.checkOutDate + "T12:00:00");
    if (!minDate || ci < minDate) minDate = ci;
    if (!maxDate || co > maxDate) maxDate = co;
  }

  const dowTotals = new Array(7).fill(0);
  const domTotals = new Array(31).fill(0);

  if (minDate && maxDate) {
    const cursor = new Date(minDate);
    while (cursor < maxDate) {
      const jsDay = cursor.getDay();
      const dowIdx = jsDay === 0 ? 6 : jsDay - 1;
      dowTotals[dowIdx]++;
      domTotals[cursor.getDate() - 1]++;
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  // Scale totals by listing count
  for (let i = 0; i < 7; i++) dowTotals[i] *= listingCount;
  for (let i = 0; i < 31; i++) domTotals[i] *= listingCount;

  return { dowCounts, dowTotals, domCounts, domTotals, listingCount };
}

function getOccupancyColor(rate: number | null): string {
  if (rate === null) return "transparent";
  // Interpolate from dim teal to bright teal
  const ratio = Math.min(rate, 1);
  const sat = 30 + ratio * 36;
  const light = 25 + ratio * 25;
  return `hsl(172, ${sat}%, ${light}%)`;
}

export function OccupancyHeatmaps({ transactions }: OccupancyHeatmapsProps) {
  const data = useMemo(() => computeHeatmapData(transactions), [transactions]);

  const dowRates = data.dowCounts.map((count, i) =>
    data.dowTotals[i] > 0 ? count / data.dowTotals[i] : null,
  );

  const domRates = data.domCounts.map((count, i) =>
    data.domTotals[i] > 0 ? count / data.domTotals[i] : null,
  );

  const hasData = data.dowCounts.some((c) => c > 0);
  if (!hasData) return null;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
      {/* Day-of-Week Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Occupancy by Day of Week</CardTitle>
          <CardDescription>Estimated occupancy rate per weekday</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            {DOW_LABELS.map((label, i) => {
              const rate = dowRates[i];
              return (
                <div key={label} className="flex-1 text-center">
                  <div className="text-xs text-muted-foreground mb-1">{label}</div>
                  <div
                    className="rounded-md py-3 text-xs font-medium text-white"
                    style={{ backgroundColor: getOccupancyColor(rate) }}
                  >
                    {formatPercent(rate)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Day-of-Month Heatmap */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Occupancy by Day of Month</CardTitle>
          <CardDescription>Estimated occupancy rate per calendar day</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1">
            {DOM_LABELS.map((day, i) => {
              const rate = domRates[i];
              return (
                <div key={day} className="text-center">
                  <div className="text-[10px] text-muted-foreground mb-0.5">{day}</div>
                  <div
                    className="rounded py-1.5 text-[10px] font-medium text-white"
                    style={{ backgroundColor: getOccupancyColor(rate) }}
                  >
                    {formatPercent(rate)}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
