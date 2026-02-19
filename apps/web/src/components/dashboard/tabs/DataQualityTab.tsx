import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WarningsPanel } from "@/components/shared/WarningsPanel";
import { useTranslation } from "react-i18next";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { CanonicalTransaction, ImportWarning } from "@rental-analytics/core";

interface DataQualityTabProps {
  transactions: CanonicalTransaction[];
  warnings: ImportWarning[];
}

export function DataQualityTab({ transactions, warnings }: DataQualityTabProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("data-quality", { lng: locale });
  const summary = useMemo(() => {
    const typeBreakdown = new Map<string, number>();
    const currencies = new Set<string>();
    let minDate = "";
    let maxDate = "";

    for (const tx of transactions) {
      typeBreakdown.set(tx.kind, (typeBreakdown.get(tx.kind) ?? 0) + 1);
      currencies.add(tx.netAmount.currency);
      if (!minDate || tx.occurredDate < minDate) minDate = tx.occurredDate;
      if (!maxDate || tx.occurredDate > maxDate) maxDate = tx.occurredDate;
    }

    const duplicateWarnings = warnings.filter((w) => w.code === "DEDUPLICATED_ROW").length;

    return {
      totalRows: transactions.length,
      typeBreakdown: [...typeBreakdown.entries()].sort(([, a], [, b]) => b - a),
      duplicatesRemoved: duplicateWarnings,
      currencies: [...currencies].sort(),
      dateRangeStart: minDate || null,
      dateRangeEnd: maxDate || null,
    };
  }, [transactions, warnings]);

  const cards = [
    { title: t("summary.cards.total_rows"), value: summary.totalRows.toLocaleString(locale) },
    {
      title: t("summary.cards.type_breakdown"),
      value: summary.typeBreakdown
        .map(([type, count]) =>
          `${t(`transactions.kinds.${type}`, {
            ns: "dashboard",
            defaultValue: type.replace(/_/g, " "),
          })}: ${count}`,
        )
        .join(", ") || t("summary.none"),
    },
    {
      title: t("summary.cards.duplicates_flagged"),
      value: summary.duplicatesRemoved.toLocaleString(locale),
    },
    { title: t("summary.cards.currencies"), value: summary.currencies.join(", ") || t("summary.none") },
    {
      title: t("summary.cards.date_range"),
      value:
        summary.dateRangeStart && summary.dateRangeEnd
          ? t("summary.date_range_value", {
              start: summary.dateRangeStart,
              end: summary.dateRangeEnd,
            })
          : t("summary.not_available"),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-base font-bold leading-snug break-words sm:text-lg">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <WarningsPanel warnings={warnings} />
    </div>
  );
}
