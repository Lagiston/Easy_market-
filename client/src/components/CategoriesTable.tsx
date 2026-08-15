import { useTranslation } from "react-i18next";
import { Pencil, Trash2 } from "lucide-react";
import type { LocalizedName } from "@es-market/core";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type CategoryRow = {
  id: string;
  name: LocalizedName;
  imageUrl: string | null;
  homeRow: string | null;
};

export default function CategoriesTable({
  categories,
  onEdit,
  onDelete,
}: {
  categories: CategoryRow[] | null;
  onEdit: (category: CategoryRow) => void;
  onDelete: (category: CategoryRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.categories.table.name")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("admin.categories.table.actionsSr")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {categories === null
          ? Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-3 w-32" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))
          : categories.map((category) => (
              <TableRow key={category.id}>
                <TableCell className="font-medium">{category.name.en}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.categories.table.editAria", { name: category.name.en })}
                      onClick={() => onEdit(category)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.categories.table.deleteAria", { name: category.name.en })}
                      onClick={() => onDelete(category)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
