import { createAuthClient } from "better-auth/react";

// Same-origin, proxied like auth-client.ts, but pointed at the separate
// customer Better Auth instance's basePath (server/src/lib/customer-auth.ts)
// so its requests/cookies never collide with the staff authClient's.
export const customerAuthClient = createAuthClient({
  basePath: "/api/customer-auth",
});

export type CustomerSessionUser = typeof customerAuthClient.$Infer.Session.user;
