import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { CategoryRow } from "@/components/CategoriesTable";
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

export default function DeleteCategoryDialog({
  category,
  onOpenChange,
}: {
  category: CategoryRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => axios.delete(`/api/categories/${category!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onOpenChange(false);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.categories.deleteDialog.error")
    : null;

  return (
    <AlertDialog
      open={category !== null}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("admin.categories.deleteDialog.title", { name: category?.name.en })}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t("admin.categories.deleteDialog.description")}
          </AlertDialogDescription>
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
