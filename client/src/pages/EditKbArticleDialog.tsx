import KbArticleForm from "@/components/KbArticleForm";
import type { KbArticleRow } from "@/components/KbArticlesTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditKbArticleDialog({
  kbArticle,
  onOpenChange,
}: {
  kbArticle: KbArticleRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={kbArticle !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit article</DialogTitle>
          <DialogDescription>Update the article content.</DialogDescription>
        </DialogHeader>
        {kbArticle && (
          <KbArticleForm kbArticle={kbArticle} onSuccess={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
