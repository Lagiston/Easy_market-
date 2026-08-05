import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./prisma";
import { requiredEnv } from "./env";

// A second, fully separate Better Auth instance from ./auth.ts's staff
// login — see the Customer model comment in schema.prisma for why. Public
// signup is deliberately left enabled here (the opposite of the staff
// instance's disableSignUp), pointed at its own Customer/CustomerSession/
// CustomerAccount/CustomerVerification tables via modelName, and mounted at
// a distinct basePath + cookiePrefix so its routes and session cookies never
// collide with the staff instance's /api/auth routes or better-auth.*
// cookies. No email-sending infrastructure exists in this codebase, so
// requireEmailVerification is left at its default false — signup works
// immediately with no verification step, and there's no self-service
// password reset (a known v1 gap, not solved here).
export const customerAuth = betterAuth({
  database: prismaAdapter(prisma, { provider: "postgresql" }),
  secret: requiredEnv("BETTER_AUTH_SECRET"),
  baseURL: requiredEnv("BETTER_AUTH_URL"),
  basePath: "/api/customer-auth",
  trustedOrigins: [requiredEnv("BETTER_AUTH_URL"), requiredEnv("CLIENT_URL")],
  advanced: {
    useSecureCookies: process.env.NODE_ENV === "production",
    cookiePrefix: "es-market-customer",
  },
  emailAndPassword: {
    enabled: true,
  },
  user: {
    modelName: "customer",
    // Unlike the staff instance's read-only `role` (input: false), these are
    // customer-settable profile fields — the client's /account/profile page
    // writes them via Better Auth's own updateUser endpoint, no hand-written
    // Express route needed. `image` (profile picture URL) is Better Auth's
    // built-in avatar field, already on the Customer model, so it needs no
    // additionalField entry here — only the upload itself is hand-written
    // (see POST/DELETE /customer/profile/avatar in routes/customer.ts).
    additionalFields: {
      mobile: { type: "string", required: false, input: true },
      gender: { type: "string", required: false, input: true },
      region: { type: "string", required: false, input: true },
      address: { type: "string", required: false, input: true },
    },
  },
  // Better Auth's internal field name for the FK back to the user is always
  // "userId" regardless of what the user model itself is called — since
  // CustomerSession/CustomerAccount name that column "customerId" (matching
  // this file's own naming, not a generic "userId"), it has to be remapped
  // explicitly here or every write 500s with "Argument `customer` is missing"
  // (found live: the adapter passed a literal `userId` key that doesn't
  // exist on either Prisma model).
  session: {
    modelName: "customerSession",
    fields: { userId: "customerId" },
  },
  account: {
    modelName: "customerAccount",
    fields: { userId: "customerId" },
  },
  verification: {
    modelName: "customerVerification",
  },
});
