import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { ReviewRow } from "@/components/ReviewsTable";
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

export default function DeleteReviewDialog({
  review,
  onOpenChange,
}: {
  review: ReviewRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => axios.delete(`/api/reviews/${review!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      onOpenChange(false);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.reviews.deleteDialog.error")
    : null;

  return (
    <AlertDialog
      open={review !== null}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("admin.reviews.deleteDialog.title", {
              author: review?.authorName,
              product: review?.product.name.en,
            })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("admin.reviews.deleteDialog.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        {serverError && <p className="text-sm text-destructive">{serverError}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel>{t("admin.common.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? t("admin.common.deleting") : t("admin.common.delete")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
