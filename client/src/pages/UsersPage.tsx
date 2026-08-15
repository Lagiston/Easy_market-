import { useEffect, useState } from "react";
import axios from "axios";
import { useTranslation } from "react-i18next";
import { Loader2, X } from "lucide-react";
import { useSearchParams } from "react-router";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function UsersPage() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [status, setStatus] = useState<"active" | "deactivated">("active");
  const [search, setSearch] = useState(() => searchParams.get("search") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(
    () => searchParams.get("search")?.trim() ?? "",
  );
  const [editingUser, setEditingUser] = useState<UserRow | null>(null);
  const [deletingUser, setDeletingUser] = useState<UserRow | null>(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    const timeout = setTimeout(() => {
      const trimmed = search.trim();
      setDebouncedSearch(trimmed);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (trimmed) {
            next.set("search", trimmed);
          } else {
            next.delete("search");
          }
          return next;
        },
        { replace: true },
      );
    }, 300);
    return () => clearTimeout(timeout);
  }, [search, setSearchParams]);

  const clearSearch = () => {
    setSearch("");
    setDebouncedSearch("");
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("search");
        return next;
      },
      { replace: true },
    );
  };

  const { data, isError, isFetching } = useQuery({
    queryKey: ["users", status, debouncedSearch],
    queryFn: () =>
      axios
        .get<{ users: UserRow[] }>("/api/users", {
          params: { status, ...(debouncedSearch ? { search: debouncedSearch } : {}) },
        })
        .then((res) => res.data.users),
    placeholderData: keepPreviousData,
  });
  const users = data ?? null;
  const error = isError;
  const isRefetching = isFetching && users !== null;
  const emptyMessage = debouncedSearch
    ? t("admin.users.emptyNoMatch", { search: debouncedSearch })
    : status === "active"
      ? t("admin.users.emptyActive")
      : t("admin.users.emptyDeactivated");

  const reactivateMutation = useMutation({
    mutationFn: (user: UserRow) => axios.post(`/api/users/${user.id}/reactivate`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["users"] }),
  });
  const reactivateError = reactivateMutation.isError
    ? axios.isAxiosError(reactivateMutation.error) && reactivateMutation.error.response?.data?.error
      ? String(reactivateMutation.error.response.data.error)
      : t("admin.users.reactivateError")
    : null;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div className="space-y-1.5">
          <CardTitle>{t("admin.users.title")}</CardTitle>
          <CardDescription>
            {users ? t("admin.users.subtitleCount", { count: users.length }) : t("admin.users.subtitleFallback")}
          </CardDescription>
        </div>
        {status === "active" && <CreateUserDialog />}
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={status}
            onValueChange={(value) => setStatus(value as "active" | "deactivated")}
            className="gap-4"
          >
            <TabsList>
              <TabsTrigger value="active">{t("admin.users.active")}</TabsTrigger>
              <TabsTrigger value="deactivated">{t("admin.users.deactivated")}</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative sm:max-w-xs sm:flex-1">
            <Input
              placeholder={t("admin.users.searchPlaceholder")}
              aria-label={t("admin.users.searchAria")}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="pr-8"
            />
            {isRefetching ? (
              <Loader2
                role="status"
                aria-label={t("admin.users.searching")}
                className="absolute top-1/2 right-2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
              />
            ) : (
              search && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={t("admin.users.clearSearchAria")}
                  onClick={clearSearch}
                  className="absolute top-1/2 right-1 size-6 -translate-y-1/2"
                >
                  <X />
                </Button>
              )
            )}
          </div>
        </div>
        {reactivateError && (
          <p className="mt-4 text-sm text-destructive">{reactivateError}</p>
        )}
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            {t("admin.users.loadError")}
          </p>
        ) : (
          <div className="mt-4">
            <UsersTable
              users={users}
              status={status}
              onEdit={setEditingUser}
              onDelete={setDeletingUser}
              onReactivate={(user) => reactivateMutation.mutate(user)}
              emptyMessage={emptyMessage}
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
