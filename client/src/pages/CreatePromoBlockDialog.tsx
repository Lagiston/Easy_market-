import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import PromoBlockForm from "@/components/PromoBlockForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreatePromoBlockDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> {t("admin.promoBlocks.createDialog.trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.promoBlocks.createDialog.trigger")}</DialogTitle>
          <DialogDescription>{t("admin.promoBlocks.createDialog.description")}</DialogDescription>
        </DialogHeader>
        <PromoBlockForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
