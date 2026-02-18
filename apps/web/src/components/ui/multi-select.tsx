import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, X, Search, Check } from "lucide-react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectLabels {
  selectPlaceholder: string;
  all: string;
  selected: string;
  searchPlaceholder: string;
  selectAll: string;
  clearAll: string;
  noResults: string;
  clearSelectionAriaLabel: string;
}

interface MultiSelectProps {
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
  labels: MultiSelectLabels;
  searchable?: boolean;
  className?: string;
}

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  labels,
  searchable = false,
  className,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = searchable && search
    ? options.filter((o) => o.label.toLowerCase().includes(search.toLowerCase()))
    : options;

  const noneSelected = selected.length === 0;

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const selectAll = () => onChange(options.map((o) => o.value));
  const clearAll = () => onChange([]);

  const displayText = noneSelected
    ? `${placeholder ?? labels.selectPlaceholder} - ${labels.all} (${options.length})`
    : selected.length <= 2
      ? selected.map((v) => options.find((o) => o.value === v)?.label ?? v).join(", ")
      : `${selected.length} ${labels.selected}`;

  return (
    <div ref={ref} className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          !noneSelected && selected.length > 0 && "text-foreground",
          noneSelected && "text-muted-foreground",
        )}
      >
        <span className="truncate">{displayText}</span>
        <div className="flex items-center gap-1 ml-1 shrink-0">
          {!noneSelected && (
            <X
              className="h-3.5 w-3.5 opacity-50 hover:opacity-100"
              aria-label={labels.clearSelectionAriaLabel}
              onClick={(e) => {
                e.stopPropagation();
                clearAll();
              }}
            />
          )}
          <ChevronDown className="h-4 w-4 opacity-50" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[220px] rounded-md border bg-popover shadow-md animate-in fade-in-0 zoom-in-95">
          {searchable && (
            <div className="flex items-center border-b px-3 py-2">
              <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={labels.searchPlaceholder}
                className="flex h-6 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
            </div>
          )}

          <div className="flex items-center justify-between border-b px-3 py-1.5">
            <button
              type="button"
              onClick={selectAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {labels.selectAll}
            </button>
            <button
              type="button"
              onClick={clearAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {labels.clearAll}
            </button>
          </div>

          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.map((option) => {
              const isSelected = selected.includes(option.value);
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => toggle(option.value)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground",
                    isSelected && "font-medium",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground",
                    )}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </div>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                {labels.noResults}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export { MultiSelect };
