import { useMemo } from "react";
import { useSettingsContext } from "@/app/settings-context";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatMoney, formatDeltaPercent } from "@/lib/format";
import { projectMonthValue } from "@/lib/dashboard-utils";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

interface TopMoversTableProps {
  listingPerf: MonthlyListingPerformance[];
  currency: string;
  projection?: boolean;
}

interface MoverRow {
  listingId: string;
  listingName: string;
  currentRevenue: number;
  previousRevenue: number;
  momDelta: number;
  momDeltaPct: number | null;
  nightsDelta: number;
  adrDelta: number;
}

export function TopMoversTable({ listingPerf, currency, projection = false }: TopMoversTableProps) {
  const { getListingName } = useSettingsContext();
  const { locale } = useLocaleContext();

  const movers = useMemo(() => {
    if (listingPerf.length === 0) return [];

    const months = [...new Set(listingPerf.map((lp) => lp.month))].sort();
    if (months.length < 2) return [];

    // Determine if the last month is the current (incomplete) month
    const now = new Date();
    const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const lastMonth = months[months.length - 1];
    const isLastMonthCurrent = lastMonth === currentYm;

    let compareMonth: string;
    let previousMonth: string;

    if (isLastMonthCurrent && !projection) {
      // Exclude current incomplete month, compare the two before it
      if (months.length < 3) return [];
      compareMonth = months[months.length - 2];
      previousMonth = months[months.length - 3];
    } else {
      // Use last two months (project current if enabled)
      compareMonth = lastMonth;
      previousMonth = months[months.length - 2];
    }

    const shouldProject = isLastMonthCurrent && projection && compareMonth === lastMonth;

    // Aggregate by listing for each month
    const byListing = new Map<
      string,
      {
        listingName: string;
        current: { net: number; nights: number; gross: number };
        previous: { net: number; nights: number; gross: number };
      }
    >();

    for (const lp of listingPerf) {
      if (lp.month !== compareMonth && lp.month !== previousMonth) continue;
      const existing = byListing.get(lp.listingId) ?? {
        listingName: lp.listingName,
        current: { net: 0, nights: 0, gross: 0 },
        previous: { net: 0, nights: 0, gross: 0 },
      };

      const bucket = lp.month === compareMonth ? existing.current : existing.previous;
      bucket.net += lp.netRevenueMinor;
      bucket.nights += lp.bookedNights;
      bucket.gross += lp.grossRevenueMinor;
      byListing.set(lp.listingId, existing);
    }

    const rows: MoverRow[] = [];
    for (const [listingId, data] of byListing) {
      const currentNet = shouldProject ? projectMonthValue(data.current.net, compareMonth) : data.current.net;
      const currentGross = shouldProject ? projectMonthValue(data.current.gross, compareMonth) : data.current.gross;
      const currentNights = shouldProject ? projectMonthValue(data.current.nights, compareMonth) : data.current.nights;

      const momDelta = currentNet - data.previous.net;
      const currentAdr = currentNights > 0 ? currentGross / currentNights : 0;
      const previousAdr = data.previous.nights > 0 ? data.previous.gross / data.previous.nights : 0;

      rows.push({
        listingId,
        listingName: data.listingName,
        currentRevenue: currentNet,
        previousRevenue: data.previous.net,
        momDelta,
        momDeltaPct: data.previous.net !== 0 ? momDelta / data.previous.net : null,
        nightsDelta: currentNights - data.previous.nights,
        adrDelta: Math.round(currentAdr - previousAdr),
      });
    }

    rows.sort((a, b) => Math.abs(b.momDelta) - Math.abs(a.momDelta));
    return rows.slice(0, 10);
  }, [listingPerf, projection]);

  if (movers.length === 0) return null;

  // Determine label based on which months are being compared
  const now = new Date();
  const currentYm = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const months = [...new Set(listingPerf.map((lp) => lp.month))].sort();
  const lastMonth = months[months.length - 1] ?? "";
  const isProjected = lastMonth === currentYm && projection;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Top Movers (MoM)</CardTitle>
        {isProjected && (
          <CardDescription className="text-xs text-yellow-600">
            Current month values are projected based on pace so far
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Listing</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Previous</TableHead>
              <TableHead className="text-right">Delta</TableHead>
              <TableHead className="text-right">%</TableHead>
              <TableHead className="text-right">Nights</TableHead>
              <TableHead className="text-right">ADR</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movers.map((m) => {
              const deltaColor = m.momDelta >= 0 ? "text-green-600" : "text-red-600";
              return (
                <TableRow key={m.listingId}>
                  <TableCell className="font-medium max-w-[200px] truncate">
                    {getListingName(m.listingId, m.listingName)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(m.currentRevenue, currency, locale)}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatMoney(m.previousRevenue, currency, locale)}
                  </TableCell>
                  <TableCell className={`text-right font-medium ${deltaColor}`}>
                    {m.momDelta >= 0 ? "+" : ""}
                    {formatMoney(m.momDelta, currency, locale)}
                  </TableCell>
                  <TableCell className={`text-right ${deltaColor}`}>
                    {formatDeltaPercent(m.momDeltaPct, locale)}
                  </TableCell>
                  <TableCell className={`text-right ${m.nightsDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {m.nightsDelta >= 0 ? "+" : ""}
                    {m.nightsDelta}
                  </TableCell>
                  <TableCell className={`text-right ${m.adrDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {m.adrDelta >= 0 ? "+" : ""}
                    {formatMoney(m.adrDelta, currency, locale)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
