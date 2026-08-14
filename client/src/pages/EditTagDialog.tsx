import TagForm from "@/components/TagForm";
import type { TagRow } from "@/components/TagsTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditTagDialog({
  tag,
  onOpenChange,
}: {
  tag: TagRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={tag !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit tag</DialogTitle>
          <DialogDescription>
            Translate &ldquo;{tag?.value}&rdquo; — used everywhere this tag appears on the
            storefront.
          </DialogDescription>
        </DialogHeader>
        {tag && <TagForm tag={tag} onSuccess={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
