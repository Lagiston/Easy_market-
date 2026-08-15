import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CategoryForm from "@/components/CategoryForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateCategoryDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> {t("admin.categories.createDialog.trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.categories.createDialog.trigger")}</DialogTitle>
          <DialogDescription>{t("admin.categories.createDialog.description")}</DialogDescription>
        </DialogHeader>
        <CategoryForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
