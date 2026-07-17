import { useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  updateProductSchema,
  type UpdateProductInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductRow } from "@/components/ProductsTable";

type Category = { id: string; name: string };

export default function ProductForm({
  product,
  onSuccess,
}: {
  product?: ProductRow;
  onSuccess?: (product: ProductRow) => void;
}) {
  const queryClient = useQueryClient();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const pendingProductRef = useRef<ProductRow | null>(null);
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      axios
        .get<{ categories: Category[] }>("/api/categories")
        .then((res) => res.data.categories),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProductInput>({
    resolver: zodResolver(product ? updateProductSchema : createProductSchema),
    defaultValues: product
      ? {
          name: product.name,
          description: product.description ?? "",
          stock: product.stock,
          categoryId: product.category.id,
        }
      : { name: "", description: "", stock: 0, categoryId: "" },
  });

  const mutation = useMutation({
    mutationFn: async (input: UpdateProductInput) => {
      if (product) {
        return axios
          .put(`/api/products/${product.id}`, input)
          .then((res) => res.data.product as ProductRow);
      }

      if (!pendingProductRef.current) {
        pendingProductRef.current = await axios
          .post("/api/products", input)
          .then((res) => res.data.product as ProductRow);
        // Refresh the list now, even if the image upload below fails, so the
        // row isn't stuck missing from the table until an unrelated refetch.
        queryClient.invalidateQueries({ queryKey: ["products"] });
      }
      const created = pendingProductRef.current!;

      const formData = new FormData();
      formData.append("image", imageFile!);
      return axios
        .post(`/api/products/${created.id}/image`, formData)
        .then((res) => res.data.product as ProductRow);
    },
    onSuccess: (product) => {
      pendingProductRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["products"] });
      onSuccess?.(product);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : `Could not ${product ? "update" : "create"} the product. Please try again.`
    : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => {
        if (!product && !imageFile) {
          setImageError("An image is required");
          return;
        }
        mutation.mutate(input);
      })}
      className="grid gap-4"
    >
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-name">Name</Label>
        <Input
          id="product-form-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-description">Description</Label>
        <Textarea
          id="product-form-description"
          rows={3}
          aria-invalid={!!errors.description}
          {...register("description")}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-stock">Stock</Label>
        <Input
          id="product-form-stock"
          type="number"
          min={0}
          step={1}
          aria-invalid={!!errors.stock}
          {...register("stock", { valueAsNumber: true })}
        />
        {errors.stock && (
          <p className="text-sm text-destructive">{errors.stock.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-category">Category</Label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="product-form-category" aria-invalid={!!errors.categoryId}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.categoryId && (
          <p className="text-sm text-destructive">{errors.categoryId.message}</p>
        )}
      </div>
      {!product && (
        <div className="grid gap-1.5">
          <Label htmlFor="product-form-image">Image</Label>
          <Input
            id="product-form-image"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            aria-invalid={!!imageError}
            onChange={(event) => {
              const file = event.target.files?.[0] ?? null;
              setImageFile(file);
              if (file) setImageError(null);
            }}
          />
          {imageError && <p className="text-sm text-destructive">{imageError}</p>}
        </div>
      )}
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {product
            ? mutation.isPending
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Creating…"
              : "Create product"}
        </Button>
      </DialogFooter>
    </form>
  );
}
