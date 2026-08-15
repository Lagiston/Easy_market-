import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import KbArticleForm from "@/components/KbArticleForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateKbArticleDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> {t("admin.kbArticles.createDialog.trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.kbArticles.createDialog.trigger")}</DialogTitle>
          <DialogDescription>{t("admin.kbArticles.createDialog.description")}</DialogDescription>
        </DialogHeader>
        <KbArticleForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
