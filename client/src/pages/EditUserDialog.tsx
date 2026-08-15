import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  return (
    <Dialog open={user !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("admin.users.editDialog.title")}</DialogTitle>
          <DialogDescription>{t("admin.users.editDialog.description")}</DialogDescription>
        </DialogHeader>
        {user && <UserForm user={user} onSuccess={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
