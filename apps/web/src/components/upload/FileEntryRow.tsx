import { FileText, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useLocaleContext } from "@/i18n/LocaleProvider";
import type { DatasetKind } from "@rental-analytics/core";

interface FileEntryRowProps {
  id: string;
  fileName: string;
  accountId: string;
  datasetKind: DatasetKind;
  onUpdate: (id: string, updates: { accountId?: string; datasetKind?: DatasetKind }) => void;
  onRemove: (id: string) => void;
}

export function FileEntryRow({
  id,
  fileName,
  accountId,
  datasetKind,
  onUpdate,
  onRemove,
}: FileEntryRowProps) {
  const { locale } = useLocaleContext();
  const { t } = useTranslation("upload", { lng: locale });
  const datasetOptions = useMemo(
    () => [
      { value: "paid", label: t("dataset.paid") },
      { value: "upcoming", label: t("dataset.upcoming") },
    ],
    [t],
  );

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border p-3">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{fileName}</p>
      </div>
      <Input
        value={accountId}
        onChange={(e) => onUpdate(id, { accountId: e.target.value })}
        placeholder={t("fields.account_id")}
        className="w-full sm:w-40"
      />
      <Select
        value={datasetKind}
        onChange={(e) => onUpdate(id, { datasetKind: e.target.value as DatasetKind })}
        options={datasetOptions}
        ariaLabel={t("fields.dataset_kind")}
        className="w-full sm:w-44"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={() => onRemove(id)}
        aria-label={t("actions.remove_file")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
