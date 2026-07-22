import { Link, useNavigate } from "react-router";
import axios from "axios";
import { useQuery } from "@tanstack/react-query";
import { Role } from "@es-market/core";
import { authClient, type SessionUser } from "@/lib/auth-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const ATTENTION_POLL_MS = 30000;

export default function Layout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();

  // Inquiries still open/resolved that are unclaimed or escalated — the nav
  // badge's "needs a human to look at this" count.
  const { data: attentionCount } = useQuery({
    queryKey: ["inquiries-attention-count"],
    queryFn: () =>
      axios
        .get<{ count: number }>("/api/inquiries/attention-count")
        .then((res) => res.data.count),
    refetchInterval: ATTENTION_POLL_MS,
  });

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate("/admin/login", { replace: true }),
      },
    });
  }

  return (
    <nav className="flex items-center justify-between border-b bg-background px-6 py-3">
      <div className="flex items-center gap-6">
        <Link to="/admin" className="text-lg font-semibold">
          ES-Market
        </Link>
        <Link
          to="/admin/orders"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          Orders
        </Link>
        <Link
          to="/admin/inquiries"
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          Inquiries
          {!!attentionCount && (
            <Badge
              variant="destructive"
              aria-label={`${attentionCount} inquiries need attention`}
            >
              {attentionCount}
            </Badge>
          )}
        </Link>
        {user.role === Role.ADMIN && (
          <Link
            to="/admin/users"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Users
          </Link>
        )}
        {user.role === Role.ADMIN && (
          <Link
            to="/admin/products"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Products
          </Link>
        )}
        {user.role === Role.ADMIN && (
          <Link
            to="/admin/categories"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Categories
          </Link>
        )}
        {user.role === Role.ADMIN && (
          <Link
            to="/admin/kb-articles"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Knowledge base
          </Link>
        )}
        {user.role === Role.ADMIN && (
          <Link
            to="/admin/settings"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Settings
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.name}</span>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
