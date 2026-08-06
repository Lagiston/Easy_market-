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
  emptyMessage = "No users found.",
}: {
  users: UserRow[] | null;
  status: "active" | "deactivated";
  onEdit: (user: UserRow) => void;
  onDelete: (user: UserRow) => void;
  onReactivate: (user: UserRow) => void;
  emptyMessage?: string;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Role</TableHead>
          <TableHead className="text-right">Joined</TableHead>
          <TableHead>
            <span className="sr-only">Actions</span>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users !== null && users.length === 0 && (
          <TableRow>
            <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
              {emptyMessage}
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
                    {user.role === Role.ADMIN ? "Admin" : "Agent"}
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
                          aria-label={`Edit ${user.name}`}
                          onClick={() => onEdit(user)}
                        >
                          <Pencil />
                        </Button>
                        {user.role !== Role.ADMIN && (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Delete ${user.name}`}
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
                        aria-label={`Reactivate ${user.name}`}
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
