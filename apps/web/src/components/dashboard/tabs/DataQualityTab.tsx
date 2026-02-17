import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { WarningsPanel } from "@/components/shared/WarningsPanel";
import type { CanonicalTransaction, ImportWarning } from "@rental-analytics/core";

interface DataQualityTabProps {
  transactions: CanonicalTransaction[];
  warnings: ImportWarning[];
}

export function DataQualityTab({ transactions, warnings }: DataQualityTabProps) {
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
      dateRange: minDate && maxDate ? `${minDate} to ${maxDate}` : "N/A",
    };
  }, [transactions, warnings]);

  const cards = [
    { title: "Total Rows", value: summary.totalRows.toLocaleString() },
    {
      title: "Type Breakdown",
      value: summary.typeBreakdown
        .map(([type, count]) => `${type}: ${count}`)
        .join(", ") || "—",
    },
    { title: "Duplicates Flagged", value: summary.duplicatesRemoved.toLocaleString() },
    { title: "Currencies", value: summary.currencies.join(", ") || "—" },
    { title: "Date Range", value: summary.dateRange },
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
              <p className="text-lg font-bold truncate">{card.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <WarningsPanel warnings={warnings} />
    </div>
  );
}
