import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { PublicStoreSettings } from "@es-market/core";

// Shared by checkout (delivery fee/threshold) and the contact page (store
// phone/email/address) — same endpoint, same cache key.
export function usePublicStoreSettings() {
  return useQuery({
    queryKey: ["storefront", "settings"],
    queryFn: () =>
      axios
        .get<{ settings: PublicStoreSettings }>("/api/storefront/settings")
        .then((res) => res.data.settings),
  });
}
