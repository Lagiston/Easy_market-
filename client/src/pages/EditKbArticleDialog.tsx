import { useTranslation } from "react-i18next";
import KbArticleForm from "@/components/KbArticleForm";
import type { KbArticleRow } from "@/components/KbArticlesTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditKbArticleDialog({
  kbArticle,
  onOpenChange,
}: {
  kbArticle: KbArticleRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={kbArticle !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.kbArticles.editDialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.kbArticles.editDialog.description")}</DialogDescription>
        </DialogHeader>
        {kbArticle && (
          <KbArticleForm kbArticle={kbArticle} onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
