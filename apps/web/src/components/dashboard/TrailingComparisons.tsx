import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney, formatDeltaPercent, formatMonth } from "@/lib/format";
import type { TrailingComparison, YearMonth } from "@rental-analytics/core";

interface TrailingComparisonsProps {
  data: TrailingComparison[];
  currency: string;
}

export function TrailingComparisons({ data, currency }: TrailingComparisonsProps) {
  if (data.length === 0) return null;

  // Show comparisons for the latest month only
  const latestMonth = data.reduce((max, d) => (d.month > max ? d.month : max), data[0].month);
  const latestData = data.filter((d) => d.month === latestMonth);

  if (latestData.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Trailing Comparisons — {formatMonth(latestMonth as YearMonth)}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {latestData.map((d, i) => {
            const metricLabel = d.metric === "netRevenueMinor" ? "Net Revenue" : "Gross Revenue";
            const isPositive = d.deltaMinor >= 0;
            return (
              <div key={i} className="rounded-md border p-4">
                <p className="text-sm text-muted-foreground">{metricLabel}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{d.label}</p>
                <div className="mt-2 flex items-baseline gap-3">
                  <span className="text-lg font-semibold">
                    {formatMoney(d.currentMinor, currency)}
                  </span>
                  <span
                    className={`text-sm font-medium ${isPositive ? "text-green-600" : "text-red-600"}`}
                  >
                    {formatDeltaPercent(d.deltaPct)}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Baseline: {formatMoney(d.baselineMinor, currency)}
                </p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
