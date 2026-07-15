import { Navigate, Outlet } from "react-router";
import { authClient } from "../lib/auth-client";
import Layout from "./Layout";

export default function ProtectedRoute() {
  const { data: session, isPending } = authClient.useSession();

  if (isPending) {
    return null;
  }
  if (!session) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Layout user={session.user} />
      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}
