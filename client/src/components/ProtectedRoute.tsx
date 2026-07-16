import { Navigate, Outlet } from "react-router";
import { type Role } from "@es-market/core";
import { authClient } from "../lib/auth-client";
import Layout from "./Layout";

export default function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return null;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (roles && !roles.includes(session.user.role as Role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen bg-muted">
      <Layout user={session.user} />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
