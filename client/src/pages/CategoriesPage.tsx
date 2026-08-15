import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import CreateCategoryDialog from "./CreateCategoryDialog";
import EditCategoryDialog from "./EditCategoryDialog";
import DeleteCategoryDialog from "./DeleteCategoryDialog";
import CategoriesTable, { type CategoryRow } from "@/components/CategoriesTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function CategoriesPage() {
  const { t } = useTranslation();
  const [editingCategory, setEditingCategory] = useState<CategoryRow | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<CategoryRow | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["categories"],
    queryFn: () =>
      axios
        .get<{ categories: CategoryRow[] }>("/api/categories")
        .then((res) => res.data.categories),
  });
  const categories = data ?? null;
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t("admin.categories.title")}</CardTitle>
          <CardDescription>
            {categories
              ? t("admin.categories.subtitleCount", { count: categories.length })
              : t("admin.categories.subtitleFallback")}
          </CardDescription>
        </div>
        <CreateCategoryDialog />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.categories.loadError")}
          </p>
        ) : (
          <CategoriesTable
            categories={categories}
            onEdit={setEditingCategory}
            onDelete={setDeletingCategory}
          />
        )}
        <EditCategoryDialog
          category={editingCategory}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
        />
        <DeleteCategoryDialog
          category={deletingCategory}
          onOpenChange={(open) => {
            if (!open) setDeletingCategory(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
