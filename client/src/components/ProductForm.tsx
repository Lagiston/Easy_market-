import { useRef, useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  updateProductSchema,
  Role,
  type LocalizedName,
  type UpdateProductFormInput,
  type UpdateProductInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProductRow } from "@/components/ProductsTable";

type Category = { id: string; name: LocalizedName };
type Agent = { id: string; name: string; role: Role };

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
  const { data: agents } = useQuery({
    queryKey: ["users"],
    queryFn: () =>
      axios
        .get<{ users: Agent[] }>("/api/users")
        .then((res) => res.data.users.filter((user) => user.role === Role.AGENT)),
  });

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateProductFormInput, unknown, UpdateProductInput>({
    resolver: zodResolver(product ? updateProductSchema : createProductSchema),
    defaultValues: product
      ? {
          name: { en: product.name.en, ar: product.name.ar ?? "" },
          description: {
            en: product.description?.en ?? "",
            ar: product.description?.ar ?? "",
          },
          price: product.price,
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          categoryId: product.category.id,
          assignedAgentId: product.assignedAgent?.id ?? "",
        }
      : {
          name: { en: "", ar: "" },
          description: { en: "", ar: "" },
          price: 0,
          stock: 0,
          lowStockThreshold: 10,
          categoryId: "",
          assignedAgentId: "",
        },
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

  const enHasError = !!errors.name?.en || !!errors.description?.en;
  const arHasError = !!errors.name?.ar || !!errors.description?.ar;

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
      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="en">
            English
            {enHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
          <TabsTrigger value="ar">
            Arabic
            {arHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="product-form-name-en">Name</Label>
            <Input
              id="product-form-name-en"
              autoComplete="off"
              aria-invalid={!!errors.name?.en}
              {...register("name.en")}
            />
            {errors.name?.en && (
              <p className="text-sm text-destructive">{errors.name.en.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="product-form-description-en">Description</Label>
            <Textarea
              id="product-form-description-en"
              rows={3}
              aria-invalid={!!errors.description?.en}
              {...register("description.en")}
            />
            {errors.description?.en && (
              <p className="text-sm text-destructive">{errors.description.en.message}</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="ar" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="product-form-name-ar">Name</Label>
            <Input
              id="product-form-name-ar"
              dir="rtl"
              autoComplete="off"
              aria-invalid={!!errors.name?.ar}
              {...register("name.ar")}
            />
            {errors.name?.ar && (
              <p className="text-sm text-destructive">{errors.name.ar.message}</p>
            )}
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="product-form-description-ar">Description</Label>
            <Textarea
              id="product-form-description-ar"
              dir="rtl"
              rows={3}
              aria-invalid={!!errors.description?.ar}
              {...register("description.ar")}
            />
            {errors.description?.ar && (
              <p className="text-sm text-destructive">{errors.description.ar.message}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-price">Price</Label>
        <Input
          id="product-form-price"
          type="number"
          min={0}
          step={1}
          aria-invalid={!!errors.price}
          {...register("price", { valueAsNumber: true })}
        />
        {errors.price && (
          <p className="text-sm text-destructive">{errors.price.message}</p>
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
        <Label htmlFor="product-form-low-stock-threshold">Low stock threshold</Label>
        <Input
          id="product-form-low-stock-threshold"
          type="number"
          min={0}
          step={1}
          aria-invalid={!!errors.lowStockThreshold}
          {...register("lowStockThreshold", { valueAsNumber: true })}
        />
        {errors.lowStockThreshold && (
          <p className="text-sm text-destructive">{errors.lowStockThreshold.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-category">Category</Label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger
                id="product-form-category"
                className="w-full"
                aria-invalid={!!errors.categoryId}
              >
                <SelectValue placeholder="Select a category">
                  {(value: string) =>
                    categories?.find((category) => category.id === value)?.name.en ?? ""
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name.en}
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
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-assigned-agent">Assigned agent</Label>
        <Controller
          name="assignedAgentId"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || "unassigned"}
              onValueChange={(value) => field.onChange(value === "unassigned" ? "" : value)}
            >
              <SelectTrigger
                id="product-form-assigned-agent"
                className="w-full"
                aria-invalid={!!errors.assignedAgentId}
              >
                <SelectValue placeholder="Unassigned">
                  {(value: string) =>
                    agents?.find((agent) => agent.id === value)?.name ?? "Unassigned"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {agents?.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    {agent.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.assignedAgentId && (
          <p className="text-sm text-destructive">{errors.assignedAgentId.message}</p>
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
