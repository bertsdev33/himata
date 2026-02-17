import { createContext, useContext, type Dispatch } from "react";
import type { AnalyticsData, FileEntry, FilterState } from "./types";

/** Application phase */
export type AppPhase = "upload" | "dashboard";

/** Full application state */
export interface AppState {
  phase: AppPhase;
  files: FileEntry[];
  analytics: AnalyticsData | null;
  filter: FilterState;
  isProcessing: boolean;
  error: string | null;
}

/** All possible actions */
export type AppAction =
  | { type: "ADD_FILES"; files: FileEntry[] }
  | { type: "REMOVE_FILE"; id: string }
  | { type: "UPDATE_FILE"; id: string; updates: Partial<Pick<FileEntry, "accountId" | "datasetKind">> }
  | { type: "SET_PROCESSING"; isProcessing: boolean }
  | { type: "SET_ANALYTICS"; analytics: AnalyticsData }
  | { type: "SET_ERROR"; error: string }
  | { type: "SET_FILTER"; filter: Partial<FilterState> }
  | { type: "RESET" };

export const initialFilter: FilterState = {
  selectedAccountIds: [],
  selectedListingIds: [],
  dateRange: { start: null, end: null },
  viewMode: "realized",
  currency: null,
  projection: false,
  activeTab: "portfolio-overview",
};

export const initialState: AppState = {
  phase: "upload",
  files: [],
  analytics: null,
  filter: initialFilter,
  isProcessing: false,
  error: null,
};

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "ADD_FILES":
      return { ...state, files: [...state.files, ...action.files], error: null };

    case "REMOVE_FILE":
      return { ...state, files: state.files.filter((f) => f.id !== action.id) };

    case "UPDATE_FILE":
      return {
        ...state,
        files: state.files.map((f) =>
          f.id === action.id ? { ...f, ...action.updates } : f
        ),
      };

    case "SET_PROCESSING":
      return { ...state, isProcessing: action.isProcessing, error: null };

    case "SET_ANALYTICS":
      return {
        ...state,
        phase: "dashboard",
        analytics: action.analytics,
        isProcessing: false,
        error: null,
        filter: {
          ...initialFilter,
          selectedAccountIds: [],
          selectedListingIds: [],
          currency: action.analytics.currency,
        },
      };

    case "SET_ERROR":
      return { ...state, error: action.error, isProcessing: false };

    case "SET_FILTER":
      return {
        ...state,
        filter: { ...state.filter, ...action.filter },
      };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

/** Context for app state and dispatch */
export const AppContext = createContext<{
  state: AppState;
  dispatch: Dispatch<AppAction>;
} | null>(null);

/** Hook to access app context */
export function useAppContext() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppContext must be used within AppContext.Provider");
  return ctx;
}
