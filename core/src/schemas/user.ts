import { z } from "zod";
import { sanitizeText } from "../sanitize";

// Mirrors the `Role` enum in server/prisma/schema.prisma. Shared here so the
// client (which has no access to the Prisma-generated enum) and server both
// reference the same values instead of "ADMIN"/"AGENT" string literals.
export const Role = {
  ADMIN: "ADMIN",
  AGENT: "AGENT",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

const NAME_ERROR = "Name must be at least 3 characters";
const EMAIL_ERROR = "A valid email is required";
const PASSWORD_ERROR = "Password must be at least 8 characters";
// Bcrypt-family hashers silently truncate beyond 72 bytes; better-auth's
// scrypt-based default doesn't have that specific ceiling, but an unbounded
// password still means an attacker-chosen payload size feeds straight into
// the hashing cost on every signup/login attempt — same reasoning as every
// other free-text field in this codebase needing an explicit .max().
const PASSWORD_MAX_ERROR = "Password must be 200 characters or fewer";

export const createUserSchema = z.object({
  name: z
    .string(NAME_ERROR)
    .trim()
    .min(3, NAME_ERROR)
    .transform(sanitizeText)
    // Sanitizing markup-only input can empty the value after the min check.
    .refine((value) => value.length >= 3, NAME_ERROR),
  email: z.string(EMAIL_ERROR).trim().toLowerCase().pipe(z.email(EMAIL_ERROR)),
  password: z.string(PASSWORD_ERROR).trim().min(8, PASSWORD_ERROR).max(200, PASSWORD_MAX_ERROR),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Same rules as create, except password is optional: blank keeps the current one.
export const updateUserSchema = createUserSchema.extend({
  password: z
    .string(PASSWORD_ERROR)
    .trim()
    .max(200, PASSWORD_MAX_ERROR)
    .refine((value) => value === "" || value.length >= 8, PASSWORD_ERROR),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const userListQuerySchema = z.object({
  status: z.enum(["active", "deactivated"]).default("active"),
});

export type UserListQuery = z.infer<typeof userListQuerySchema>;
