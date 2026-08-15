import { useTranslation } from "react-i18next";
import { Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Role } from "@es-market/core";
import { Badge } from "@/components/ui/badge";
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

export type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
};

const joinedDateFormat = new Intl.DateTimeFormat("en", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export default function UsersTable({
  users,
  status,
  onEdit,
  onDelete,
  onReactivate,
  emptyMessage,
}: {
  users: UserRow[] | null;
  status: "active" | "deactivated";
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  onReactivate: (user: UserRow) => void;
  emptyMessage?: string;
}) {
  const { t } = useTranslation();
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t("admin.users.table.user")}</TableHead>
          <TableHead>{t("admin.users.table.role")}</TableHead>
          <TableHead className="text-right">{t("admin.users.table.joined")}</TableHead>
          <TableHead>
            <span className="sr-only">{t("admin.users.table.actionsSr")}</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users !== null && users.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
              {emptyMessage ?? t("admin.users.table.empty")}
            </TableCell>
          </TableRow>
        )}
        {users === null
          ? Array.from({ length: 3 }, (_, i) => (
              <TableRow key={i}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-9 rounded-full" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-3 w-28" />
                      <Skeleton className="h-3 w-40" />
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-16 rounded-4xl" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto h-3 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="size-7 rounded-lg" />
                </TableCell>
              </TableRow>
            ))
          : users.map((user) => (
              <TableRow key={user.id}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-sm font-medium text-primary">
                      {initials(user.name)}
                    </div>
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-sm text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant={user.role === Role.ADMIN ? "default" : "secondary"}>
                    {t(`admin.users.roleLabels.${user.role}`)}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {joinedDateFormat.format(new Date(user.createdAt))}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    {status === "active" ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={t("admin.users.table.editAria", { name: user.name })}
                          onClick={() => onEdit(user)}
                        >
                          <Pencil />
                        </Button>
                        {user.role !== Role.ADMIN && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t("admin.users.table.deleteAria", { name: user.name })}
                            onClick={() => onDelete(user)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={t("admin.users.table.reactivateAria", { name: user.name })}
                        onClick={() => onReactivate(user)}
                      >
                        <RotateCcw />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
      </TableBody>
    </Table>
  );
}
