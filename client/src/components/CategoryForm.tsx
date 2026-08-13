import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

const HOME_ROW_LABELS: Record<string, string> = {
  look_good: "Look Good row",
};

export default function CategoryForm({
  category,
  onSuccess,
}: {
  category?: CategoryRow;
  onSuccess?: (category: CategoryRow) => void;
}) {
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
      : `Could not ${category ? "update" : "create"} the category. Please try again.`
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
            <Label htmlFor="category-form-name-en">Name</Label>
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
            <Label htmlFor="category-form-name-ar">Name</Label>
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
        <Label htmlFor="category-form-home-row">Homepage row</Label>
        <Controller
          name="homeRow"
          control={control}
          render={({ field }) => (
            <Select
              value={field.value || "none"}
              onValueChange={(value) => field.onChange(value === "none" ? "" : value)}
            >
              <SelectTrigger id="category-form-home-row" className="w-full">
                <SelectValue placeholder="Not on homepage">
                  {(value: string) => HOME_ROW_LABELS[value] ?? "Not on homepage"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Not on homepage</SelectItem>
                <SelectItem value="look_good">Look Good row</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
      {category && (
        <div className="grid gap-1.5">
          <Label>Cover image</Label>
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
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Creating…"
              : "Create category"}
        </Button>
      </DialogFooter>
    </form>
  );
}
