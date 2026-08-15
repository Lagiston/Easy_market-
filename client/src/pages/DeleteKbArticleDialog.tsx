import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { KbArticleRow } from "@/components/KbArticlesTable";
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

export default function DeleteKbArticleDialog({
  kbArticle,
  onOpenChange,
}: {
  kbArticle: KbArticleRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => axios.delete(`/api/kb-articles/${kbArticle!.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["kb-articles"] });
      onOpenChange(false);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.kbArticles.deleteDialog.error")
    : null;

  return (
    <AlertDialog
      open={kbArticle !== null}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("admin.kbArticles.deleteDialog.title", { title: kbArticle?.title.en })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("admin.kbArticles.deleteDialog.description")}</AlertDialogDescription>
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
