import { useReducer } from "react";
import { AppContext, appReducer, initialState } from "./state";
import { SettingsContext } from "./settings-context";
import { useSettings } from "@/hooks/useSettings";
import { UploadPage } from "@/components/upload/UploadPage";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);
  const settingsValue = useSettings();

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      <SettingsContext.Provider value={settingsValue}>
        {state.phase === "upload" ? <UploadPage /> : <DashboardLayout />}
      </SettingsContext.Provider>
    </AppContext.Provider>
  );
}
