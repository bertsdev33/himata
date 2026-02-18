import { useMemo } from "react";
import { CashflowSection } from "../CashflowSection";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { formatMoney, formatMonth } from "@/lib/format";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { MonthlyCashflow, YearMonth } from "@rental-analytics/core";

interface CashflowTabProps {
  cashflow: MonthlyCashflow[];
  currency: string;
  projection?: boolean;
}

export function CashflowTab({ cashflow, currency, projection = false }: CashflowTabProps) {
  const { locale } = useLocaleContext();
  const payoutSummary = useMemo(() => {
    const monthMap = new Map<string, { totalPaid: number; eventCount: number }>();
    for (const cf of cashflow) {
      const existing = monthMap.get(cf.month) ?? { totalPaid: 0, eventCount: 0 };
      existing.totalPaid += cf.payoutsMinor;
      existing.eventCount += 1;
      monthMap.set(cf.month, existing);
    }
    return [...monthMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({
        month,
        label: formatMonth(month as YearMonth, locale),
        totalPaid: data.totalPaid,
        eventCount: data.eventCount,
      }));
  }, [cashflow, locale]);

  return (
    <div className="space-y-6">
      <CashflowSection data={cashflow} currency={currency} projection={projection} />

      {payoutSummary.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Payout Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead className="text-right">Total Paid Out</TableHead>
                  <TableHead className="text-right">Payout Events</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payoutSummary.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell>{row.label}</TableCell>
                    <TableCell className="text-right">
                      {formatMoney(row.totalPaid, currency, locale)}
                    </TableCell>
                    <TableCell className="text-right">{row.eventCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
