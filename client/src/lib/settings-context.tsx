import { createContext, useContext, type ReactNode } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { DEFAULT_SETTINGS, type StoreSettings } from "@es-market/core";

// Fetched once for the authenticated staff tree (mounted in ProtectedRoute) so
// order-related pages (Orders, order detail, dashboard) don't each issue their
// own request. Defaults to DEFAULT_SETTINGS before the fetch resolves and for
// any consumer rendered outside a provider (e.g. component tests).
const SettingsContext = createContext<StoreSettings>(DEFAULT_SETTINGS);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const { data } = useQuery({
    queryKey: ["settings"],
    queryFn: () =>
      axios.get<{ settings: StoreSettings }>("/api/settings").then((res) => res.data.settings),
  });

  return (
    <SettingsContext.Provider value={data ?? DEFAULT_SETTINGS}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useStoreSettings() {
  return useContext(SettingsContext);
}
