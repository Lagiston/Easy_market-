import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customerAuthClient } from "@/lib/customer-auth-client";
import type { StorefrontProduct } from "@/pages/storefront/ProductsPage";

const WISHLIST_KEY = ["customer", "wishlist"] as const;

// `backInStock`/`priceDropped` are computed server-side from
// WishlistItem.wasOutOfStockAtSave/priceAtSave (snapshots taken once at save
// time) vs the product's current stock/price — the entire "notify me"
// feature, since this store has no email/push infrastructure to actually
// notify anyone with. Both are read-time signals, not stored alerts: neither
// tracks re-transitions or whether the customer has already seen them.
// `priceAtSave` itself is included (not just the boolean) so the UI can show
// "was X, now Y", not just "the price changed".
export type WishlistedProduct = StorefrontProduct & {
  backInStock: boolean;
  priceDropped: boolean;
  priceAtSave: number | null;
};

// Server-state access point for the wishlist (TanStack Query, not the cart's
// localStorage/context mechanics — wishlist has no guest tier, so there's
// nothing to persist client-side when signed out). Enabled only with a
// session so a guest's render doesn't fire a request that will just 401.
export function useWishlist() {
  const queryClient = useQueryClient();
  const { data: session } = customerAuthClient.useSession();

  const query = useQuery({
    queryKey: WISHLIST_KEY,
    queryFn: () =>
      axios
        .get<{ products: WishlistedProduct[] }>("/api/customer/wishlist")
        .then((res) => res.data.products),
    enabled: !!session,
  });

  const addMutation = useMutation({
    mutationFn: (productId: string) => axios.post(`/api/customer/wishlist/${productId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) => axios.delete(`/api/customer/wishlist/${productId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: WISHLIST_KEY }),
  });

  const products = query.data ?? [];

  return {
    ...query,
    products,
    isWishlisted: (productId: string) => products.some((product) => product.id === productId),
    addMutation,
    removeMutation,
  };
}
