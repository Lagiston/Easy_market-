import { useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import DashboardProductsTable from "@/components/DashboardProductsTable";
import {
  getStockStatus,
  STOCK_STATUSES,
  type ProductRow,
  type StockStatus,
} from "@/components/ProductsTable";
import type { LocalizedName } from "@es-market/core";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Category = { id: string; name: LocalizedName };

const ALL_CATEGORIES = "all";
const ALL_STATUSES = "all";

const STATUS_LABELS: Record<StockStatus, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "out-of-stock": "Out of stock",
};

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);
  const [status, setStatus] = useState(ALL_STATUSES);

  const { data, isError } = useQuery({
    queryKey: ["products"],
    queryFn: () =>
      axios.get<{ products: ProductRow[] }>("/api/products").then((res) => res.data.products),
  });
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      axios
        .get<{ categories: Category[] }>("/api/categories")
        .then((res) => res.data.categories),
  });

  const products = data ?? null;
  const error = isError;

  const filteredProducts = useMemo(() => {
    if (!products) return null;
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesSearch = query === "" || product.name.en.toLowerCase().includes(query);
      const matchesCategory =
        categoryId === ALL_CATEGORIES || product.category.id === categoryId;
      const matchesStatus = status === ALL_STATUSES || getStockStatus(product) === status;
      return matchesSearch && matchesCategory && matchesStatus;
    });
  }, [products, search, categoryId, status]);

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="space-y-1.5">
        <CardTitle>Dashboard</CardTitle>
        <CardDescription>
          {filteredProducts
            ? `${filteredProducts.length} product${filteredProducts.length === 1 ? "" : "s"}`
            : "Catalog overview"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            placeholder="Search products…"
            aria-label="Search products"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="sm:max-w-xs"
          />
          <Select
            value={categoryId}
            onValueChange={(value) => setCategoryId(value ?? ALL_CATEGORIES)}
          >
            <SelectTrigger aria-label="Filter by category" className="sm:max-w-48">
              <SelectValue placeholder="All categories">
                {(value: string) =>
                  value === ALL_CATEGORIES
                    ? "All categories"
                    : (categories?.find((category) => category.id === value)?.name.en ?? "")
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_CATEGORIES}>All categories</SelectItem>
              {categories?.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name.en}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(value) => setStatus(value ?? ALL_STATUSES)}>
            <SelectTrigger aria-label="Filter by status" className="sm:max-w-48">
              <SelectValue placeholder="All statuses">
                {(value: string) =>
                  value === ALL_STATUSES
                    ? "All statuses"
                    : STATUS_LABELS[value as StockStatus]
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_STATUSES}>All statuses</SelectItem>
              {STOCK_STATUSES.map((stockStatus) => (
                <SelectItem key={stockStatus} value={stockStatus}>
                  {STATUS_LABELS[stockStatus]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load products. Please try again.
          </p>
        ) : (
          <DashboardProductsTable products={filteredProducts} />
        )}
      </CardContent>
    </Card>
  );
}
