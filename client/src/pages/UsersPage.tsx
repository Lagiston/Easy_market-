import { useState } from "react";
import axios from "axios";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import CreateUserDialog from "./CreateUserDialog";
import EditUserDialog from "./EditUserDialog";
import DeleteUserDialog from "./DeleteUserDialog";
import UsersTable, { type UserRow } from "@/components/UsersTable";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UsersPage() {
  const [status, setStatus] = useState<"active" | "deactivated">("active");
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const queryClient = useQueryClient();

  const { data, isError } = useQuery({
    queryKey: ["users", status],
    queryFn: () =>
      axios
        .get<{ users: UserRow[] }>("/api/users", { params: { status } })
        .then((res) => res.data.users),
  });
  const users = data ?? null;
  const error = isError;

  const reactivateMutation = useMutation({
    mutationFn: (user: UserRow) => axios.post(`/api/users/${user.id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const reactivateError = reactivateMutation.isError
    ? axios.isAxiosError(reactivateMutation.error) && reactivateMutation.error.response?.data?.error
      ? String(reactivateMutation.error.response.data.error)
      : "Could not reactivate the user. Please try again."
    : null;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>Users</CardTitle>
          <CardDescription>
            {users ? `${users.length} member${users.length === 1 ? "" : "s"}` : "Staff accounts"}
          </CardDescription>
        </div>
        {status === "active" && <CreateUserDialog />}
      </CardHeader>
      <CardContent>
        <Tabs
          value={status}
          onValueChange={(value) => setStatus(value as "active" | "deactivated")}
          className="gap-4"
        >
          <TabsList>
            <TabsTrigger value="active">Active</TabsTrigger>
            <TabsTrigger value="deactivated">Deactivated</TabsTrigger>
          </TabsList>
        </Tabs>
        {reactivateError && (
          <p className="mt-4 text-sm text-destructive">{reactivateError}</p>
        )}
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load users. Please try again.
          </p>
        ) : (
          <div className="mt-4">
            <UsersTable
              users={users}
              status={status}
              onEdit={setEditingUser}
              onDelete={setDeletingUser}
              onReactivate={(user) => reactivateMutation.mutate(user)}
            />
          </div>
        )}
        <EditUserDialog
          user={editingUser}
          onOpenChange={(open) => {
            if (!open) setEditingUser(null);
          }}
        />
        <DeleteUserDialog
          user={deletingUser}
          onOpenChange={(open) => {
            if (!open) setDeletingUser(null);
          }}
        />
      </CardContent>
    </Card>
  );
}
