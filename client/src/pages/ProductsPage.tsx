import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { LayoutGrid, List, Sparkles } from "lucide-react";
import CreateProductDialog from "./CreateProductDialog";
import EditProductDialog from "./EditProductDialog";
import DeleteProductDialog from "./DeleteProductDialog";
import ProductsCardGrid from "@/components/ProductsCardGrid";
import ProductsTable, { type ProductRow } from "@/components/ProductsTable";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PRODUCT_SORT_FIELDS, PRODUCTS_PAGE_SIZE } from "@es-market/core";

type ReclassifyBatch = { total: number; since: string };

// The card grid has no clickable column headers to sort by (unlike the
// table), so it gets an explicit Select instead — offering the same
// sortable columns the table headers already expose (name/category/price/
// stock), nothing more.
const CARD_SORT_OPTIONS = [
  { id: "name", desc: false, label: "Name (A–Z)" },
  { id: "name", desc: true, label: "Name (Z–A)" },
  { id: "category", desc: false, label: "Category (A–Z)" },
  { id: "category", desc: true, label: "Category (Z–A)" },
  { id: "price", desc: false, label: "Price (low to high)" },
  { id: "price", desc: true, label: "Price (high to low)" },
  { id: "stock", desc: false, label: "Stock (low to high)" },
  { id: "stock", desc: true, label: "Stock (high to low)" },
] as const;

function cardSortValue(sort: { id: string; desc: boolean }) {
  const match = CARD_SORT_OPTIONS.find((o) => o.id === sort.id && o.desc === sort.desc);
  return match ? `${match.id}-${match.desc}` : undefined;
}

