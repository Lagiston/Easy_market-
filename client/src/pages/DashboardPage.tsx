import { useMemo, useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import DashboardProductsTable from "@/components/DashboardProductsTable";
import type { ProductRow } from "@/components/ProductsTable";
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

export default function DashboardPage() {
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState(ALL_CATEGORIES);

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
      return matchesSearch && matchesCategory;
    });
  }, [products, search, categoryId]);

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
