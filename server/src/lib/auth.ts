import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";

// Fail fast on missing auth env: Better Auth would otherwise fall back to a
// publicly known default secret (outside NODE_ENV=production) and localhost URLs.
function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  baseURL: requiredEnv("BETTER_AUTH_URL"),
  trustedOrigins: [requiredEnv("BETTER_AUTH_URL"), requiredEnv("CLIENT_URL")],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
  },
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "AGENT",
        input: false,
      },
    },
  },
});
