import { ImageOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ProductRow } from "@/components/ProductsTable";

export default function DashboardProductsTable({
  products,
}: {
  products: ProductRow[] | null;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>
            <span className="sr-only">Image</span>
          </TableHead>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Stock</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products === null ? (
          Array.from({ length: 3 }, (_, i) => (
            <TableRow key={i}>
              <TableCell>
                <Skeleton className="size-8 rounded-full" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-32" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-20" />
              </TableCell>
              <TableCell>
                <Skeleton className="ml-auto h-3 w-10" />
              </TableCell>
              <TableCell>
                <Skeleton className="h-3 w-16" />
              </TableCell>
            </TableRow>
          ))
        ) : products.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-8 text-center text-sm text-muted-foreground">
              No products match your filters.
            </TableCell>
          </TableRow>
        ) : (
          products.map((product) => (
            <TableRow key={product.id}>
              <TableCell>
                <Avatar>
                  {product.imageUrl && (
                    <AvatarImage src={product.imageUrl} alt="" />
                  )}
                  <AvatarFallback aria-label="No image">
                    <ImageOff className="size-4" />
                  </AvatarFallback>
                </Avatar>
              </TableCell>
              <TableCell className="font-medium">{product.name.en}</TableCell>
              <TableCell className="text-muted-foreground">
                {product.category.name.en}
              </TableCell>
              <TableCell className="text-right">{product.stock}</TableCell>
              <TableCell>
                {product.stock < product.lowStockThreshold && (
                  <Badge variant="destructive">Low stock</Badge>
                )}
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
