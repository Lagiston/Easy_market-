import { Link, useNavigate } from "react-router";
import { Role } from "@es-market/core";
import { authClient, type SessionUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function Layout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();

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
            to="/admin/dashboard"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Dashboard
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
