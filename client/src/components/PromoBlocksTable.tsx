import { Pencil, Trash2 } from "lucide-react";
import type { LocalizedDescription, LocalizedName } from "@es-market/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type PromoBlockRow = {
  id: string;
  headline: LocalizedName;
  copy: LocalizedDescription | null;
  ctaLabel: string | null;
  ctaUrl: string | null;
  isActive: boolean;
  sortOrder: number;
};

export default function PromoBlocksTable({
  promoBlocks,
  onEdit,
  onDelete,
}: {
  promoBlocks: PromoBlockRow[] | null;
  onEdit: (promoBlock: PromoBlockRow) => void;
  onDelete: (promoBlock: PromoBlockRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Headline</TableHead>
          <TableHead>CTA</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Order</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {promoBlocks === null
          ? Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-3 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-3 w-8" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))
          : promoBlocks.map((promoBlock) => (
              <TableRow key={promoBlock.id}>
                <TableCell className="font-medium">{promoBlock.headline.en}</TableCell>
                <TableCell className="text-muted-foreground">
                  {promoBlock.ctaLabel ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={promoBlock.isActive ? "secondary" : "outline"}>
                    {promoBlock.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{promoBlock.sortOrder}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${promoBlock.headline.en}`}
                      onClick={() => onEdit(promoBlock)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${promoBlock.headline.en}`}
                      onClick={() => onDelete(promoBlock)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
