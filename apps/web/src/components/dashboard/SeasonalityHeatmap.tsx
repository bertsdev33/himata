import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoneyCompact } from "@/lib/format";
import type { MonthlyPortfolioPerformance } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface SeasonalityHeatmapProps {
  data: MonthlyPortfolioPerformance[];
  currency: string;
  revenueBasis: RevenueBasis;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function SeasonalityHeatmap({ data, currency, revenueBasis }: SeasonalityHeatmapProps) {
  const { grid, years, minVal, maxVal } = useMemo(() => {
    // Build year-month grid
    const map = new Map<string, number>(); // "YYYY-MM" -> revenue
    for (const d of data) {
      const val = revenueBasis === "gross"
        ? d.grossRevenueMinor
        : d.netRevenueMinor; // "both" and "net" both default to net for heatmap
      map.set(d.month, (map.get(d.month) ?? 0) + val);
    }

    const yearSet = new Set<string>();
    for (const key of map.keys()) {
      yearSet.add(key.slice(0, 4));
    }
    const sortedYears = [...yearSet].sort();

    // Build grid: years x 12 months
    const grid = new Map<string, (number | null)[]>();
    let min = Infinity;
    let max = -Infinity;

    for (const year of sortedYears) {
      const row: (number | null)[] = [];
      for (let m = 1; m <= 12; m++) {
        const key = `${year}-${String(m).padStart(2, "0")}`;
        const val = map.get(key) ?? null;
        row.push(val);
        if (val !== null) {
          if (val < min) min = val;
          if (val > max) max = val;
        }
      }
      grid.set(year, row);
    }

    return { grid, years: sortedYears, minVal: min === Infinity ? 0 : min, maxVal: max === -Infinity ? 0 : max };
  }, [data, revenueBasis]);

  if (years.length === 0) return null;

  // Color interpolation: low (dim teal) to high (bright teal)
  const getColor = (value: number | null): string => {
    if (value === null) return "transparent";
    const range = maxVal - minVal;
    if (range === 0) return "hsl(172, 66%, 40%)";
    const ratio = (value - minVal) / range;
    // Interpolate from hsl(172, 30%, 25%) to hsl(172, 66%, 50%)
    const sat = 30 + ratio * 36;
    const light = 25 + ratio * 25;
    return `hsl(172, ${sat}%, ${light}%)`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Seasonality Heatmap</CardTitle>
        <CardDescription>Revenue intensity by month across years</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left text-xs text-muted-foreground font-medium pb-2 pr-4">Year</th>
                {MONTH_LABELS.map((m) => (
                  <th key={m} className="text-center text-xs text-muted-foreground font-medium pb-2 px-1 min-w-[60px]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {years.map((year) => {
                const row = grid.get(year)!;
                return (
                  <tr key={year}>
                    <td className="font-semibold text-sm pr-4 py-1">{year}</td>
                    {row.map((val, i) => (
                      <td key={i} className="px-1 py-1">
                        {val !== null ? (
                          <div
                            className="rounded-md px-2 py-2 text-center text-xs font-medium text-white"
                            style={{ backgroundColor: getColor(val) }}
                          >
                            {formatMoneyCompact(val, currency)}
                          </div>
                        ) : (
                          <div className="text-center text-xs text-muted-foreground py-2">
                            —
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
