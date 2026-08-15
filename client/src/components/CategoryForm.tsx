import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import {
  createCategorySchema,
  updateCategorySchema,
  type UpdateCategoryFormInput,
  type UpdateCategoryInput,
} from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CategoryImageUpload from "@/components/CategoryImageUpload";
import type { CategoryRow } from "@/components/CategoriesTable";

export default function CategoryForm({
  category,
  onSuccess,
}: {
  category?: CategoryRow;
  onSuccess?: (category: CategoryRow) => void;
}) {
  const { t } = useTranslation();
  const HOME_ROW_LABELS: Record<string, string> = {
    look_good: t("admin.categories.form.lookGoodRow"),
  };
  const queryClient = useQueryClient();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateCategoryFormInput, unknown, UpdateCategoryInput>({
    resolver: zodResolver(category ? updateCategorySchema : createCategorySchema),
    defaultValues: category
      ? {
          name: { en: category.name.en, ar: category.name.ar ?? "" },
          homeRow: category.homeRow ?? "",
        }
      : { name: { en: "", ar: "" }, homeRow: "" },
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateCategoryInput) =>
      category
        ? axios
            .put(`/api/categories/${category.id}`, input)
            .then((res) => res.data.category as CategoryRow)
        : axios
            .post("/api/categories", input)
            .then((res) => res.data.category as CategoryRow),
    onSuccess: (category) => {
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      onSuccess?.(category);
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : category
        ? t("admin.categories.form.updateError")
        : t("admin.categories.form.createError")
    : null;

  const enHasError = !!errors.name?.en;
  const arHasError = !!errors.name?.ar;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
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
            <Label htmlFor="category-form-name-en">{t("admin.categories.form.nameEn")}</Label>
            <Input
              id="category-form-name-en"
              autoComplete="off"
              aria-invalid={!!errors.name?.en}
              {...register("name.en")}
            />
            {errors.name?.en && (
              <p className="text-sm text-destructive">{errors.name.en.message}</p>
            )}
          </div>
        </TabsContent>
        <TabsContent value="ar" className="grid gap-4 pt-2">
          <div className="grid gap-1.5">
            <Label htmlFor="category-form-name-ar">{t("admin.categories.form.nameAr")}</Label>
            <Input
              id="category-form-name-ar"
              dir="rtl"
              autoComplete="off"
              aria-invalid={!!errors.name?.ar}
              {...register("name.ar")}
            />
            {errors.name?.ar && (
              <p className="text-sm text-destructive">{errors.name.ar.message}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
      <div className="grid gap-1.5">
        <Label htmlFor="category-form-home-row">{t("admin.categories.form.homeRow")}</Label>
        <Controller
          name="homeRow"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || "none"}
              onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
            >
              <SelectTrigger id="category-form-home-row" className="w-full">
                <SelectValue placeholder={t("admin.categories.form.notOnHomepage")}>
                  {(value: string) => HOME_ROW_LABELS[value] ?? t("admin.categories.form.notOnHomepage")}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("admin.categories.form.notOnHomepage")}</SelectItem>
                <SelectItem value="look_good">{t("admin.categories.form.lookGoodRow")}</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {category && (
        <div className="grid gap-1.5">
          <Label>{t("admin.categories.form.coverImage")}</Label>
          <CategoryImageUpload
            categoryId={category.id}
            imageUrl={category.imageUrl}
            onChanged={() => queryClient.invalidateQueries({ queryKey: ["categories"] })}
          />
        </div>
      )}
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {category
            ? mutation.isPending
              ? t("admin.categories.form.saving")
              : t("admin.categories.form.save")
            : mutation.isPending
              ? t("admin.categories.form.creating")
              : t("admin.categories.form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}
