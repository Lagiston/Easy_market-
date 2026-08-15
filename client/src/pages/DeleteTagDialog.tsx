import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import type { TagRow } from "@/components/TagsTable";
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

export default function DeleteTagDialog({
  tag,
  onOpenChange,
}: {
  tag: TagRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: () => axios.delete(`/api/tags/${tag!.value}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      onOpenChange(false);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : t("admin.tags.deleteDialog.error")
    : null;

  return (
    <AlertDialog
      open={tag !== null}
      onOpenChange={(open) => {
        if (!open) mutation.reset();
        onOpenChange(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {t("admin.tags.deleteDialog.title", { value: tag?.value })}
          </AlertDialogTitle>
          <AlertDialogDescription>{t("admin.tags.deleteDialog.description")}</AlertDialogDescription>
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
