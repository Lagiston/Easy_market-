import { useEffect, useState } from "react";
import axios from "axios";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { BadgeCheck, Pencil, Star, Trash2 } from "lucide-react";
import {
  createReviewSchema,
  updateReviewSchema,
  REVIEW_SORTS,
  REVIEW_COMMENT_MAX_LENGTH,
  type CreateReviewFormInput,
  type UpdateReviewFormInput,
  type ReviewSort,
} from "@es-market/core";
import { customerAuthClient } from "@/lib/customer-auth-client";
import { translateFieldError } from "@/lib/zod-error-i18n";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress, ProgressIndicator, ProgressTrack } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";

export type StorefrontReview = {
  id: string;
  authorName: string;
  rating: number;
  headline: string | null;
  comment: string | null;
  verifiedPurchase: boolean;
  staffReply: string | null;
  staffReplyAt: string | null;
  createdAt: string;
  // True only for the review authored by the signed-in customer viewing it —
  // the server never sends the raw customerId itself (see the storefront GET
  // route), so this is the only signal the client gets for "is this mine".
  isOwnReview: boolean;
};

type ReviewsResponse = {
  reviews: StorefrontReview[];
  // Count matching the current sort/filter combo — drives this view's "show
  // more" pagination. total/averageRating/ratingCounts below always describe
  // *every* review regardless of the current filter, so the header stats
  // don't shift under the customer as they filter/sort the list.
  matchingTotal: number;
  total: number;
  averageRating: number | null;
  // Zero-filled by the server for all five ratings.
  ratingCounts: Record<number, number>;
  page: number;
  pageSize: number;
};

const SORT_LABEL_KEYS: Record<ReviewSort, string> = {
  newest: "reviews.sortNewest",
  highest: "reviews.sortHighest",
  lowest: "reviews.sortLowest",
};

const GLASS_PANEL_CLASS =
  "rounded-[20px] border border-foreground/10 bg-card/60 backdrop-blur-xl reduced-transparency:bg-card reduced-transparency:backdrop-blur-none";

const FORM_CONTROL_CLASS =
  "rounded-xl border-foreground/10 bg-card/40 focus-visible:border-emerald-500 focus-visible:ring-4 focus-visible:ring-emerald-500/[0.16] reduced-transparency:bg-card";

function StarRow({ rating, label }: { rating: number; label: string }) {
  return (
    <span role="img" aria-label={label} className="inline-flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          aria-hidden
          className={cn(
            "size-4",
            star <= rating ? "fill-[#facc15] text-[#facc15]" : "text-muted-foreground/30",
          )}
        />
      ))}
    </span>
  );
}

// Shared interactive star picker for both the create form and the inline edit
// form below — the read-only StarRow above is a different component since it
// renders a decorative <span role="img">, not a set of buttons. Fills up to
// the hovered star (falling back to the selected value when not hovering) so
// the picker previews a rating before it's committed.
function RatingPicker({
  value,
  onChange,
  error,
}: {
  value: number;
  onChange: (rating: number) => void;
  error: string | undefined;
}) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(0);
  const filledUpTo = hovered || value;
  return (
    <div className="grid gap-1.5">
      <Label className="text-[11px] font-semibold tracking-[0.09em] text-muted-foreground uppercase">
        {t("reviews.rating")}
      </Label>
      <div className="flex gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            type="button"
            aria-label={t("reviews.rateStars", { count: star })}
            aria-pressed={star === value}
            onMouseEnter={() => setHovered(star)}
            onClick={() => onChange(star)}
            className="p-0.5"
          >
            <Star
              aria-hidden
              className={cn(
                "size-6 transition-colors",
                star <= filledUpTo ? "fill-[#facc15] text-[#facc15]" : "fill-foreground/[0.13] text-transparent",
              )}
            />
          </button>
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

// Live character counter for the comment field, shared by the create and
// edit forms — takes just the current string value rather than a `register`
// object, sidestepping the two forms' different RHF generic types.
function CommentCounter({ value }: { value: string | undefined }) {
  const { t } = useTranslation();
  const length = (value ?? "").length;
  const isOverLimit = length > REVIEW_COMMENT_MAX_LENGTH;
  return (
    <p
      className={cn("text-end text-xs", isOverLimit ? "text-destructive" : "text-muted-foreground")}
    >
      {t("reviews.commentCount", { count: length, max: REVIEW_COMMENT_MAX_LENGTH })}
    </p>
  );
}

function ReviewAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <span
      aria-hidden
      className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 text-sm font-bold text-white"
    >
      {initial}
    </span>
  );
}

