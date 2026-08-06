import axios from "axios";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  createUserSchema,
  updateUserSchema,
  Role,
  type UpdateUserInput,
} from "@es-market/core";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DialogFooter } from "@/components/ui/dialog";
import type { UserRow } from "@/components/UsersTable";

export default function UserForm({
  user,
  onSuccess,
}: {
  user?: UserRow;
  onSuccess?: () => void;
}) {
  const queryClient = useQueryClient();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpdateUserInput>({
    resolver: zodResolver(user ? updateUserSchema : createUserSchema),
    defaultValues: user
      ? { name: user.name, email: user.email, password: "" }
      : undefined,
  });

  const mutation = useMutation({
    mutationFn: (input: UpdateUserInput) =>
      (user
        ? axios.put(`/api/users/${user.id}`, input)
        : axios.post("/api/users", input)
      ).then((res) => res.data.user),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onSuccess?.();
    },
  });

  const serverError = mutation.isError
    ? axios.isAxiosError(mutation.error) && mutation.error.response?.data?.error
      ? String(mutation.error.response.data.error)
      : `Could not ${user ? "update" : "create"} the user. Please try again.`
    : null;

  return (
    <form
      noValidate
      onSubmit={handleSubmit((input) => mutation.mutate(input))}
      className="grid gap-4"
    >
      {user && (
        <div className="grid gap-1.5">
          <Label>Role</Label>
          <div>
            <Badge variant={user.role === Role.ADMIN ? "default" : "secondary"}>
              {user.role === Role.ADMIN ? "Admin" : "Agent"}
            </Badge>
          </div>
        </div>
      )}
      <div className="grid gap-1.5">
        <Label htmlFor="user-form-name">Name</Label>
        <Input
          id="user-form-name"
          autoComplete="off"
          aria-invalid={!!errors.name}
          {...register("name")}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="user-form-email">Email</Label>
        <Input
          id="user-form-email"
          type="email"
          autoComplete="off"
          aria-invalid={!!errors.email}
          {...register("email")}
        />
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="user-form-password">Password</Label>
        <Input
          id="user-form-password"
          type="password"
          autoComplete="new-password"
          aria-invalid={!!errors.password}
          {...register("password")}
        />
        {user && !errors.password && (
          <p className="text-sm text-muted-foreground">
            Leave blank to keep the current password.
          </p>
        )}
        {errors.password && (
          <p className="text-sm text-destructive">{errors.password.message}</p>
        )}
      </div>
      {serverError && <p className="text-sm text-destructive">{serverError}</p>}
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={mutation.isPending}>
          {user
            ? mutation.isPending
              ? "Saving…"
              : "Save changes"
            : mutation.isPending
              ? "Creating…"
              : "Create user"}
        </Button>
      </DialogFooter>
    </form>
  );
}
