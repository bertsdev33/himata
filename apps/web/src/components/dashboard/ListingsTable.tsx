import { useState, useMemo } from "react";
import { ArrowUpDown } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import type { MonthlyListingPerformance } from "@rental-analytics/core";

interface ListingsTableProps {
  data: MonthlyListingPerformance[];
  currency: string;
}

type SortKey = "listingName" | "bookedNights" | "grossRevenue" | "netRevenue" | "adr" | "serviceFees";

interface ListingSummary {
  listingId: string;
  listingName: string;
  bookedNights: number;
  grossRevenue: number;
  netRevenue: number;
  serviceFees: number;
  adr: number;
}

export function ListingsTable({ data, currency }: ListingsTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("netRevenue");
  const [sortAsc, setSortAsc] = useState(false);

  const summaries = useMemo(() => {
    const map = new Map<string, ListingSummary>();
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
          bookedNights: lp.bookedNights,
          grossRevenue: lp.grossRevenueMinor,
          netRevenue: lp.netRevenueMinor,
          serviceFees: lp.serviceFeesMinor,
          adr: 0,
        });
      }
    }
    // Compute ADR
    for (const s of map.values()) {
      s.adr = s.bookedNights > 0 ? Math.round(s.grossRevenue / s.bookedNights) : 0;
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
              <SortHeader label="Nights" col="bookedNights" />
              <SortHeader label="Gross Revenue" col="grossRevenue" />
              <SortHeader label="Net Revenue" col="netRevenue" />
              <SortHeader label="ADR" col="adr" />
              <SortHeader label="Service Fees" col="serviceFees" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <TableRow key={s.listingId}>
                <TableCell className="font-medium max-w-[300px] truncate">
                  {s.listingName}
                </TableCell>
                <TableCell>{s.bookedNights}</TableCell>
                <TableCell>{formatMoney(s.grossRevenue, currency)}</TableCell>
                <TableCell>{formatMoney(s.netRevenue, currency)}</TableCell>
                <TableCell>{formatMoney(s.adr, currency)}</TableCell>
                <TableCell>{formatMoney(s.serviceFees, currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
