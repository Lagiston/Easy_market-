import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Check, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  emailVerified: boolean;
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

export default function UsersPage() {
  const { data, isError } = useQuery({
    queryKey: ["users"],
    queryFn: () => axios.get<{ users: UserRow[] }>("/api/users").then((res) => res.data.users),
  });
  const users = data ?? null;
  const error = isError;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>Users</CardTitle>
        <CardDescription>
          {users ? `${users.length} member${users.length === 1 ? "" : "s"}` : "Staff accounts"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="py-8 text-center text-sm text-destructive">
            Could not load users. Please try again.
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Verified</TableHead>
                <TableHead className="text-right">Joined</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
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
                        <Skeleton className="h-3 w-8" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="ml-auto h-3 w-24" />
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
                        <Badge variant={user.role === "ADMIN" ? "default" : "secondary"}>
                          {user.role === "ADMIN" ? "Admin" : "Agent"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.emailVerified ? (
                          <Check aria-label="Verified" className="size-4 text-muted-foreground" />
                        ) : (
                          <Minus aria-label="Not verified" className="size-4 text-muted-foreground/50" />
                        )}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {joinedDateFormat.format(new Date(user.createdAt))}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
