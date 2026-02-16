import { useReducer } from "react";
import { AppContext, appReducer, initialState } from "./state";
import { UploadPage } from "@/components/upload/UploadPage";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function App() {
  const [state, dispatch] = useReducer(appReducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {state.phase === "upload" ? <UploadPage /> : <DashboardLayout />}
    </AppContext.Provider>
  );
}
