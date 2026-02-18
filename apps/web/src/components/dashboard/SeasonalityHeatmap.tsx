import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatMoneyCompact } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { MonthlyPortfolioPerformance } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface SeasonalityHeatmapProps {
  data: MonthlyPortfolioPerformance[];
  currency: string;
  revenueBasis?: RevenueBasis;
}

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const LEGEND_STEPS = [0, 0.1, 0.2, 0.35, 0.5, 0.65, 0.8, 1];

/**
 * Heatmap background style using HSL lightness interpolation.
 * Hue 180, saturation 75% fixed. Lightness interpolated via CSS calc()
 * between --hm-l-0 (ratio=0, blends with card bg) and --hm-l-1 (ratio=1).
 * Light mode: 92% → 14%  |  Dark mode: 10% → 67%
 */
function heatmapBg(ratio: number): string {
  const r = Math.min(Math.max(ratio, 0), 1);
  return `hsl(180 75% calc(var(--hm-l-0) * ${+(1 - r).toFixed(4)} * 1% + var(--hm-l-1) * ${+r.toFixed(4)} * 1%))`;
}

/** Text class: white on dark cells, dark on light cells, adapts to dark mode */
function heatmapText(ratio: number): string {
  return ratio > 0.45 ? "text-white dark:text-gray-900" : "text-foreground";
}

export function SeasonalityHeatmap({ data, currency, revenueBasis = "net" }: SeasonalityHeatmapProps) {
  const { locale } = useLocaleContext();
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
                      return (
                        <td key={i} className="px-1 py-1">
                          {val !== null && ratio >= 0 ? (
                            <div
                              className={`rounded-md px-2 py-2 text-center text-xs font-medium transition-all duration-150 cursor-default hover:ring-2 hover:ring-foreground/25 hover:brightness-110 hover:scale-[1.04] ${heatmapText(ratio)}`}
                              style={{ backgroundColor: heatmapBg(ratio) }}
                            >
                              {formatMoneyCompact(val, currency, locale)}
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
                style={{ backgroundColor: heatmapBg(ratio) }}
              />
            ))}
          </div>
          <span className="text-xs text-muted-foreground">High</span>
          <span className="text-xs text-muted-foreground ml-2">
            {formatMoneyCompact(minVal, currency, locale)} — {formatMoneyCompact(maxVal, currency, locale)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
