import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RevenueTrendChart } from "../RevenueTrendChart";
import { NightsVsAdrChart } from "../NightsVsAdrChart";
import { formatMoney, formatDeltaPercent } from "@/lib/format";
import {
  computeMonthlyPortfolioPerformance,
} from "@rental-analytics/core";
import type { MonthlyListingPerformance } from "@rental-analytics/core";
import type { RevenueBasis } from "@/app/types";

interface ListingDetailProps {
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  revenueBasis: RevenueBasis;
  projection: boolean;
}

export function ListingDetail({
  listingPerf,
  currency,
  revenueBasis,
  projection,
}: ListingDetailProps) {
  // Convert listing perf to portfolio perf for RevenueTrendChart
  const portfolioPerf = useMemo(
    () => computeMonthlyPortfolioPerformance(listingPerf),
    [listingPerf],
  );

  const listingName = listingPerf.length > 0 ? listingPerf[0].listingName : "Listing";

  // Under/Over indicator
  const indicator = useMemo(() => {
    const months = [...new Set(listingPerf.map((lp) => lp.month))].sort();
    if (months.length < 2) return null;

    const isNet = revenueBasis === "net";
    const currentMonth = months[months.length - 1];
    const previousMonths = months.slice(0, -1);

    const currentVal = listingPerf
      .filter((lp) => lp.month === currentMonth)
      .reduce((s, lp) => s + (isNet ? lp.netRevenueMinor : lp.grossRevenueMinor), 0);

    const trailingVals = previousMonths.map((m) =>
      listingPerf
        .filter((lp) => lp.month === m)
        .reduce((s, lp) => s + (isNet ? lp.netRevenueMinor : lp.grossRevenueMinor), 0),
    );
    const trailingAvg = trailingVals.reduce((a, b) => a + b, 0) / trailingVals.length;

    if (trailingAvg === 0) return null;

    const delta = (currentVal - trailingAvg) / trailingAvg;
    return {
      currentVal,
      trailingAvg,
      delta,
      isOver: delta >= 0,
    };
  }, [listingPerf, revenueBasis]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">{listingName}</h2>

      <RevenueTrendChart
        data={portfolioPerf}
        currency={currency}
        revenueBasis={revenueBasis}
        projection={projection}
      />

      <NightsVsAdrChart data={listingPerf} currency={currency} />

      {indicator && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Performance vs Trailing Average</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div
                className={`rounded-lg px-4 py-3 text-center ${
                  indicator.isOver
                    ? "bg-green-50 border border-green-200"
                    : "bg-red-50 border border-red-200"
                }`}
              >
                <p
                  className={`text-2xl font-bold ${
                    indicator.isOver ? "text-green-700" : "text-red-700"
                  }`}
                >
                  {formatDeltaPercent(indicator.delta)}
                </p>
                <p
                  className={`text-sm font-medium ${
                    indicator.isOver ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {indicator.isOver ? "Outperforming" : "Underperforming"}
                </p>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>
                  Current: {formatMoney(indicator.currentVal, currency)}
                </p>
                <p>
                  Trailing Avg: {formatMoney(Math.round(indicator.trailingAvg), currency)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
