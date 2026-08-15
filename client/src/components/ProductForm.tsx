import { useRef, useState } from "react";
import { ImageOff, X } from "lucide-react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createProductSchema,
  updateProductSchema,
  MAX_PRODUCT_IMAGES,
  Role,
  type LocalizedName,
  type ProductClassification,
  type UpdateProductFormInput,
  type UpdateProductInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { pingClassificationAccepted } from "@/lib/product-classification";
import { useStoreSettings } from "@/lib/settings-context";

type Category = { id: string; name: LocalizedName };
type Agent = { id: string; name: string; role: Role };

export default function ProductForm({
  product,
  onSuccess,
}: {
  product?: ProductRow;
  onSuccess?: (product: ProductRow) => void;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { defaultLowStockThreshold } = useStoreSettings();
  const [imageFiles, setImageFiles] = useState<File[]>([]);
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
    getValues,
    setValue,
    watch,
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
          salePrice: product.salePrice ?? "",
          stock: product.stock,
          lowStockThreshold: product.lowStockThreshold,
          categoryId: product.category.id,
          assignedAgentId: product.assignedAgent?.id ?? "",
          tags: product.tags,
          size: product.size ?? "",
          color: product.color ?? "",
        }
      : {
          name: { en: "", ar: "" },
          description: { en: "", ar: "" },
          price: 0,
          salePrice: "",
          stock: 0,
          lowStockThreshold: defaultLowStockThreshold,
          categoryId: "",
          assignedAgentId: "",
          tags: [],
          size: "",
          color: "",
        },
  });

  const nameEn = watch("name.en");
  const watchedTags = watch("tags") ?? [];

  const classifyMutation = useMutation({
    mutationFn: async () =>
      axios
        .post<ProductClassification>("/api/ai/classify-product", {
          name: getValues("name.en"),
          description: getValues("description.en") || undefined,
        })
        .then((res) => res.data),
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
      for (const file of imageFiles) formData.append("images", file);
      return axios
        .post(`/api/products/${created.id}/images`, formData)
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
      : product
        ? t("admin.products.form.updateError")
        : t("admin.products.form.createError")
    : null;

  const enHasError = !!errors.name?.en || !!errors.description?.en;
  const arHasError = !!errors.name?.ar || !!errors.description?.ar;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => {
        if (!product && imageFiles.length === 0) {
          setImageError(t("admin.products.form.imageRequired"));
          return;
        }
        mutation.mutate(input);
      })}
      className="grid gap-4"
    >
      <Tabs defaultValue="en">
        <TabsList>
          <TabsTrigger value="en">
            {t("admin.products.form.english")}
            {enHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
          <TabsTrigger value="ar">
            {t("admin.products.form.arabic")}
            {arHasError && (
              <span className="size-1.5 rounded-full bg-destructive" aria-hidden="true" />
            )}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="en" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="product-form-name-en">{t("admin.products.form.nameEn")}</Label>
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
            <Label htmlFor="product-form-description-en">
              {t("admin.products.form.descriptionEn")}
            </Label>
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
            <Label htmlFor="product-form-name-ar">{t("admin.products.form.nameAr")}</Label>
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
            <Label htmlFor="product-form-description-ar">
              {t("admin.products.form.descriptionAr")}
            </Label>
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
        <Label htmlFor="product-form-price">{t("admin.products.form.price")}</Label>
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
        <Label htmlFor="product-form-sale-price">{t("admin.products.form.salePrice")}</Label>
        <Input
          id="product-form-sale-price"
          type="number"
          min={0}
          step={1}
          placeholder={t("admin.products.form.salePricePlaceholder")}
          aria-invalid={!!errors.salePrice}
          {...register("salePrice", { valueAsNumber: true })}
        />
        {errors.salePrice && (
          <p className="text-sm text-destructive">{errors.salePrice.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-stock">{t("admin.products.form.stock")}</Label>
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
        <Label htmlFor="product-form-low-stock-threshold">
          {t("admin.products.form.lowStockThreshold")}
        </Label>
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
      <div className="grid gap-2 rounded-md border p-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium">{t("admin.products.form.aiSuggestionsHeading")}</p>
          <div className="flex gap-2">
            {classifyMutation.isSuccess && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => classifyMutation.reset()}
              >
                {t("admin.products.form.dismiss")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!nameEn?.trim() || classifyMutation.isPending}
              onClick={() => classifyMutation.mutate()}
            >
              {classifyMutation.isPending
                ? t("admin.products.form.suggesting")
                : t("admin.products.form.suggestWithAi")}
            </Button>
          </div>
        </div>
        {classifyMutation.isError && (
          <p className="text-sm text-destructive">
            {axios.isAxiosError(classifyMutation.error) &&
            classifyMutation.error.response?.data?.error
              ? String(classifyMutation.error.response.data.error)
              : t("admin.products.form.aiError")}
          </p>
        )}
        {classifyMutation.isSuccess && (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("admin.products.table.categoryPrefix")}
              </span>
              {classifyMutation.data.categoryId ? (
                <>
                  <span>
                    {
                      categories?.find(
                        (category) => category.id === classifyMutation.data!.categoryId,
                      )?.name.en
                    }
                  </span>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setValue("categoryId", classifyMutation.data!.categoryId!, {
                        shouldValidate: true,
                        shouldDirty: true,
                      });
                      pingClassificationAccepted("category");
                    }}
                  >
                    {t("admin.products.form.apply")}
                  </Button>
                </>
              ) : (
                <span className="text-muted-foreground">
                  {t("admin.products.form.noConfidentMatch")}
                </span>
              )}
            </div>
            {classifyMutation.data.tags.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">{t("admin.products.form.tagsLabel")}</span>
                {classifyMutation.data.tags.map((tag) => {
                  const alreadyAdded = watchedTags.includes(tag);
                  return (
                    <Button
                      key={tag}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-6 px-2 text-xs"
                      disabled={alreadyAdded}
                      onClick={() => {
                        setValue("tags", [...watchedTags, tag], {
                          shouldValidate: true,
                          shouldDirty: true,
                        });
                        pingClassificationAccepted("tag");
                      }}
                    >
                      {alreadyAdded ? tag : `+ ${tag}`}
                    </Button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-category">{t("admin.products.form.category")}</Label>
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
                <SelectValue placeholder={t("admin.products.form.categoryPlaceholder")}>
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
        <Label htmlFor="product-form-tag-input">{t("admin.products.form.tags")}</Label>
        <Controller
          name="tags"
          control={control}
          render={({ field }) => {
            const tags = field.value ?? [];
            return (
              <div className="grid gap-2">
                {tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="gap-1 pe-1">
                        {tag}
                        <button
                          type="button"
                          aria-label={t("admin.products.form.removeTagAria", { tag })}
                          onClick={() => field.onChange(tags.filter((t) => t !== tag))}
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
                <Input
                  id="product-form-tag-input"
                  placeholder={t("admin.products.form.tagInputPlaceholder")}
                  aria-invalid={!!errors.tags}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    const value = event.currentTarget.value.trim().toLowerCase();
                    if (value && !tags.includes(value)) {
                      field.onChange([...tags, value]);
                    }
                    event.currentTarget.value = "";
                  }}
                />
              </div>
            );
          }}
        />
        {errors.tags && <p className="text-sm text-destructive">{errors.tags.message}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="product-form-size">{t("admin.products.form.size")}</Label>
          <Input
            id="product-form-size"
            placeholder={t("admin.products.form.sizePlaceholder")}
            aria-invalid={!!errors.size}
            {...register("size")}
          />
          {errors.size && <p className="text-sm text-destructive">{errors.size.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="product-form-color">{t("admin.products.form.color")}</Label>
          <Input
            id="product-form-color"
            placeholder={t("admin.products.form.colorPlaceholder")}
            aria-invalid={!!errors.color}
            {...register("color")}
          />
          {errors.color && <p className="text-sm text-destructive">{errors.color.message}</p>}
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="product-form-assigned-agent">
          {t("admin.products.form.assignedAgent")}
        </Label>
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
                <SelectValue placeholder={t("admin.products.form.unassigned")}>
                  {(value: string) =>
                    agents?.find((agent) => agent.id === value)?.name ??
                    t("admin.products.form.unassigned")
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">{t("admin.products.form.unassigned")}</SelectItem>
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
          <Label htmlFor="product-form-images">{t("admin.products.form.images")}</Label>
          {imageFiles.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {imageFiles.map((file, index) => (
                <li
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-1.5 rounded-md border bg-muted px-2 py-1 text-xs"
                >
                  <ImageOff className="size-3 text-muted-foreground" aria-hidden="true" />
                  <span className="max-w-40 truncate">{file.name}</span>
                  <button
                    type="button"
                    aria-label={t("admin.products.form.removeImageAria", { name: file.name })}
                    onClick={() => setImageFiles((files) => files.filter((_, i) => i !== index))}
                  >
                    <X className="size-3" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <Input
            id="product-form-images"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            disabled={imageFiles.length >= MAX_PRODUCT_IMAGES}
            aria-invalid={!!imageError}
            onChange={(event) => {
              const selected = Array.from(event.target.files ?? []);
              event.target.value = "";
              if (selected.length === 0) return;
              setImageFiles((files) =>
                [...files, ...selected].slice(0, MAX_PRODUCT_IMAGES),
              );
              setImageError(null);
            }}
          />
          <p className="text-xs text-muted-foreground">
            {t("admin.products.form.imagesHint", { max: MAX_PRODUCT_IMAGES })}
          </p>
          {imageError && <p className="text-sm text-destructive">{imageError}</p>}
        </div>
      )}
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {product
            ? mutation.isPending
              ? t("admin.products.form.saving")
              : t("admin.products.form.save")
            : mutation.isPending
              ? t("admin.products.form.creating")
              : t("admin.products.form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
