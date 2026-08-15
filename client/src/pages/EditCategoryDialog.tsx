import { useTranslation } from "react-i18next";
import CategoryForm from "@/components/CategoryForm";
import type { CategoryRow } from "@/components/CategoriesTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditCategoryDialog({
  category,
  onOpenChange,
}: {
  category: CategoryRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={category !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.categories.editDialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.categories.editDialog.description")}</DialogDescription>
        </DialogHeader>
        {category && (
          <CategoryForm category={category} onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
