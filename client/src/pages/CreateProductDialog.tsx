import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import ProductForm from "@/components/ProductForm";
import ProductImageUpload from "@/components/ProductImageUpload";
import type { ProductRow } from "@/components/ProductsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateProductDialog() {
  const [open, setOpen] = useState(false);
  const [createdProduct, setCreatedProduct] = useState<ProductRow | null>(null);

  function close() {
    setOpen(false);
    setCreatedProduct(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setCreatedProduct(null);
      }}
    >
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Create product
      </DialogTrigger>
      <DialogContent>
        {createdProduct ? (
          <>
            <DialogHeader>
              <DialogTitle>Add a photo</DialogTitle>
              <DialogDescription>
                Add a photo to finish setting up {createdProduct.name}.
              </DialogDescription>
            </DialogHeader>
            <ProductImageUpload
              productId={createdProduct.id}
              imageUrl={createdProduct.imageUrl}
              onUploaded={close}
            />
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Create product</DialogTitle>
              <DialogDescription>Add a product to the catalog.</DialogDescription>
            </DialogHeader>
            <ProductForm onSuccess={setCreatedProduct} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
