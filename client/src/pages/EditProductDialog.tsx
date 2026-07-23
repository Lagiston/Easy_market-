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
  onProductChange,
}: {
  product: ProductRow | null;
  onOpenChange: (open: boolean) => void;
  // Keeps the currently-open dialog's `product` prop (owned by the parent
  // page) in sync when the image gallery adds/removes an image — otherwise
  // the dialog would keep showing the pre-upload snapshot until closed and
  // reopened, since it doesn't itself re-read the products query cache.
  onProductChange?: (product: ProductRow) => void;
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
            <ProductImageUpload
              productId={product.id}
              images={product.images}
              onUploaded={onProductChange}
            />
            <ProductForm product={product} onSuccess={() => onOpenChange(false)} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
