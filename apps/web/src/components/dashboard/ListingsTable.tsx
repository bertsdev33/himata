import { useState, useMemo } from "react";
import { ArrowUpDown, Eye } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatMoney, formatPercent, formatDeltaPercent } from "@/lib/format";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

interface ListingsTableProps {
  data: MonthlyListingPerformance[];
  currency: string;
  onSelectListing?: (listingId: string) => void;
}

type SortKey =
  | "listingName"
  | "accountId"
  | "bookedNights"
  | "grossRevenue"
  | "netRevenue"
  | "adr"
  | "serviceFees"
  | "occupancy"
  | "vsTrailing"
  | "portfolioShare";

interface ListingSummary {
  listingId: string;
  listingName: string;
  accountId: string;
  bookedNights: number;
  grossRevenue: number;
  netRevenue: number;
  serviceFees: number;
  adr: number;
  occupancy: number | null;
  vsTrailing: number | null;
  portfolioShare: number;
}

export function ListingsTable({ data, currency, onSelectListing }: ListingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("netRevenue");
  const [sortAsc, setSortAsc] = useState(false);

  const summaries = useMemo(() => {
    const map = new Map<string, ListingSummary>();
    let totalPortfolioNet = 0;

    // Compute trailing averages per listing
    const monthsByListing = new Map<string, Map<string, number>>();

    for (const lp of data) {
      const existing = map.get(lp.listingId);
      if (existing) {
        existing.bookedNights += lp.bookedNights;
        existing.grossRevenue += lp.grossRevenueMinor;
        existing.netRevenue += lp.netRevenueMinor;
        existing.serviceFees += lp.serviceFeesMinor;
      } else {
        map.set(lp.listingId, {
          listingId: lp.listingId,
          listingName: lp.listingName,
          accountId: lp.accountId,
          bookedNights: lp.bookedNights,
          grossRevenue: lp.grossRevenueMinor,
          netRevenue: lp.netRevenueMinor,
          serviceFees: lp.serviceFeesMinor,
          adr: 0,
          occupancy: null,
          vsTrailing: null,
          portfolioShare: 0,
        });
      }
      totalPortfolioNet += lp.netRevenueMinor;

      // Track monthly revenue for trailing calc
      if (!monthsByListing.has(lp.listingId)) {
        monthsByListing.set(lp.listingId, new Map());
      }
      const monthMap = monthsByListing.get(lp.listingId)!;
      monthMap.set(lp.month, (monthMap.get(lp.month) ?? 0) + lp.netRevenueMinor);
    }

    for (const s of map.values()) {
      s.adr = s.bookedNights > 0 ? Math.round(s.grossRevenue / s.bookedNights) : 0;
      s.portfolioShare = totalPortfolioNet > 0 ? s.netRevenue / totalPortfolioNet : 0;

      // Compute % vs trailing average
      const months = monthsByListing.get(s.listingId);
      if (months && months.size >= 2) {
        const sortedMonths = [...months.entries()].sort(([a], [b]) => a.localeCompare(b));
        const currentVal = sortedMonths[sortedMonths.length - 1][1];
        const trailingVals = sortedMonths.slice(0, -1).map(([, v]) => v);
        const trailingAvg = trailingVals.reduce((a, b) => a + b, 0) / trailingVals.length;
        s.vsTrailing = trailingAvg !== 0 ? (currentVal - trailingAvg) / trailingAvg : null;
      }
    }

    return [...map.values()];
  }, [data]);

  const sorted = useMemo(() => {
    const copy = [...summaries];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "listingName":
          cmp = a.listingName.localeCompare(b.listingName);
          break;
        case "accountId":
          cmp = a.accountId.localeCompare(b.accountId);
          break;
        case "bookedNights":
          cmp = a.bookedNights - b.bookedNights;
          break;
        case "grossRevenue":
          cmp = a.grossRevenue - b.grossRevenue;
          break;
        case "netRevenue":
          cmp = a.netRevenue - b.netRevenue;
          break;
        case "adr":
          cmp = a.adr - b.adr;
          break;
        case "serviceFees":
          cmp = a.serviceFees - b.serviceFees;
          break;
        case "occupancy":
          cmp = (a.occupancy ?? -1) - (b.occupancy ?? -1);
          break;
        case "vsTrailing":
          cmp = (a.vsTrailing ?? -999) - (b.vsTrailing ?? -999);
          break;
        case "portfolioShare":
          cmp = a.portfolioShare - b.portfolioShare;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [summaries, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none"
      onClick={() => toggleSort(col)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        <ArrowUpDown className="h-3 w-3" />
      </span>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Listings Performance</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label="Listing" col="listingName" />
              <SortHeader label="Account" col="accountId" />
              <SortHeader label="Nights" col="bookedNights" />
              <SortHeader label="Gross Revenue" col="grossRevenue" />
              <SortHeader label="Net Revenue" col="netRevenue" />
              <SortHeader label="ADR" col="adr" />
              <SortHeader label="vs Trailing" col="vsTrailing" />
              <SortHeader label="Share" col="portfolioShare" />
              {onSelectListing && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <TableRow key={s.listingId}>
                <TableCell className="font-medium max-w-[250px] truncate">
                  {s.listingName}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {s.accountId}
                  </Badge>
                </TableCell>
                <TableCell>{s.bookedNights}</TableCell>
                <TableCell>{formatMoney(s.grossRevenue, currency)}</TableCell>
                <TableCell>{formatMoney(s.netRevenue, currency)}</TableCell>
                <TableCell>{formatMoney(s.adr, currency)}</TableCell>
                <TableCell>
                  {s.vsTrailing !== null ? (
                    <span className={s.vsTrailing >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatDeltaPercent(s.vsTrailing)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{formatPercent(s.portfolioShare)}</TableCell>
                {onSelectListing && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectListing(s.listingId)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
