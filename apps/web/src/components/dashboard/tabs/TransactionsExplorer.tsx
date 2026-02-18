import { useState, useMemo, useEffect } from "react";
import { useSettingsContext } from "@/app/settings-context";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import { useTranslation } from "react-i18next";
import type { CanonicalTransaction } from "@rental-analytics/core";

interface TransactionsExplorerProps {
  transactions: CanonicalTransaction[];
  currency: string;
}

type SortKey = "date" | "kind" | "accountId" | "listingName" | "nights" | "netAmount" | "grossAmount";

const PAGE_SIZE = 25;

export function TransactionsExplorer({ transactions, currency }: TransactionsExplorerProps) {
  const { getListingName, getAccountName } = useSettingsContext();
  const { locale } = useLocaleContext();
  const { t } = useTranslation("dashboard", { lng: locale });
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const getKindLabel = (kind: string) =>
    t(`transactions.kinds.${kind}`, {
      defaultValue: kind.replace(/_/g, " "),
    });

  useEffect(() => {
    setPage(0);
  }, [transactions]);

  const filtered = useMemo(() => {
    if (!search) return transactions;
    const q = search.toLowerCase();
    return transactions.filter((tx) => {
      const name = tx.listing?.listingName?.toLowerCase() ?? "";
      const account = tx.listing?.accountId?.toLowerCase() ?? "";
      const kindRaw = tx.kind.toLowerCase();
      const kindLabel = getKindLabel(tx.kind).toLowerCase();
      return name.includes(q) || account.includes(q) || kindRaw.includes(q) || kindLabel.includes(q);
    });
  }, [transactions, search, t]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    copy.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "date":
          cmp = a.occurredDate.localeCompare(b.occurredDate);
          break;
        case "kind":
          cmp = a.kind.localeCompare(b.kind);
          break;
        case "accountId":
          cmp = (a.listing?.accountId ?? "").localeCompare(b.listing?.accountId ?? "");
          break;
        case "listingName":
          cmp = (a.listing?.listingName ?? "").localeCompare(b.listing?.listingName ?? "");
          break;
        case "nights":
          cmp = (a.stay?.nights ?? 0) - (b.stay?.nights ?? 0);
          break;
        case "netAmount":
          cmp = a.netAmount.amountMinor - b.netAmount.amountMinor;
          break;
        case "grossAmount":
          cmp = a.grossAmount.amountMinor - b.grossAmount.amountMinor;
          break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [filtered, sortKey, sortAsc]);

  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
    setPage(0);
  };

  const SortHeader = ({ label, col }: { label: string; col: SortKey }) => (
    <TableHead
      className="cursor-pointer select-none whitespace-nowrap"
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
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">
          {t("transactions.title", { count: filtered.length })}
        </CardTitle>
        <Input
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          placeholder={t("transactions.search_placeholder")}
          className="w-72"
        />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <SortHeader label={t("transactions.columns.date")} col="date" />
              <SortHeader label={t("transactions.columns.type")} col="kind" />
              <SortHeader label={t("transactions.columns.account")} col="accountId" />
              <SortHeader label={t("transactions.columns.listing")} col="listingName" />
              <SortHeader label={t("transactions.columns.nights")} col="nights" />
              <SortHeader label={t("transactions.columns.net")} col="netAmount" />
              <SortHeader label={t("transactions.columns.gross")} col="grossAmount" />
              <TableHead className="whitespace-nowrap">{t("transactions.columns.service_fee")}</TableHead>
              <TableHead className="whitespace-nowrap">{t("transactions.columns.cleaning")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pageData.map((tx, i) => (
              <TableRow key={`${tx.transactionId}-${i}`}>
                <TableCell className="whitespace-nowrap">{tx.occurredDate}</TableCell>
                <TableCell className="text-xs capitalize">
                  {getKindLabel(tx.kind)}
                </TableCell>
                <TableCell className="text-xs">{tx.listing ? getAccountName(tx.listing.accountId) : "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">
                  {tx.listing ? getListingName(tx.listing.listingId, tx.listing.listingName) : "—"}
                </TableCell>
                <TableCell>{tx.stay?.nights ?? "—"}</TableCell>
                <TableCell className={tx.netAmount.amountMinor >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatMoney(tx.netAmount.amountMinor, currency, locale)}
                </TableCell>
                <TableCell className={tx.grossAmount.amountMinor >= 0 ? "text-green-600" : "text-red-600"}>
                  {formatMoney(tx.grossAmount.amountMinor, currency, locale)}
                </TableCell>
                <TableCell className={tx.hostServiceFeeAmount.amountMinor >= 0 ? "" : "text-red-600"}>
                  {formatMoney(tx.hostServiceFeeAmount.amountMinor, currency, locale)}
                </TableCell>
                <TableCell>{formatMoney(tx.cleaningFeeAmount.amountMinor, currency, locale)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-sm text-muted-foreground">
              {t("transactions.pagination.page_of", { page: page + 1, totalPages })}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage(page - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
                {t("transactions.pagination.prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages - 1}
                onClick={() => setPage(page + 1)}
              >
                {t("transactions.pagination.next")}
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
