import { useTranslation } from "react-i18next";
import TagForm from "@/components/TagForm";
import type { TagRow } from "@/components/TagsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditTagDialog({
  tag,
  onOpenChange,
}: {
  tag: TagRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={tag !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.tags.editDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("admin.tags.editDialog.description", { value: tag?.value })}
          </DialogDescription>
        </DialogHeader>
        {tag && <TagForm tag={tag} onSuccess={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
