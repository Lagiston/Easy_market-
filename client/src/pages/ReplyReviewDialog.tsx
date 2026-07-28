import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
      : "Could not save the reply. Please try again."
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
          <DialogTitle>Reply to {review?.authorName}&apos;s review</DialogTitle>
          <DialogDescription>
            Visible publicly under the review on {review?.product.name.en}&apos;s page.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={handleSubmit((input) => saveMutation.mutate(input))}
          className="grid gap-4"
        >
          <div className="grid gap-1.5">
            <Label htmlFor="staff-reply">Reply</Label>
            <Textarea id="staff-reply" rows={4} {...register("reply")} />
            {errors.reply && (
              <p className="text-sm text-destructive">{errors.reply.message}</p>
            )}
          </div>
          {serverError && <p className="text-sm text-destructive">{serverError}</p>}
          {clearMutation.isError && (
            <p className="text-sm text-destructive">
              Could not clear the reply. Please try again.
            </p>
          )}
          <DialogFooter>
            {review?.staffReply && (
              <Button
                type="button"
                variant="outline"
                disabled={clearMutation.isPending || saveMutation.isPending}
                onClick={() => clearMutation.mutate()}
              >
                {clearMutation.isPending ? "Clearing…" : "Clear reply"}
              </Button>
            )}
            <Button type="submit" disabled={saveMutation.isPending || clearMutation.isPending}>
              {saveMutation.isPending ? "Saving…" : "Save reply"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
