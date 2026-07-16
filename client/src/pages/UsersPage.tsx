import { useState } from "react";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";
import UsersTable, { type UserRow } from "@/components/UsersTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function UsersPage() {
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const { data, isError } = useQuery({
    queryKey: ["users"],
    queryFn: () => axios.get<{ users: UserRow[] }>("/api/users").then((res) => res.data.users),
  });
  const users = data ?? null;
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users ? `${users.length} member${users.length === 1 ? "" : "s"}` : "Staff accounts"}
          </CardDescription>
        </div>
        <CreateUserDialog />
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load users. Please try again.
          </p>
        ) : (
          <UsersTable users={users} onEdit={setEditingUser} />
        )}
        <EditUserDialog
          user={editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
