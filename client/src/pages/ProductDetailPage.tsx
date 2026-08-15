import { Link, useParams } from "react-router";
import axios, { isAxiosError } from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ImageOff } from "lucide-react";
import { LANGUAGES, type Language } from "@es-market/core";
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

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value}</dd>
    </div>
  );
}

export default function ProductDetailPage() {
  const { t } = useTranslation();
  const LANGUAGE_LABELS: Record<Language, string> = {
    en: t("admin.products.detail.languageLabels.en"),
    ar: t("admin.products.detail.languageLabels.ar"),
    sw: t("admin.products.detail.languageLabels.sw"),
    fr: t("admin.products.detail.languageLabels.fr"),
  };
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
        {t("admin.products.detail.backToProducts")}
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
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("admin.products.detail.notFound")}
        </p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-destructive">
          {t("admin.products.detail.loadError")}
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
                aria-label={t("admin.products.detail.noImageAria")}
                className="flex size-40 items-center justify-center rounded-md border bg-muted"
              >
                <ImageOff className="size-8 text-muted-foreground" />
              </div>
            )}
            <dl className="divide-y">
              <DetailRow label={t("admin.products.detail.price")} value={String(product.price)} />
              <DetailRow label={t("admin.products.detail.stock")} value={String(product.stock)} />
              <DetailRow
                label={t("admin.products.detail.lowStockThreshold")}
                value={String(product.lowStockThreshold)}
              />
              <DetailRow label={t("admin.products.detail.category")} value={product.category.name.en} />
              <DetailRow
                label={t("admin.products.detail.created")}
                value={new Date(product.createdAt).toLocaleString()}
              />
              <DetailRow
                label={t("admin.products.detail.updated")}
                value={new Date(product.updatedAt).toLocaleString()}
              />
            </dl>
            <div className="space-y-3">
              <h3 className="text-sm font-semibold">{t("admin.products.detail.translations")}</h3>
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
