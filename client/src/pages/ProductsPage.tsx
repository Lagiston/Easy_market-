import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import CreateProductDialog from "./CreateProductDialog";
import ProductsTable, { type ProductRow } from "@/components/ProductsTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ProductsPage() {
  const { data, isError } = useQuery({
    queryKey: ["products"],
    queryFn: () =>
      axios.get<{ products: ProductRow[] }>("/api/products").then((res) => res.data.products),
  });
  const products = data ?? null;
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Products</CardTitle>
          <CardDescription>
            {products
              ? `${products.length} product${products.length === 1 ? "" : "s"}`
              : "Catalog"}
          </CardDescription>
        </div>
        <CreateProductDialog />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load products. Please try again.
          </p>
        ) : (
          <ProductsTable products={products} />
        )}
      </CardContent>
    </Card>
  );
}
