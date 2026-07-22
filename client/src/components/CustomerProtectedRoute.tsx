import { Navigate, Outlet } from "react-router";
import { customerAuthClient } from "@/lib/customer-auth-client";

export default function CustomerProtectedRoute() {
  const { data: session, isPending } = customerAuthClient.useSession();

  if (isPending) {
    return null;
  }
  if (!session) {
    return <Navigate to="/account/login" replace />;
  }

  return <Outlet />;
}
