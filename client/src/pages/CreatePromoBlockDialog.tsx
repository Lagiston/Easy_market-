import { useState } from "react";
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
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Create promo block
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create promo block</DialogTitle>
          <DialogDescription>
            Add a promotional block to the storefront homepage.
          </DialogDescription>
        </DialogHeader>
        <PromoBlockForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
