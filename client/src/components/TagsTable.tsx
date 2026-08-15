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

export type TagRow = {
  value: string;
  name: LocalizedName;
};

export default function TagsTable({
  tags,
  onEdit,
  onDelete,
}: {
  tags: TagRow[] | null;
  onEdit: (tag: TagRow) => void;
  onDelete: (tag: TagRow) => void;
}) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.tags.table.tag")}</TableHead>
          <TableHead>{t("admin.tags.table.arabic")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("admin.tags.table.actionsSr")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tags === null
          ? Array.from({ length: 5 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))
          : tags.map((tag) => (
              <TableRow key={tag.value}>
                <TableCell className="font-medium capitalize">{tag.value}</TableCell>
                <TableCell dir="rtl" className="text-end">
                  {tag.name.ar ?? <span className="text-muted-foreground">—</span>}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.tags.table.editAria", { value: tag.value })}
                      onClick={() => onEdit(tag)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={t("admin.tags.table.deleteAria", { value: tag.value })}
                      onClick={() => onDelete(tag)}
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
