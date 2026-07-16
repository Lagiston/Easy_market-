import UserForm from "@/components/UserForm";
import type { UserRow } from "@/components/UsersTable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function EditUserDialog({
  user,
  onOpenChange,
}: {
  user: UserRow | null;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Update the account details. Leave the password blank to keep it unchanged.
          </DialogDescription>
        </DialogHeader>
        {user && <UserForm user={user} onSuccess={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
