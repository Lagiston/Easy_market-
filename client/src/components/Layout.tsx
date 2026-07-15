import { useNavigate } from "react-router";
import { authClient, type SessionUser } from "../lib/auth-client";

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
    <nav className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      <span className="text-lg font-semibold text-gray-900">ES-Market</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-700">{user.name}</span>
        <button
          type="button"
          onClick={handleSignOut}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
