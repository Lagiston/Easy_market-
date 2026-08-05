import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Same-origin, proxied like auth-client.ts, but pointed at the separate
// customer Better Auth instance's basePath (server/src/lib/customer-auth.ts)
// so its requests/cookies never collide with the staff authClient's.
export const customerAuthClient = createAuthClient({
  basePath: "/api/customer-auth",
  plugins: [
    inferAdditionalFields({
      user: {
        mobile: { type: "string", required: false, input: true },
        gender: { type: "string", required: false, input: true },
        region: { type: "string", required: false, input: true },
      },
    }),
  ],
});

export type CustomerSessionUser = typeof customerAuthClient.$Infer.Session.user;
