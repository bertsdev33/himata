import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoneyCompact } from "@/lib/format";
import type { MonthlyPortfolioPerformance } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface SeasonalityHeatmapProps {
  data: MonthlyPortfolioPerformance[];
  currency: string;
  revenueBasis?: RevenueBasis;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEGEND_STEPS = [0, 0.15, 0.3, 0.5, 0.7, 0.85, 1];

/**
 * Alpha-based heatmap color using the --heatmap CSS variable.
 * Low values = transparent (blends into card background).
 * High values = fully saturated accent color.
 * Works correctly in both light and dark mode.
 */
function heatmapAlpha(ratio: number): number {
  // Use a slightly curved ramp so low values stay subtle
  return Math.round(Math.pow(ratio, 0.8) * 85) / 100;
}

export function SeasonalityHeatmap({ data, currency, revenueBasis = "net" }: SeasonalityHeatmapProps) {
  const { grid, years, minVal, maxVal } = useMemo(() => {
    const map = new Map<string, number>();
    for (const d of data) {
      const val = revenueBasis === "gross"
        ? d.grossRevenueMinor
        : d.netRevenueMinor;
      map.set(d.month, (map.get(d.month) ?? 0) + val);
    }

    const yearSet = new Set<string>();
    for (const key of map.keys()) {
      yearSet.add(key.slice(0, 4));
    }
    const sortedYears = [...yearSet].sort();

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

  const getRatio = (value: number | null): number => {
    if (value === null) return -1;
    const range = maxVal - minVal;
    if (range === 0) return 1;
    return (value - minVal) / range;
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
                    {row.map((val, i) => {
                      const ratio = getRatio(val);
                      const alpha = ratio >= 0 ? heatmapAlpha(ratio) : 0;
                      return (
                        <td key={i} className="px-1 py-1">
                          {val !== null ? (
                            <div
                              className={`rounded-md px-2 py-2 text-center text-xs font-medium transition-colors ${
                                alpha > 0.45 ? "text-white" : "text-foreground"
                              }`}
                              style={{ backgroundColor: `hsl(var(--heatmap) / ${alpha})` }}
                            >
                              {formatMoneyCompact(val, currency)}
                            </div>
                          ) : (
                            <div className="text-center text-xs text-muted-foreground py-2">
                              —
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Color legend */}
        <div className="flex items-center gap-2 mt-4 pt-3 border-t">
          <span className="text-xs text-muted-foreground">Low</span>
          <div className="flex gap-0.5">
            {LEGEND_STEPS.map((ratio) => (
              <div
                key={ratio}
                className="w-8 h-4 rounded-sm border border-border/30"
                style={{
                  backgroundColor: `hsl(var(--heatmap) / ${heatmapAlpha(ratio)})`,
                }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">High</span>
          <span className="text-xs text-muted-foreground ml-2">
            {formatMoneyCompact(minVal, currency)} — {formatMoneyCompact(maxVal, currency)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
