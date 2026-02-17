import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CHART_COLORS } from "@/lib/chart-colors";
import { formatMonth, formatMoneyCompact } from "@/lib/format";
import { AlertTriangle } from "lucide-react";
import type { MonthlyPortfolioPerformance, MonthlyListingPerformance, YearMonth } from "@rental-analytics/core";

interface ForecastTabProps {
  portfolioPerf: MonthlyPortfolioPerformance[];
  listingPerf: MonthlyListingPerformance[];
  currency: string;
}

export function ForecastTab({ portfolioPerf, listingPerf, currency }: ForecastTabProps) {
  const revenueData = useMemo(
    () =>
      [...portfolioPerf]
        .sort((a, b) => a.month.localeCompare(b.month))
        .map((d) => ({
          label: formatMonth(d.month as YearMonth),
          revenue: d.netRevenueMinor / 100,
        })),
    [portfolioPerf],
  );

  const nightsData = useMemo(() => {
    const monthMap = new Map<string, number>();
    for (const lp of listingPerf) {
      monthMap.set(lp.month, (monthMap.get(lp.month) ?? 0) + lp.bookedNights);
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, nights]) => ({
        label: formatMonth(month as YearMonth),
        nights,
      }));
  }, [listingPerf]);

  return (
    <div className="space-y-6">
      <Alert className="border-yellow-200 bg-yellow-50">
        <AlertTriangle className="h-4 w-4 text-yellow-600" />
        <AlertDescription className="text-yellow-800">
          Forecast data is based on upcoming/unfulfilled reservations and is subject to change.
        </AlertDescription>
      </Alert>

      {revenueData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Forward Revenue Projection</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis
                  tickFormatter={(v) => formatMoneyCompact(v * 100, currency)}
                  className="text-xs"
                />
                <Tooltip
                  formatter={(value: number) =>
                    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(value)
                  }
                />
                <Bar
                  dataKey="revenue"
                  name="Net Revenue"
                  fill={CHART_COLORS.forecast}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {nightsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming Nights by Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={nightsData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="label" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar
                  dataKey="nights"
                  name="Booked Nights"
                  fill={CHART_COLORS.gross}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
