import { useNavigate } from "react-router";
import { authClient, type SessionUser } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";

export default function Layout({ user }: { user: SessionUser }) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate("/login", { replace: true }),
      },
    });
  }

  return (
    <nav className="flex items-center justify-between border-b bg-background px-6 py-3">
      <span className="text-lg font-semibold">ES-Market</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{user.name}</span>
        <Button type="button" variant="outline" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
