import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { SiteContent } from "@es-market/core";

// Shared by the storefront About and Policy pages — same endpoint, same
// cache key, same pattern as usePublicStoreSettings.
export function usePublicSiteContent() {
  return useQuery({
    queryKey: ["storefront", "site-content"],
    queryFn: () =>
      axios
        .get<{ content: SiteContent }>("/api/storefront/site-content")
        .then((res) => res.data.content),
  });
}
