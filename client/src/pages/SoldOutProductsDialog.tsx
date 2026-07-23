import axios from "axios";
import { Link } from "react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

type SoldOutProduct = { id: string; name: string };

export default function SoldOutProductsDialog({
  date,
  onOpenChange,
}: {
  date: string | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { data } = useQuery({
    queryKey: ["dashboard-sold-out-products", date],
    queryFn: () =>
      axios
        .get<{ date: string; products: SoldOutProduct[] }>(
          `/api/dashboard/sold-out-history/${date}`,
        )
        .then((res) => res.data.products),
    enabled: date !== null,
  });

  return (
    <Dialog open={date !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sold out on {date}</DialogTitle>
          <DialogDescription>Products with zero stock that day.</DialogDescription>
        </DialogHeader>
        {data === undefined ? (
          <div className="space-y-2">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No products were sold out that day.</p>
        ) : (
          <ul className="space-y-2">
            {data.map((product) => (
              <li key={product.id}>
                <Link
                  to={`/admin/products/${product.id}`}
                  className="block rounded-md border p-2 text-sm hover:bg-muted"
                  onClick={() => onOpenChange(false)}
                >
                  {product.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
