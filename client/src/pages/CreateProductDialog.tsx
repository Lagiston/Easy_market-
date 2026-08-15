import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductForm from "@/components/ProductForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateProductDialog() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> {t("admin.products.createDialog.trigger")}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.products.createDialog.trigger")}</DialogTitle>
          <DialogDescription>{t("admin.products.createDialog.description")}</DialogDescription>
        </DialogHeader>
        <ProductForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
