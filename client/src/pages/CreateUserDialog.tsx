import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import CreateUserForm from "@/components/CreateUserForm";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function CreateUserDialog() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus /> Create user
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>
            Add a staff account. New users are created as agents.
          </DialogDescription>
        </DialogHeader>
        <CreateUserForm onSuccess={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  );
}
