import { Pencil, Trash2 } from "lucide-react";
import type { KbArticleBody, LocalizedName } from "@es-market/core";
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

export type KbArticleRow = {
  id: string;
  title: LocalizedName;
  body: KbArticleBody;
  topic: string | null;
};

export default function KbArticlesTable({
  kbArticles,
  onEdit,
  onDelete,
}: {
  kbArticles: KbArticleRow[] | null;
  onEdit: (kbArticle: KbArticleRow) => void;
  onDelete: (kbArticle: KbArticleRow) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Title</TableHead>
          <TableHead>Topic</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {kbArticles === null
          ? Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <Skeleton className="h-3 w-48" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-3 w-20" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))
          : kbArticles.map((kbArticle) => (
              <TableRow key={kbArticle.id}>
                <TableCell className="font-medium">{kbArticle.title.en}</TableCell>
                <TableCell className="text-muted-foreground">
                  {kbArticle.topic ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Edit ${kbArticle.title.en}`}
                      onClick={() => onEdit(kbArticle)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${kbArticle.title.en}`}
                      onClick={() => onDelete(kbArticle)}
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
