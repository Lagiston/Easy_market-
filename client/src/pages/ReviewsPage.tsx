import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        <CardTitle>{t("admin.reviews.title")}</CardTitle>
        <CardDescription>
          {reviews
            ? t("admin.reviews.subtitleCount", { count: reviews.length })
            : t("admin.reviews.subtitleFallback")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.reviews.loadError")}
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
