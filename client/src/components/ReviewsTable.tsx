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
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Product</TableHead>
          <TableHead>Rating</TableHead>
          <TableHead>Author</TableHead>
          <TableHead>Comment</TableHead>
          <TableHead>Reply</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {reviews === null ? (
          Array.from({ length: 3 }, (_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 6 }, (_, j) => (
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
            <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
              No reviews yet.
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
                  {review.verifiedPurchase && <Badge variant="secondary">Verified</Badge>}
                </div>
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">
                {review.comment ?? "—"}
              </TableCell>
              <TableCell className="max-w-64 truncate text-muted-foreground">
                {review.staffReply ?? "—"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {new Date(review.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Reply to review by ${review.authorName}`}
                    onClick={() => onReply(review)}
                  >
                    <MessageSquareReply />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete review by ${review.authorName}`}
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