// Inline edit form for a customer's own review, swapped in for the static
// list item — mirrors the create form's fields (RHF + zodResolver against the
// same-shaped updateReviewSchema) but PUTs to the customer-scoped route
// instead of creating a new review. verifiedPurchase is never editable: it's
// a creation-time snapshot the server never recomputes.
function EditReviewForm({
  review,
  reviewsBaseKey,
  onCancel,
}: {
  review: StorefrontReview;
  reviewsBaseKey: unknown[];
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<UpdateReviewFormInput>({
    resolver: zodResolver(updateReviewSchema),
    defaultValues: {
      authorName: review.authorName,
      rating: review.rating,
      headline: review.headline ?? "",
      comment: review.comment ?? "",
    },
  });
  const selectedRating = watch("rating");
  // z.preprocess makes the input-side type of `comment`/`headline` unknown
  // (same gotcha CLAUDE.md documents for …FormInput types generally) —
  // watch()'s return follows suit, so it's cast back to what the field holds.
  const commentValue = watch("comment") as string | undefined;

  const mutation = useMutation({
    mutationFn: (input: UpdateReviewFormInput) =>
      axios.put(`/api/customer/reviews/${review.id}`, input).then((res) => res.data),
    onSuccess: () => {
      // Invalidates every cached sort/filter variant for this product (a
      // TanStack Query prefix match), not just whichever one is currently
      // selected — the edit could affect ratingCounts/averageRating shown
      // under any of them.
      void queryClient.invalidateQueries({ queryKey: reviewsBaseKey });
      onCancel();
    },
  });

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
      className="grid gap-3.5"
    >
      <RatingPicker
        value={typeof selectedRating === "number" ? selectedRating : 0}
        onChange={(rating) => setValue("rating", rating, { shouldValidate: true })}
        error={translateFieldError(errors.rating?.message, t)}
      />
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`edit-review-name-${review.id}`}>{t("reviews.name")}</Label>
          <Input
            id={`edit-review-name-${review.id}`}
            autoComplete="name"
            aria-invalid={!!errors.authorName}
            className={FORM_CONTROL_CLASS}
            {...register("authorName")}
          />
          {errors.authorName && (
            <p className="text-sm text-destructive">
              {translateFieldError(errors.authorName.message, t)}
            </p>
          )}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`edit-review-headline-${review.id}`}>{t("reviews.headline")}</Label>
          <Input
            id={`edit-review-headline-${review.id}`}
            aria-invalid={!!errors.headline}
            className={FORM_CONTROL_CLASS}
            {...register("headline")}
          />
          {errors.headline && (
            <p className="text-sm text-destructive">
              {translateFieldError(errors.headline.message, t)}
            </p>
          )}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`edit-review-comment-${review.id}`}>{t("reviews.comment")}</Label>
        <Textarea
          id={`edit-review-comment-${review.id}`}
          rows={3}
          aria-invalid={!!errors.comment}
          className={FORM_CONTROL_CLASS}
          {...register("comment")}
        />
        <CommentCounter value={commentValue} />
        {errors.comment && (
          <p className="text-sm text-destructive">
            {translateFieldError(errors.comment.message, t)}
          </p>
        )}
      </div>
      {mutation.isError && (
        <p className="text-sm text-destructive">{t("reviews.updateError")}</p>
      )}
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={mutation.isPending}>
          {mutation.isPending ? t("reviews.saving") : t("reviews.saveEdit")}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel}>
          {t("reviews.cancelEdit")}
        </Button>
      </div>
    </form>
  );
}

