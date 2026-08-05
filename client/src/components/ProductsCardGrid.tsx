import { Link } from "react-router";
import { ImageOff, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SuggestionBadge, getStockStatus, type ProductRow } from "@/components/ProductsTable";

// Card-grid alternative to ProductsTable's rows — same data/props, just a
// different layout for staff who prefer scanning product photos over a
// dense table. Reuses ProductsTable's exported SuggestionBadge/getStockStatus
// rather than duplicating the bulk-reclassify and stock-status logic.

const STOCK_BADGE: Record<
  ReturnType<typeof getStockStatus>,
  { label: string; variant: "destructive" | "secondary" | undefined }
> = {
  "out-of-stock": { label: "Out of stock", variant: "destructive" },
  "low-stock": { label: "Low stock", variant: "secondary" },
  "in-stock": { label: "", variant: undefined },
};

export default function ProductsCardGrid({
  products,
  onEdit,
  onDelete,
}: {
  products: ProductRow[] | null;
  onEdit: (product: ProductRow) => void;
  onDelete: (product: ProductRow) => void;
}) {
  if (products === null) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Card key={i} className="overflow-hidden py-0">
            <Skeleton className="aspect-square w-full rounded-none" />
            <CardContent className="space-y-2 p-4">
              <Skeleton className="h-3 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((product) => {
        const stockStatus = getStockStatus(product);
        const stockBadge = STOCK_BADGE[stockStatus];
        return (
          <Card key={product.id} className="overflow-hidden py-0">
            <Link to={`/admin/products/${product.id}`} className="block">
              {product.images[0] ? (
                <img
                  src={product.images[0]}
                  alt=""
                  className="aspect-square w-full bg-white object-cover"
                />
              ) : (
                <div
                  aria-label="No image"
                  className="flex aspect-square w-full items-center justify-center bg-muted"
                >
                  <ImageOff className="size-8 text-muted-foreground" />
                </div>
              )}
            </Link>
            <CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <Link
                  to={`/admin/products/${product.id}`}
                  className="min-w-0 truncate font-medium hover:underline"
                >
                  {product.name.en}
                </Link>
                <SuggestionBadge product={product} />
              </div>
              <p className="text-sm text-muted-foreground">{product.category.name.en}</p>
              {product.tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {product.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold">{product.price}</p>
                {stockBadge.variant && <Badge variant={stockBadge.variant}>{stockBadge.label}</Badge>}
              </div>
              <p className="text-sm text-muted-foreground">
                {product.assignedAgent?.name ?? "Unassigned"}
              </p>
              <div className="flex items-center justify-end gap-1 border-t pt-2">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Edit ${product.name.en}`}
                  onClick={() => onEdit(product)}
                >
                  <Pencil />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Delete ${product.name.en}`}
                  onClick={() => onDelete(product)}
                >
                  <Trash2 />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
