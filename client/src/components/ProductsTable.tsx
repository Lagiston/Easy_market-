import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type ProductRow = {
  id: string;
  name: string;
  stock: number;
  category: { id: string; name: string };
};

export default function ProductsTable({
  products,
}: {
  products: ProductRow[] | null;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Category</TableHead>
          <TableHead className="text-right">Stock</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {products === null
          ? Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-3 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-3 w-10" />
                </TableCell>
              </TableRow>
            ))
          : products.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="font-medium">{product.name}</TableCell>
                <TableCell className="text-muted-foreground">
                  {product.category.name}
                </TableCell>
                <TableCell className="text-right">{product.stock}</TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
