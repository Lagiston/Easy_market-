import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import KbArticleForm from "@/components/KbArticleForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateKbArticleDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Create article
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create article</DialogTitle>
          <DialogDescription>Add an article to the knowledge base.</DialogDescription>
        </DialogHeader>
        <KbArticleForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
