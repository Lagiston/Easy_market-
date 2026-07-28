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
  return (
    <Dialog open={promoBlock !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit promo block</DialogTitle>
          <DialogDescription>Update the promo block content.</DialogDescription>
        </DialogHeader>
        {promoBlock && (
          <PromoBlockForm promoBlock={promoBlock} onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
