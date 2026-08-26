import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { Role } from "@es-market/core";
import { prisma } from "./prisma";
import { requiredEnv } from "./env";

// Fail fast on missing auth env: Better Auth would otherwise fall back to a
// publicly known default secret (outside NODE_ENV=production) and localhost URLs.

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  baseURL: requiredEnv("BETTER_AUTH_URL"),
  trustedOrigins: [requiredEnv("BETTER_AUTH_URL"), requiredEnv("CLIENT_URL")],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    // Railway's edge sits 2 hops in front of the container (edge, then an
    // internal LB) — x-forwarded-for arrives as a 2-value chain, but the
    // edge also sets x-real-ip to a single, unambiguous client IP, which
    // is simpler and safer to trust here than parsing/stripping the XFF
    // chain (see TRUST_PROXY_HOPS in index.ts for the equivalent Express
    // fix). Confirmed live via a diagnostic route comparing both headers.
    ipAddress: {
      ipAddressHeaders: ["x-real-ip"],
    },
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: true,
        defaultValue: Role.AGENT,
        input: false,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        // Soft-deleted users keep their row/credentials; block new sessions
        // (sign-in included) instead of hard-deleting or banning them.
        async before(session) {
          const user = await prisma.user.findUnique({ where: { id: session.userId } });
          if (user?.deletedAt) return false;
        },
      },
    },
  },
});
