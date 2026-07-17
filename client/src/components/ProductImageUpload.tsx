import { useRef } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageOff } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import type { ProductRow } from "@/components/ProductsTable";

export default function ProductImageUpload({
  productId,
  imageUrl,
  onUploaded,
}: {
  productId: string;
  imageUrl: string | null;
  onUploaded?: (product: ProductRow) => void;
}) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const mutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append("image", file);
      return axios
        .post(`/api/products/${productId}/image`, formData)
        .then((res) => res.data.product as ProductRow);
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onUploaded?.(product);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : "Could not upload the image. Please try again."
    : null;

  return (
    <div className="grid gap-3">
      <div className="flex items-center gap-3">
        <Avatar size="lg">
          {imageUrl && <AvatarImage src={imageUrl} alt="" />}
          <AvatarFallback aria-label="No image">
            <ImageOff className="size-5" />
          </AvatarFallback>
        </Avatar>
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-label="Product image"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) mutation.mutate(file);
              event.target.value = "";
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={mutation.isPending}
            onClick={() => inputRef.current?.click()}
          >
            {mutation.isPending
              ? "Uploading…"
              : imageUrl
                ? "Change image"
                : "Upload image"}
          </Button>
        </div>
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
    </div>
  );
}
