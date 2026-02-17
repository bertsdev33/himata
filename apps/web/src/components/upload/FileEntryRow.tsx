import { FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { DatasetKind } from "@rental-analytics/core";

interface FileEntryRowProps {
  id: string;
  fileName: string;
  accountId: string;
  datasetKind: DatasetKind;
  onUpdate: (id: string, updates: { accountId?: string; datasetKind?: DatasetKind }) => void;
  onRemove: (id: string) => void;
}

const DATASET_OPTIONS = [
  { value: "paid", label: "Paid (Finalized)" },
  { value: "upcoming", label: "Upcoming (Forecast)" },
];

export function FileEntryRow({
  id,
  fileName,
  accountId,
  datasetKind,
  onUpdate,
  onRemove,
}: FileEntryRowProps) {
  return (
    <div className="flex items-center gap-3 rounded-md border p-3">
      <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">{fileName}</p>
      </div>
      <Input
        value={accountId}
        onChange={(e) => onUpdate(id, { accountId: e.target.value })}
        placeholder="Account ID"
        className="w-40"
      />
      <Select
        value={datasetKind}
        onChange={(e) => onUpdate(id, { datasetKind: e.target.value as DatasetKind })}
        options={DATASET_OPTIONS}
        className="w-44"
      />
      <Button variant="ghost" size="icon" onClick={() => onRemove(id)}>
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
