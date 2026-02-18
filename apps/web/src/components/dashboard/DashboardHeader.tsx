import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAppContext } from "@/app/state";
import { ReactLanguageSwitcher } from "./ReactLanguageSwitcher";

export function DashboardHeader() {
  const { state, dispatch } = useAppContext();
  const currency = state.filter.currency ?? state.analytics?.currency ?? "USD";

  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight">Rental Analytics</h1>
        <Badge variant="secondary">{currency}</Badge>
      </div>
      <div className="flex items-center gap-3">
        <ReactLanguageSwitcher />
        <Button variant="outline" onClick={() => dispatch({ type: "RESET" })}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Upload New Files
        </Button>
      </div>
    </header>
  );
}
