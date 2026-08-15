import { useTranslation } from "react-i18next";
import PromoBlockForm from "@/components/PromoBlockForm";
import type { PromoBlockRow } from "@/components/PromoBlocksTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditPromoBlockDialog({
  promoBlock,
  onOpenChange,
}: {
  promoBlock: PromoBlockRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open={promoBlock !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.promoBlocks.editDialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.promoBlocks.editDialog.description")}</DialogDescription>
        </DialogHeader>
        {promoBlock && (
          <PromoBlockForm promoBlock={promoBlock} onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
