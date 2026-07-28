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
  // ISO date strings (JSON has no native Date type) — null means unbounded
  // on that side, not "never"/"always" show.
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
};

function formatSchedule(promoBlock: Pick<PromoBlockRow, "startsAt" | "endsAt">) {
  const { startsAt, endsAt } = promoBlock;
  if (!startsAt && !endsAt) return "—";
  // toLocaleDateString() renders in the viewer's local timezone, but endsAt
  // is deliberately stored at 23:59:59.999 UTC (see promoBlockSchema's
  // end-of-day transform) — for any positive UTC offset that pushes display
  // into the next calendar day (caught live: an entered "Aug 5" end date
  // showed as "8/6/2026" in this table while the edit form, which slices the
  // ISO string instead of localizing it, correctly showed Aug 5). Forcing
  // timeZone: "UTC" keeps this display consistent with the date the admin
  // actually picked, regardless of viewer timezone.
  const format = (value: string) =>
    new Date(value).toLocaleDateString(undefined, { timeZone: "UTC" });
  if (startsAt && endsAt) return `${format(startsAt)} – ${format(endsAt)}`;
  if (startsAt) return `From ${format(startsAt)}`;
  return `Until ${format(endsAt!)}`;
}

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
          <TableHead>Schedule</TableHead>
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
                  <Skeleton className="h-3 w-28" />
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
                <TableCell className="text-muted-foreground">
                  {formatSchedule(promoBlock)}
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
