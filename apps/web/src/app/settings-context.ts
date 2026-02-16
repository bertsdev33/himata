import { createContext, useContext } from "react";
import type { UseSettingsReturn } from "@/hooks/useSettings";

export const SettingsContext = createContext<UseSettingsReturn | null>(null);

export function useSettingsContext() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettingsContext must be used within SettingsContext.Provider");
  return ctx;
}
