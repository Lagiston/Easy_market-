import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
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
        <CardTitle>Tags</CardTitle>
        <CardDescription>
          {tags
            ? `${tags.length} tag${tags.length === 1 ? "" : "s"} — translate how each reads on the storefront`
            : "Product tag translations"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isError ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load tags. Please try again.
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
