import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import DeleteReviewDialog from "./DeleteReviewDialog";
import ReplyReviewDialog from "./ReplyReviewDialog";
import ReviewsTable, { type ReviewRow } from "@/components/ReviewsTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function ReviewsPage() {
  const [deletingReview, setDeletingReview] = useState<ReviewRow | null>(null);
  const [replyingReview, setReplyingReview] = useState<ReviewRow | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["reviews"],
    queryFn: () =>
      axios.get<{ reviews: ReviewRow[] }>("/api/reviews").then((res) => res.data.reviews),
  });
  const reviews = data ?? null;

  return (
    <Card className="mx-auto max-w-5xl">
      <CardHeader>
        <CardTitle>Reviews</CardTitle>
        <CardDescription>
          {reviews
            ? `${reviews.length} review${reviews.length === 1 ? "" : "s"}`
            : "Customer product reviews"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load reviews. Please try again.
          </p>
        ) : (
          <ReviewsTable reviews={reviews} onDelete={setDeletingReview} onReply={setReplyingReview} />
        )}
        <DeleteReviewDialog
          review={deletingReview}
          onOpenChange={(open) => {
            if (!open) setDeletingReview(null);
          }}
        />
        <ReplyReviewDialog
          review={replyingReview}
          onOpenChange={(open) => {
            if (!open) setReplyingReview(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
