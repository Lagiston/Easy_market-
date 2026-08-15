import { useTranslation } from "react-i18next";
import { MessageSquareReply, Star, Trash2 } from "lucide-react";
import type { LocalizedName } from "@es-market/core";
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

export type ReviewRow = {
  id: string;
  authorName: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  verifiedPurchase: boolean;
  staffReply: string | null;
  staffReplyAt: string | null;
  createdAt: string;
  product: { id: string; name: LocalizedName };
  customer: { id: string; name: string } | null;
};

export default function ReviewsTable({
  reviews,
  onDelete,
  onReply,
}: {
  reviews: ReviewRow[] | null;
  onDelete: (review: ReviewRow) => void;
  onReply: (review: ReviewRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.reviews.table.product")}</TableHead>
          <TableHead>{t("admin.reviews.table.rating")}</TableHead>
          <TableHead>{t("admin.reviews.table.author")}</TableHead>
          <TableHead>{t("admin.reviews.table.headline")}</TableHead>
          <TableHead>{t("admin.reviews.table.comment")}</TableHead>
          <TableHead>{t("admin.reviews.table.reply")}</TableHead>
          <TableHead>{t("admin.reviews.table.date")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("admin.reviews.table.actionsSr")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews === null ? (
          Array.from({ length: 3 }, (_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 7 }, (_, j) => (
                <TableCell key={j}>
                  <Skeleton className="h-3 w-20" />
                </TableCell>
              ))}
              <TableCell>
                <Skeleton className="size-7 rounded-lg" />
              </TableCell>
            </TableRow>
          ))
        ) : reviews.length === 0 ? (
          <TableRow>
            <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">
              {t("admin.reviews.table.empty")}
            </TableCell>
          </TableRow>
        ) : (
          reviews.map((review) => (
            <TableRow key={review.id}>
              <TableCell className="font-medium">{review.product.name.en}</TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1">
                  <Star aria-hidden className="size-3.5 fill-primary text-primary" />
                  {review.rating}
                </span>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5">
                  {review.authorName}
                  {review.verifiedPurchase && (
                    <Badge variant="secondary">{t("admin.reviews.table.verified")}</Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="max-w-40 truncate text-foreground">
                {review.headline ?? t("admin.reviews.table.noValue")}
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">
                {review.comment ?? t("admin.reviews.table.noValue")}
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">
                {review.staffReply ?? t("admin.reviews.table.noValue")}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("admin.reviews.table.replyAria", { name: review.authorName })}
                    onClick={() => onReply(review)}
                  >
                    <MessageSquareReply />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={t("admin.reviews.table.deleteAria", { name: review.authorName })}
                    onClick={() => onDelete(review)}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );
}
