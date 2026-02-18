import { useState, useMemo } from "react";
import { useSettingsContext } from "@/app/settings-context";
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
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
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
  const { getListingName, getAccountName } = useSettingsContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  const [sortKey, setSortKey] = useState<SortKey>("netRevenue");
  const [sortAsc, setSortAsc] = useState(false);

  const summaries = useMemo(() => {
    const map = new Map<string, ListingSummary>();
    let totalPortfolioNet = 0;

    // Compute trailing averages per listing
    const monthsByListing = new Map<string, Map<string, number>>();
    // Track booked nights per (listingId, month) for occupancy — avoids double-counting
    // when multiple MonthlyListingPerformance records exist for the same listing+month
    const nightsByListingMonth = new Map<string, Map<string, number>>();

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

      // Accumulate nights per (listing, month)
      if (!nightsByListingMonth.has(lp.listingId)) {
        nightsByListingMonth.set(lp.listingId, new Map());
      }
      const nlm = nightsByListingMonth.get(lp.listingId)!;
      nlm.set(lp.month, (nlm.get(lp.month) ?? 0) + lp.bookedNights);
    }

    for (const s of map.values()) {
      s.adr = s.bookedNights > 0 ? Math.round(s.grossRevenue / s.bookedNights) : 0;
      s.portfolioShare = totalPortfolioNet > 0 ? s.netRevenue / totalPortfolioNet : 0;

      // Compute estimated occupancy per (listing, month), capping each month
      // at its calendar day count so overlapping/duplicate transactions can't
      // push occupancy above 100%. Only include months with actual booked nights
      // in the denominator — adjustment-only months (0 nights) shouldn't dilute.
      const nightsMap = nightsByListingMonth.get(s.listingId);
      if (nightsMap && nightsMap.size > 0) {
        let cappedNights = 0;
        let totalDays = 0;
        for (const [ym, nights] of nightsMap) {
          if (nights <= 0) continue;
          const [y, m] = ym.split("-").map(Number);
          const dim = new Date(y, m, 0).getDate();
          totalDays += dim;
          cappedNights += Math.min(nights, dim);
        }
        s.occupancy = totalDays > 0 ? cappedNights / totalDays : null;
      }

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
        <CardTitle className="text-base">{t("listings_table.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label={t("listings_table.columns.listing")} col="listingName" />
              <SortHeader label={t("listings_table.columns.account")} col="accountId" />
              <SortHeader label={t("listings_table.columns.nights")} col="bookedNights" />
              <SortHeader label={t("listings_table.columns.gross_revenue")} col="grossRevenue" />
              <SortHeader label={t("listings_table.columns.net_revenue")} col="netRevenue" />
              <SortHeader label={t("listings_table.columns.adr")} col="adr" />
              <SortHeader label={t("listings_table.columns.occupancy")} col="occupancy" />
              <SortHeader label={t("listings_table.columns.vs_trailing")} col="vsTrailing" />
              <SortHeader label={t("listings_table.columns.share")} col="portfolioShare" />
              {onSelectListing && <TableHead />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((s) => (
              <TableRow key={s.listingId}>
                <TableCell className="font-medium max-w-[250px] truncate">
                  {getListingName(s.listingId, s.listingName)}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-xs">
                    {getAccountName(s.accountId)}
                  </Badge>
                </TableCell>
                <TableCell>{s.bookedNights}</TableCell>
                <TableCell>{formatMoney(s.grossRevenue, currency, locale)}</TableCell>
                <TableCell>{formatMoney(s.netRevenue, currency, locale)}</TableCell>
                <TableCell>{formatMoney(s.adr, currency, locale)}</TableCell>
                <TableCell>
                  {s.occupancy !== null ? (
                    formatPercent(s.occupancy, locale)
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>
                  {s.vsTrailing !== null ? (
                    <span className={s.vsTrailing >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatDeltaPercent(s.vsTrailing, locale)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </TableCell>
                <TableCell>{formatPercent(s.portfolioShare, locale)}</TableCell>
                {onSelectListing && (
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onSelectListing(s.listingId)}
                      aria-label={t("listings_table.actions.view_listing")}
                      title={t("listings_table.actions.view_listing")}
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
