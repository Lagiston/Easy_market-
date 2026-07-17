import ProductForm from "@/components/ProductForm";
import ProductImageUpload from "@/components/ProductImageUpload";
import type { ProductRow } from "@/components/ProductsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditProductDialog({
  product,
  onOpenChange,
}: {
  product: ProductRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={product !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit product</DialogTitle>
          <DialogDescription>Update the product details.</DialogDescription>
        </DialogHeader>
        {product && (
          <>
            <ProductImageUpload productId={product.id} imageUrl={product.imageUrl} />
            <ProductForm product={product} onSuccess={() => onOpenChange(false)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
