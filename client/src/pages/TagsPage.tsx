import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import EditTagDialog from "./EditTagDialog";
import DeleteTagDialog from "./DeleteTagDialog";
import TagsTable, { type TagRow } from "@/components/TagsTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function TagsPage() {
  const { t } = useTranslation();
  const [editingTag, setEditingTag] = useState<TagRow | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagRow | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["tags"],
    queryFn: () => axios.get<{ tags: TagRow[] }>("/api/tags").then((res) => res.data.tags),
  });
  const tags = data ?? null;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{t("admin.tags.title")}</CardTitle>
        <CardDescription>
          {tags
            ? t("admin.tags.subtitleCount", { count: tags.length })
            : t("admin.tags.subtitleFallback")}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.tags.loadError")}
          </p>
        ) : (
          <TagsTable tags={tags} onEdit={setEditingTag} onDelete={setDeletingTag} />
        )}
        <EditTagDialog
          tag={editingTag}
          onOpenChange={(open) => {
            if (!open) setEditingTag(null);
          }}
        />
        <DeleteTagDialog
          tag={deletingTag}
          onOpenChange={(open) => {
            if (!open) setDeletingTag(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
