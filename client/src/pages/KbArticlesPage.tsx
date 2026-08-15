import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import CreateKbArticleDialog from "./CreateKbArticleDialog";
import EditKbArticleDialog from "./EditKbArticleDialog";
import DeleteKbArticleDialog from "./DeleteKbArticleDialog";
import KbArticlesTable, { type KbArticleRow } from "@/components/KbArticlesTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function KbArticlesPage() {
  const { t } = useTranslation();
  const [editingKbArticle, setEditingKbArticle] = useState<KbArticleRow | null>(null);
  const [deletingKbArticle, setDeletingKbArticle] = useState<KbArticleRow | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["kb-articles"],
    queryFn: () =>
      axios
        .get<{ kbArticles: KbArticleRow[] }>("/api/kb-articles")
        .then((res) => res.data.kbArticles),
  });
  const kbArticles = data ?? null;
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t("admin.kbArticles.title")}</CardTitle>
          <CardDescription>
            {kbArticles
              ? t("admin.kbArticles.subtitleCount", { count: kbArticles.length })
              : t("admin.kbArticles.subtitleFallback")}
          </CardDescription>
        </div>
        <CreateKbArticleDialog />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.kbArticles.loadError")}
          </p>
        ) : (
          <KbArticlesTable
            kbArticles={kbArticles}
            onEdit={setEditingKbArticle}
            onDelete={setDeletingKbArticle}
          />
        )}
        <EditKbArticleDialog
          kbArticle={editingKbArticle}
          onOpenChange={(open) => {
            if (!open) setEditingKbArticle(null);
          }}
        />
        <DeleteKbArticleDialog
          kbArticle={deletingKbArticle}
          onOpenChange={(open) => {
            if (!open) setDeletingKbArticle(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