export default function ProductsPage() {
  const queryClient = useQueryClient();
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);
  // Read-once (like the storefront's own ?tag= deep-link pattern), not
  // two-way synced — lets a dashboard KPI card land here pre-sorted (e.g. by
  // stock ascending, to surface low-stock products first) without every
  // later sort change round-tripping through the URL. There's no dedicated
  // stock-status *filter* on this page (only sort), so this is the honest
  // equivalent of a "low-stock" deep link rather than a fabricated filter.
  const [searchParams] = useSearchParams();
  const [sorting, setSorting] = useState<SortingState>(() => {
    const sortBy = searchParams.get("sortBy");
    const sortOrder = searchParams.get("sortOrder");
    return sortBy && (PRODUCT_SORT_FIELDS as readonly string[]).includes(sortBy)
      ? [{ id: sortBy, desc: sortOrder === "desc" }]
      : [{ id: "createdAt", desc: true }];
  });
  const [view, setView] = useState<"table" | "card">("table");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [batch, setBatch] = useState<ReclassifyBatch | null>(null);
  const sort = sorting[0] ?? { id: "createdAt", desc: true };

  const reclassifyMutation = useMutation({
    mutationFn: () =>
      axios.post<ReclassifyBatch>("/api/products/reclassify-all").then((res) => res.data),
    onSuccess: setBatch,
  });

  const { data: reclassifyStatus } = useQuery({
    queryKey: ["products", "reclassify-status", batch?.since],
    queryFn: () =>
      axios
        .get<{ completed: number }>("/api/products/reclassify-status", {
          params: { since: batch!.since },
        })
        .then((res) => res.data),
    enabled: batch !== null,
    refetchInterval: (query) => {
      if (!batch) return false;
      const completed = query.state.data?.completed ?? 0;
      return completed >= batch.total ? false : 2000;
    },
  });

  // Once the batch finishes, refresh the list (so new suggestion badges show
  // up) and hide the progress line.
  useEffect(() => {
    if (batch && reclassifyStatus && reclassifyStatus.completed >= batch.total) {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      setBatch(null);
    }
  }, [batch, reclassifyStatus, queryClient]);

  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(timeout);
  }, [search]);

  // Sorting/searching invalidates the current page's meaning, so jump back to page 1.
  useEffect(() => {
    setPage(1);
  }, [sort.id, sort.desc, debouncedSearch]);

  const { data, isError } = useQuery({
    queryKey: ["products", sort.id, sort.desc, debouncedSearch, page],
    queryFn: () =>
      axios
        .get<{ products: ProductRow[]; total: number }>("/api/products", {
          params: {
            sortBy: sort.id,
            sortOrder: sort.desc ? "desc" : "asc",
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
            page,
          },
        })
        .then((res) => res.data),
  });
  const products = data?.products ?? null;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PRODUCTS_PAGE_SIZE));
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {data ? `${total} product${total === 1 ? "" : "s"}` : "Catalog"}
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            disabled={batch !== null || reclassifyMutation.isPending}
            onClick={() => reclassifyMutation.mutate()}
          >
            <Sparkles /> Reclassify all
          </Button>
          <CreateProductDialog />
        </div>
      </CardHeader>
      <CardContent>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <Input
            placeholder="Search by name, category, or tag…"
            aria-label="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-xs"
          />
          <div className="flex items-center gap-2">
            {view === "card" && (
              <Select
                value={cardSortValue(sort)}
                onValueChange={(value) => {
                  if (!value) return;
                  const [id, desc] = value.split("-");
                  setSorting([{ id: id!, desc: desc === "true" }]);
                }}
              >
                <SelectTrigger aria-label="Sort by" className="w-44">
                  <SelectValue placeholder="Sort by…">
                    {(value: string) =>
                      CARD_SORT_OPTIONS.find((o) => `${o.id}-${o.desc}` === value)?.label ??
                      "Sort by…"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CARD_SORT_OPTIONS.map((option) => (
                    <SelectItem key={`${option.id}-${option.desc}`} value={`${option.id}-${option.desc}`}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Tabs value={view} onValueChange={(value) => setView(value as "table" | "card")}>
              <TabsList>
                <TabsTrigger value="table" aria-label="Table view">
                  <List />
                </TabsTrigger>
                <TabsTrigger value="card" aria-label="Card view">
                  <LayoutGrid />
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>
        {batch && (
          <p className="mb-4 text-sm text-muted-foreground">
            Reclassifying products… {reclassifyStatus?.completed ?? 0}/{batch.total}
          </p>
        )}
        {reclassifyMutation.isError && (
          <p className="mb-4 text-sm text-destructive">
            {axios.isAxiosError(reclassifyMutation.error) &&
            reclassifyMutation.error.response?.data?.error
              ? String(reclassifyMutation.error.response.data.error)
              : "Could not start reclassification. Please try again."}
          </p>
        )}
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load products. Please try again.
          </p>
        ) : (
          <>
            {view === "table" ? (
              <ProductsTable
                products={products}
                sorting={sorting}
                onSortingChange={setSorting}
                onEdit={setEditingProduct}
                onDelete={setDeletingProduct}
              />
            ) : (
              <ProductsCardGrid
                products={products}
                onEdit={setEditingProduct}
                onDelete={setDeletingProduct}
              />
            )}
            <Pagination className="mt-4">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    aria-disabled={page <= 1}
                    className={page <= 1 ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page > 1) setPage(page - 1);
                    }}
                  />
                </PaginationItem>
                <PaginationItem>
                  <span className="px-2 text-sm text-muted-foreground">
                    Page {page} of {totalPages}
                  </span>
                </PaginationItem>
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    aria-disabled={page >= totalPages}
                    className={page >= totalPages ? "pointer-events-none opacity-50" : undefined}
                    onClick={(event) => {
                      event.preventDefault();
                      if (page < totalPages) setPage(page + 1);
                    }}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </>
        )}
        <EditProductDialog
          product={editingProduct}
          onOpenChange={(open) => {
            if (!open) setEditingProduct(null);
          }}
          onProductChange={setEditingProduct}
        />
        <DeleteProductDialog
          product={deletingProduct}
          onOpenChange={(open) => {
            if (!open) setDeletingProduct(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
