import * as React from "react";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

function Tooltip({ content, children, className }: TooltipProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <div
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && (
        <div
          className={cn(
            "absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
            className
          )}
        >
          {content}
        </div>
      )}
    </div>
  );
}

export { Tooltip };