export default function ProductReviews({ productId }: { productId: string }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: session } = customerAuthClient.useSession();

  const [editingReviewId, setEditingReviewId] = useState<string | null>(null);
  const [deletingReview, setDeletingReview] = useState<StorefrontReview | null>(null);
  const [sort, setSort] = useState<ReviewSort>("newest");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Mutations invalidate by this shorter prefix (a TanStack Query prefix
  // match) so a create/edit/delete refreshes every cached sort/filter variant,
  // not just whichever one happens to be selected right now.
  const reviewsBaseKey = ["storefront", "product", productId, "reviews"];
  // sort/verifiedOnly are part of the key so changing either starts a fresh
  // paginated query at page 1, rather than mixing pages fetched under a
  // different sort/filter combo into one accumulated list.
  const reviewsQueryKey = [...reviewsBaseKey, sort, verifiedOnly];

  // Append-style pagination ("show more"), not numbered pages — matchingTotal
  // (not total, which stays fixed regardless of filter) drives when another
  // page is available.
  const { data, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteQuery({
      queryKey: reviewsQueryKey,
      queryFn: ({ pageParam }) =>
        axios
          .get<ReviewsResponse>(`/api/storefront/products/${productId}/reviews`, {
            params: { page: pageParam, sort, ...(verifiedOnly ? { verifiedOnly: true } : {}) },
          })
          .then((res) => res.data),
      initialPageParam: 1,
      getNextPageParam: (lastPage) =>
        lastPage.page * lastPage.pageSize < lastPage.matchingTotal
          ? lastPage.page + 1
          : undefined,
    });
  const summary = data?.pages[0];
  const reviews = data?.pages.flatMap((reviewsPage) => reviewsPage.reviews) ?? [];

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateReviewFormInput>({
    resolver: zodResolver(createReviewSchema),
    // rating 0 = "not chosen yet" — fails the schema's min(1) on submit, so
    // the rating error shows without needing a separate required check.
    defaultValues: { authorName: "", rating: 0, headline: "", comment: "" },
  });
  const selectedRating = watch("rating");
  // z.preprocess makes the input-side type of `comment`/`headline` unknown
  // (same gotcha CLAUDE.md documents for …FormInput types generally) —
  // watch()'s return follows suit, so it's cast back to what the field holds.
  const commentValue = watch("comment") as string | undefined;

  // Prefills once the session resolves — doesn't overwrite anything the
  // customer has already started typing (a stale-closure guard would need to
  // read the current field value, which isn't worth it for a convenience
  // prefill they can freely edit or clear anyway).
  useEffect(() => {
    if (session?.user.name) setValue("authorName", session.user.name);
  }, [session?.user.name, setValue]);

  const mutation = useMutation({
    mutationFn: (input: CreateReviewFormInput) =>
      axios
        .post(`/api/storefront/products/${productId}/reviews`, input)
        .then((res) => res.data),
    onSuccess: () => {
      reset();
      void queryClient.invalidateQueries({ queryKey: reviewsBaseKey });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (reviewId: string) => axios.delete(`/api/customer/reviews/${reviewId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: reviewsBaseKey });
      setDeletingReview(null);
    },
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(260px,340px)_1fr]">
      <div className={cn(GLASS_PANEL_CLASS, "h-fit space-y-4 p-6 lg:sticky lg:top-6")}>
        <h2 className="text-lg font-bold text-foreground">{t("reviews.title")}</h2>
        {summary && summary.averageRating !== null ? (
          <>
            <div className="flex items-center gap-3">
              <span className="text-[46px] leading-none font-black tracking-[-0.04em] text-foreground">
                {summary.averageRating.toFixed(1)}
              </span>
              <div className="space-y-1">
                <StarRow
                  rating={Math.round(summary.averageRating)}
                  label={t("reviews.averageLabel", {
                    average: summary.averageRating.toFixed(1),
                  })}
                />
                <p className="text-sm text-muted-foreground">
                  {t("reviews.count", { count: summary.total })}
                </p>
              </div>
            </div>
            <div className="space-y-1.5">
              {[5, 4, 3, 2, 1].map((star) => {
                const count = summary.ratingCounts[star] ?? 0;
                const percent = summary.total > 0 ? (count / summary.total) * 100 : 0;
                return (
                  <div
                    key={star}
                    className="grid grid-cols-[34px_1fr_26px] items-center gap-2.5 text-xs text-muted-foreground"
                  >
                    <span className="text-right">{star} ★</span>
                    <Progress
                      value={percent}
                      aria-label={t("reviews.starDistribution", { star, count })}
                      className="w-full"
                    >
                      <ProgressTrack className="h-1.5 bg-foreground/[0.07]">
                        <ProgressIndicator className="bg-gradient-to-r from-emerald-500 to-emerald-400" />
                      </ProgressTrack>
                    </Progress>
                    <span className="text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{t("reviews.empty")}</p>
        )}
      </div>

      <div className="space-y-4">
        {summary && summary.total > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <Select value={sort} onValueChange={(value) => setSort(value as ReviewSort)}>
              <SelectTrigger
                id="review-sort"
                aria-label={t("reviews.sortLabel")}
                className={cn(FORM_CONTROL_CLASS, "min-w-40")}
              >
                <SelectValue>{t(SORT_LABEL_KEYS[sort])}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {REVIEW_SORTS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {t(SORT_LABEL_KEYS[option])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Label
              className={cn(
                "inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-card/60 px-3.5 py-2 text-sm text-muted-foreground backdrop-blur-xl transition-colors has-data-checked:border-emerald-500 has-data-checked:bg-emerald-500/10 has-data-checked:text-foreground reduced-transparency:bg-card",
              )}
            >
              <Checkbox
                id="verified-only"
                checked={verifiedOnly}
                onCheckedChange={(checked) => setVerifiedOnly(checked === true)}
              />
              {t("reviews.verifiedOnly")}
            </Label>
          </div>
        )}

        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-24 w-full rounded-2xl" />
            <Skeleton className="h-24 w-full rounded-2xl" />
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{t("reviews.error")}</p>
        ) : reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {/* Reviews exist overall but none match the current filter, vs. the
                product having no reviews at all — different messages so a
                verified-only filter doesn't look like "be the first". */}
            {summary && summary.total > 0 ? t("reviews.noMatch") : t("reviews.empty")}
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((review) =>
              editingReviewId === review.id ? (
                <li key={review.id} className={cn(GLASS_PANEL_CLASS, "rounded-2xl p-5")}>
                  <EditReviewForm
                    review={review}
                    reviewsBaseKey={reviewsBaseKey}
                    onCancel={() => setEditingReviewId(null)}
                  />
                </li>
              ) : (
                <li key={review.id} className={cn(GLASS_PANEL_CLASS, "rounded-2xl p-5")}>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <ReviewAvatar name={review.authorName} />
                    <span className="text-sm font-semibold text-foreground">
                      {review.authorName}
                    </span>
                    {review.verifiedPurchase && (
                      <Badge className="border-emerald-600/30 bg-emerald-500/15 text-emerald-700 dark:border-emerald-500/30 dark:text-emerald-400">
                        <BadgeCheck aria-hidden className="size-3" />
                        {t("reviews.verifiedPurchase")}
                      </Badge>
                    )}
                    <span className="ms-auto text-xs text-muted-foreground">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    {review.isOwnReview && (
                      <div className="flex items-center gap-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("reviews.editAria")}
                          onClick={() => setEditingReviewId(review.id)}
                        >
                          <Pencil />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("reviews.deleteAria")}
                          onClick={() => setDeletingReview(review)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    )}
                  </div>
                  <StarRow
                    rating={review.rating}
                    label={t("reviews.ratingLabel", { rating: review.rating })}
                  />
                  {review.headline && (
                    <p className="mt-2 font-semibold text-foreground">{review.headline}</p>
                  )}
                  {review.comment && (
                    <p className="mt-1.5 text-[14.5px] leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {review.comment}
                    </p>
                  )}
                  {review.staffReply && (
                    <div className="mt-3 ms-6 rounded-md border-s-2 border-emerald-500 bg-muted/50 p-3">
                      <p className="text-xs font-medium text-muted-foreground">
                        {t("reviews.staffReplyLabel")}
                      </p>
                      <p className="mt-1 text-sm whitespace-pre-wrap">{review.staffReply}</p>
                    </div>
                  )}
                </li>
              ),
            )}
          </ul>
        )}

        {hasNextPage && (
          <Button
            type="button"
            variant="outline"
            disabled={isFetchingNextPage}
            onClick={() => void fetchNextPage()}
          >
            {isFetchingNextPage ? t("reviews.loadingMore") : t("reviews.showMore")}
          </Button>
        )}

        <AlertDialog
          open={deletingReview !== null}
          onOpenChange={(open) => {
            if (!open) {
              deleteMutation.reset();
              setDeletingReview(null);
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("reviews.deleteConfirmTitle")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("reviews.deleteConfirmDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            {deleteMutation.isError && (
              <p className="text-sm text-destructive">{t("reviews.deleteError")}</p>
            )}
            <AlertDialogFooter>
              <AlertDialogCancel>{t("reviews.deleteCancelButton")}</AlertDialogCancel>
              <AlertDialogAction
                variant="destructive"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate(deletingReview!.id)}
              >
                {deleteMutation.isPending
                  ? t("reviews.saving")
                  : t("reviews.deleteConfirmButton")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Card className={cn(GLASS_PANEL_CLASS, "rounded-[20px] p-6")}>
          <h3 className="mb-4 font-bold text-foreground">{t("reviews.formTitle")}</h3>
          <form
            noValidate
            onSubmit={handleSubmit((input) => mutation.mutate(input))}
            className="grid gap-3.5"
          >
            <RatingPicker
              value={typeof selectedRating === "number" ? selectedRating : 0}
              onChange={(rating) => setValue("rating", rating, { shouldValidate: true })}
              error={translateFieldError(errors.rating?.message, t)}
            />
            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
              <div className="grid gap-1.5">
                <Label htmlFor="review-name">{t("reviews.name")}</Label>
                <Input
                  id="review-name"
                  autoComplete="name"
                  aria-invalid={!!errors.authorName}
                  className={FORM_CONTROL_CLASS}
                  {...register("authorName")}
                />
                {errors.authorName && (
                  <p className="text-sm text-destructive">
                    {translateFieldError(errors.authorName.message, t)}
                  </p>
                )}
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="review-headline">{t("reviews.headline")}</Label>
                <Input
                  id="review-headline"
                  aria-invalid={!!errors.headline}
                  className={FORM_CONTROL_CLASS}
                  {...register("headline")}
                />
                {errors.headline && (
                  <p className="text-sm text-destructive">
                    {translateFieldError(errors.headline.message, t)}
                  </p>
                )}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="review-comment">{t("reviews.comment")}</Label>
              <Textarea
                id="review-comment"
                rows={3}
                className={cn(FORM_CONTROL_CLASS, "min-h-24")}
                aria-invalid={!!errors.comment}
                {...register("comment")}
              />
              <CommentCounter value={commentValue} />
              {errors.comment && (
                <p className="text-sm text-destructive">
                  {translateFieldError(errors.comment.message, t)}
                </p>
              )}
            </div>
            {mutation.isError && (
              <p className="text-sm text-destructive">
                {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 409
                  ? t("reviews.alreadyReviewed")
                  : t("reviews.submitError")}
              </p>
            )}
            {mutation.isSuccess && (
              <p className="text-sm text-emerald-600 dark:text-emerald-400">
                {t("reviews.success")}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="submit"
                disabled={mutation.isPending}
                className="w-auto bg-emerald-500 text-[#07130c] hover:bg-emerald-400"
              >
                {mutation.isPending ? t("reviews.submitting") : t("reviews.submit")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("reviews.postedPubliclyNote")}</p>
            </div>
          </form>
        </Card>
      </div>
    </div>
  );
}
