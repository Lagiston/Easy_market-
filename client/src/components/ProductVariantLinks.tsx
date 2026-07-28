import { useEffect, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, X } from "lucide-react";
import type { LocalizedName } from "@es-market/core";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";

type VariantSummary = {
  id: string;
  name: LocalizedName;
  price: number;
  images: string[];
  stock: number;
  size: string | null;
  color: string | null;
};

// Small "Red / M"-style caption so staff can tell variants apart while
// linking — renders nothing when neither label is set.
function variantLabel(variant: Pick<VariantSummary, "size" | "color">) {
  return [variant.size, variant.color].filter(Boolean).join(" / ");
}

// Links other products in as variants of this one (e.g. the same item in a
// different color) — edit-only, since linking needs two already-saved
// products. Self-fetches the current product + its variants fresh via
// useQuery rather than trusting a possibly-stale row snapshot passed down
// from the products table (the same staleness class of bug fixed for the
// image gallery previously).
export default function ProductVariantLinks({ productId }: { productId: string }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  const { data } = useQuery({
    queryKey: ["products", productId],
    queryFn: () =>
      axios
        .get<{ variants: VariantSummary[] }>(`/api/products/${productId}`)
        .then((res) => res.data.variants),
  });
  const variants = data ?? [];

  const { data: searchResults } = useQuery({
    queryKey: ["products", "search", debouncedSearch],
    queryFn: () =>
      axios
        .get<{ products: VariantSummary[] }>("/api/products", {
          params: { search: debouncedSearch, page: 1 },
        })
        .then((res) => res.data.products),
    enabled: debouncedSearch.length > 0,
  });
  const linkedIds = new Set(variants.map((v) => v.id));
  const candidates = (searchResults ?? []).filter(
    (product) => product.id !== productId && !linkedIds.has(product.id),
  );

  const linkMutation = useMutation({
    mutationFn: (otherProductId: string) =>
      axios.post(`/api/products/${productId}/variants`, { productId: otherProductId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setSearch("");
    },
  });

  const unlinkMutation = useMutation({
    mutationFn: (variantProductId: string) =>
      axios.delete(`/api/products/${productId}/variants/${variantProductId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  const error = linkMutation.isError
    ? axios.isAxiosError(linkMutation.error) && linkMutation.error.response?.data?.error
      ? String(linkMutation.error.response.data.error)
      : "Could not link that product. Please try again."
    : unlinkMutation.isError
      ? axios.isAxiosError(unlinkMutation.error) && unlinkMutation.error.response?.data?.error
        ? String(unlinkMutation.error.response.data.error)
        : "Could not remove that variant. Please try again."
      : null;

  return (
    <div className="grid gap-3">
      <p className="text-sm font-medium">Variants</p>
      {variants.length > 0 && (
        <ul className="grid gap-1.5">
          {variants.map((variant) => (
            <li
              key={variant.id}
              className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-sm"
            >
              <Avatar size="sm">
                {variant.images[0] && <AvatarImage src={variant.images[0]} alt="" />}
                <AvatarFallback>{variant.name.en.slice(0, 1)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">
                {variant.name.en}
                {variantLabel(variant) && (
                  <span className="ms-1.5 text-xs text-muted-foreground">
                    {variantLabel(variant)}
                  </span>
                )}
              </span>
              <button
                type="button"
                aria-label={`Remove ${variant.name.en}`}
                disabled={unlinkMutation.isPending}
                onClick={() => unlinkMutation.mutate(variant.id)}
                className="text-muted-foreground hover:text-destructive"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search className="absolute top-1/2 start-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="Search products to link as a variant"
          placeholder="Search products to link as a variant…"
          className="ps-8"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      {debouncedSearch && candidates.length > 0 && (
        <ul className="grid gap-1 rounded-md border p-1">
          {candidates.map((candidate) => (
            <li key={candidate.id}>
              <button
                type="button"
                disabled={linkMutation.isPending}
                onClick={() => linkMutation.mutate(candidate.id)}
                className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-start text-sm hover:bg-muted"
              >
                <Avatar size="sm">
                  {candidate.images[0] && <AvatarImage src={candidate.images[0]} alt="" />}
                  <AvatarFallback>{candidate.name.en.slice(0, 1)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate">
                  {candidate.name.en}
                  {variantLabel(candidate) && (
                    <span className="ms-1.5 text-xs text-muted-foreground">
                      {variantLabel(candidate)}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {debouncedSearch && searchResults && candidates.length === 0 && (
        <p className="text-sm text-muted-foreground">No matching products found.</p>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
