import { useEffect, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import CreateProductDialog from "./CreateProductDialog";
import EditProductDialog from "./EditProductDialog";
import DeleteProductDialog from "./DeleteProductDialog";
import ProductsTable, { type ProductRow } from "@/components/ProductsTable";
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
import { PRODUCTS_PAGE_SIZE } from "@es-market/core";

export default function ProductsPage() {
  const [editingProduct, setEditingProduct] = useState<ProductRow | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ProductRow | null>(null);
  const [sorting, setSorting] = useState<SortingState>([{ id: "createdAt", desc: true }]);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const sort = sorting[0] ?? { id: "createdAt", desc: true };

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
        <CreateProductDialog />
      </CardHeader>
      <CardContent>
        <Input
          placeholder="Search products…"
          aria-label="Search products"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mb-4 sm:max-w-xs"
        />
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load products. Please try again.
          </p>
        ) : (
          <>
            <ProductsTable
              products={products}
              sorting={sorting}
              onSortingChange={setSorting}
              onEdit={setEditingProduct}
              onDelete={setDeletingProduct}
            />
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
