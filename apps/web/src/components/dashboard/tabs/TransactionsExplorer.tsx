import { useState, useMemo, useEffect } from "react";
import { useSettingsContext } from "@/app/settings-context";
import { ArrowUpDown, ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
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

  const sortOptions = [
    { value: "date", label: t("transactions.columns.date") },
    { value: "kind", label: t("transactions.columns.type") },
    { value: "netAmount", label: t("transactions.columns.net") },
    { value: "grossAmount", label: t("transactions.columns.gross") },
    { value: "listingName", label: t("transactions.columns.listing") },
    { value: "nights", label: t("transactions.columns.nights") },
  ] as const;

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
          className="w-full sm:w-72"
        />
      </CardHeader>
      <CardContent>
        {/* Desktop table */}
        <div className="hidden sm:block">
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
        </div>

        {/* Mobile card list */}
        <div className="sm:hidden space-y-3">
          {/* Mobile sort control */}
          <div className="flex items-center gap-2">
            <Select
              value={sortKey}
              onChange={(e) => {
                setSortKey(e.target.value as SortKey);
                setSortAsc(false);
                setPage(0);
              }}
              options={[...sortOptions]}
              ariaLabel={t("transactions.actions.sort_by")}
              className="h-8 flex-1 text-xs"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-2"
              onClick={() => { setSortAsc(!sortAsc); setPage(0); }}
              aria-label={t("transactions.actions.toggle_sort_direction")}
            >
              <ChevronsUpDown className="h-3.5 w-3.5" />
            </Button>
          </div>

          {pageData.map((tx, i) => (
            <div
              key={`${tx.transactionId}-${i}`}
              className="rounded-lg border bg-card p-3 space-y-2"
            >
              {/* Date + type badge */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium">{tx.occurredDate}</span>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {getKindLabel(tx.kind)}
                </Badge>
              </div>

              {/* Listing + account */}
              <div className="text-xs space-y-0.5">
                <p className="truncate">
                  {tx.listing ? getListingName(tx.listing.listingId, tx.listing.listingName) : "—"}
                </p>
                <p className="text-muted-foreground">
                  {tx.listing ? getAccountName(tx.listing.accountId) : "—"}
                </p>
              </div>

              {/* Net / Gross amounts */}
              <div className="flex gap-4 text-sm">
                <div>
                  <p className="text-[10px] text-muted-foreground">{t("transactions.columns.net")}</p>
                  <p className={`font-semibold ${tx.netAmount.amountMinor >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMoney(tx.netAmount.amountMinor, currency, locale)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">{t("transactions.columns.gross")}</p>
                  <p className={`font-semibold ${tx.grossAmount.amountMinor >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {formatMoney(tx.grossAmount.amountMinor, currency, locale)}
                  </p>
                </div>
              </div>

              {/* Nights / service fee / cleaning footer */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs border-t pt-2 text-muted-foreground">
                <span className="min-w-0 break-words">
                  {t("transactions.columns.nights")}: {tx.stay?.nights ?? "—"}
                </span>
                <span className="min-w-0 break-words">
                  {t("transactions.columns.service_fee")}: {formatMoney(tx.hostServiceFeeAmount.amountMinor, currency, locale)}
                </span>
                <span className="min-w-0 break-words">
                  {t("transactions.columns.cleaning")}: {formatMoney(tx.cleaningFeeAmount.amountMinor, currency, locale)}
                </span>
              </div>
            </div>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
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
