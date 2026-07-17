import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
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
          <CardTitle>Categories</CardTitle>
          <CardDescription>
            {categories
              ? `${categories.length} categor${categories.length === 1 ? "y" : "ies"}`
              : "Catalog categories"}
          </CardDescription>
        </div>
        <CreateCategoryDialog />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load categories. Please try again.
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
