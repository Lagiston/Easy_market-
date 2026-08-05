import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ImageOff } from "lucide-react";
import { LANGUAGES } from "@es-market/core";
import { type ProductRow } from "@/components/ProductsTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type ProductDetail = ProductRow & { createdAt: string; updatedAt: string };

const LANGUAGE_LABELS = { en: "English", ar: "Arabic", sw: "Swahili", fr: "French" } as const;

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: product, isPending, error } = useQuery({
    queryKey: ["products", id],
    queryFn: () =>
      axios
        .get<{ product: ProductDetail }>(`/api/products/${id}`)
        .then((res) => res.data.product),
  });

  const notFound = isAxiosError(error) && error.response?.status === 404;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link
        to="/admin/products"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Link>
      {isPending ? (
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-24" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="size-40 rounded-md" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </CardContent>
        </Card>
      ) : notFound ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Product not found.</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">
          Could not load product. Please try again.
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>{product.name.en}</CardTitle>
            <CardDescription>{product.category.name.en}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {product.images.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {product.images.map((imageUrl) => (
                  <img
                    key={imageUrl}
                    src={imageUrl}
                    alt={product.name.en}
                    className="size-40 rounded-md border bg-white object-cover"
                  />
                ))}
              </div>
            ) : (
              <div
                aria-label="No image"
                className="flex size-40 items-center justify-center rounded-md border bg-muted"
              >
                <ImageOff className="size-8 text-muted-foreground" />
              </div>
            )}
            <dl className="divide-y">
              <DetailRow label="Price" value={String(product.price)} />
              <DetailRow label="Stock" value={String(product.stock)} />
              <DetailRow label="Low stock threshold" value={String(product.lowStockThreshold)} />
              <DetailRow label="Category" value={product.category.name.en} />
              <DetailRow label="Created" value={new Date(product.createdAt).toLocaleString()} />
              <DetailRow label="Updated" value={new Date(product.updatedAt).toLocaleString()} />
            </dl>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">Translations</h3>
              {LANGUAGES.filter((lang) => product.name[lang] || product.description?.[lang]).map(
                (lang) => (
                  <div key={lang} className="space-y-1">
                    <h4 className="text-sm text-muted-foreground">{LANGUAGE_LABELS[lang]}</h4>
                    {product.name[lang] && (
                      <p className="text-sm font-medium">{product.name[lang]}</p>
                    )}
                    {product.description?.[lang] && (
                      <p className="text-sm whitespace-pre-wrap">{product.description[lang]}</p>
                    )}
                  </div>
                ),
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
