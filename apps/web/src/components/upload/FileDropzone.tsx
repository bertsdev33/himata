import { useCallback, useState, useRef } from "react";
import { Upload } from "lucide-react";

/** Maximum file size: 50 MB */
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

interface FileDropzoneProps {
  onFilesSelected: (files: File[]) => void;
  onError?: (message: string) => void;
}

function filterValidFiles(
  files: File[],
  onError?: (message: string) => void,
): File[] {
  const valid: File[] = [];
  const rejected: string[] = [];

  for (const f of files) {
    if (!f.name.toLowerCase().endsWith(".csv")) {
      rejected.push(`${f.name}: not a CSV file`);
    } else if (f.size > MAX_FILE_SIZE_BYTES) {
      rejected.push(`${f.name}: exceeds 50 MB limit (${(f.size / 1024 / 1024).toFixed(1)} MB)`);
    } else {
      valid.push(f);
    }
  }

  if (rejected.length > 0 && onError) {
    onError(`Rejected files: ${rejected.join("; ")}`);
  }

  return valid;
}

export function FileDropzone({ onFilesSelected, onError }: FileDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const files = filterValidFiles(Array.from(e.dataTransfer.files), onError);
      if (files.length > 0) onFilesSelected(files);
    },
    [onFilesSelected, onError]
  );

  const handleClick = useCallback(() => {
    inputRef.current?.click();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = filterValidFiles(Array.from(e.target.files ?? []), onError);
      if (files.length > 0) onFilesSelected(files);
      e.target.value = "";
    },
    [onFilesSelected, onError]
  );

  return (
    <div
      onClick={handleClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`
        relative flex flex-col items-center justify-center gap-4 rounded-lg border-2 border-dashed p-12
        cursor-pointer transition-colors
        ${isDragOver
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"
        }
      `}
    >
      <Upload className="h-10 w-10 text-muted-foreground" />
      <div className="text-center">
        <p className="text-lg font-medium">
          Drop CSV files here or click to browse
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          Upload your Airbnb transaction exports (.csv, max 50 MB)
        </p>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".csv"
        multiple
        onChange={handleChange}
        className="hidden"
      />
    </div>
  );
}
