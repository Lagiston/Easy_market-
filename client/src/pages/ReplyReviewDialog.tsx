import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { staffReplySchema, type StaffReplyFormInput } from "@es-market/core";
import type { ReviewRow } from "@/components/ReviewsTable";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ReplyReviewDialog({
  review,
  onOpenChange,
}: {
  review: ReviewRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<StaffReplyFormInput>({
    resolver: zodResolver(staffReplySchema),
    values: { reply: review?.staffReply ?? "" },
  });

  const saveMutation = useMutation({
    mutationFn: (input: StaffReplyFormInput) =>
      axios.post(`/api/reviews/${review!.id}/reply`, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      onOpenChange(false);
    },
  });

  const clearMutation = useMutation({
    mutationFn: () => axios.delete(`/api/reviews/${review!.id}/reply`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["reviews"] });
      onOpenChange(false);
    },
  });

  const serverError = saveMutation.isError
    ? axios.isAxiosError(saveMutation.error) && saveMutation.error.response?.data?.error
      ? String(saveMutation.error.response.data.error)
      : t("admin.reviews.replyDialog.saveError")
    : null;

  return (
    <Dialog
      open={review !== null}
      onOpenChange={(open) => {
        if (!open) {
          reset();
          saveMutation.reset();
          clearMutation.reset();
        }
        onOpenChange(open);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.reviews.replyDialog.title", { author: review?.authorName })}</DialogTitle>
          <DialogDescription>
            {t("admin.reviews.replyDialog.description", { product: review?.product.name.en })}
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((input) => saveMutation.mutate(input))}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="staff-reply">{t("admin.reviews.replyDialog.reply")}</Label>
            <Textarea id="staff-reply" rows={4} {...register("reply")} />
            {errors.reply && (
              <p className="text-sm text-destructive">{errors.reply.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          {clearMutation.isError && (
            <p className="text-sm text-destructive">{t("admin.reviews.replyDialog.clearError")}</p>
          )}
          <DialogFooter>
            {review?.staffReply && (
              <Button
                type="button"
                variant="outline"
                disabled={clearMutation.isPending || saveMutation.isPending}
                onClick={() => clearMutation.mutate()}
              >
                {clearMutation.isPending
                  ? t("admin.reviews.replyDialog.clearing")
                  : t("admin.reviews.replyDialog.clear")}
              </Button>
            )}
            <Button type="submit" disabled={saveMutation.isPending || clearMutation.isPending}>
              {saveMutation.isPending
                ? t("admin.reviews.replyDialog.saving")
                : t("admin.reviews.replyDialog.save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
