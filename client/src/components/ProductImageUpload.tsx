import { useRef } from "react";
import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ImageOff, X } from "lucide-react";
import { MAX_PRODUCT_IMAGES } from "@es-market/core";
import { Button } from "@/components/ui/button";
import type { ProductRow } from "@/components/ProductsTable";

export default function ProductImageUpload({
  productId,
  images,
  onUploaded,
}: {
  productId: string;
  images: string[];
  onUploaded?: (product: ProductRow) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: (files: File[]) => {
      const formData = new FormData();
      for (const file of files) formData.append("images", file);
      return axios
        .post(`/api/products/${productId}/images`, formData)
        .then((res) => res.data.product as ProductRow);
    },
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onUploaded?.(product);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (imageUrl: string) =>
      axios
        .delete(`/api/products/${productId}/images/${imageUrl.split("/").pop()}`)
        .then((res) => res.data.product as ProductRow),
    onSuccess: (product) => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onUploaded?.(product);
    },
  });

  const error = uploadMutation.isError
    ? axios.isAxiosError(uploadMutation.error) && uploadMutation.error.response?.data?.error
      ? String(uploadMutation.error.response.data.error)
      : t("admin.products.imageUpload.uploadError")
    : deleteMutation.isError
      ? axios.isAxiosError(deleteMutation.error) && deleteMutation.error.response?.data?.error
        ? String(deleteMutation.error.response.data.error)
        : t("admin.products.imageUpload.removeError")
      : null;

  const atLimit = images.length >= MAX_PRODUCT_IMAGES;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        {images.map((imageUrl) => (
          <div key={imageUrl} className="group relative">
            <img
              src={imageUrl}
              alt=""
              className="size-16 rounded-md border bg-white object-cover"
            />
            <button
              type="button"
              aria-label={t("admin.products.imageUpload.removeAria")}
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(imageUrl)}
              className="absolute -end-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full border bg-background text-muted-foreground hover:text-destructive"
            >
              <X className="size-3" />
            </button>
          </div>
        ))}
        {images.length === 0 && (
          <div
            aria-label={t("admin.products.imageUpload.noImageAria")}
            className="flex size-16 items-center justify-center rounded-md border bg-muted"
          >
            <ImageOff className="size-5 text-muted-foreground" />
          </div>
        )}
      </div>
      <div>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          aria-label={t("admin.products.imageUpload.productImagesAria")}
          className="sr-only"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []);
            event.target.value = "";
            if (files.length > 0) uploadMutation.mutate(files);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploadMutation.isPending || atLimit}
          onClick={() => inputRef.current?.click()}
        >
          {uploadMutation.isPending
            ? t("admin.products.imageUpload.uploading")
            : atLimit
              ? t("admin.products.imageUpload.maxReached", { max: MAX_PRODUCT_IMAGES })
              : t("admin.products.imageUpload.addImages")}
        </Button>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
