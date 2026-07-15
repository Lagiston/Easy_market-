import { createAuthClient } from "better-auth/react";
import { inferAdditionalFields } from "better-auth/client/plugins";

// Same-origin: the Vite dev server proxies /api to the Express server (:3000).
export const authClient = createAuthClient({
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: "string", input: false },
      },
    }),
  ],
});

export type SessionUser = typeof authClient.$Infer.Session.user;
