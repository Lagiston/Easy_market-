import { z } from "zod";
import { sanitizeText } from "../sanitize";

// Client-side form validation only — Better Auth's own /sign-up/email and
// /sign-in/email endpoints (server/src/lib/customer-auth.ts) are the actual
// server-side validation surface here; there's no hand-written Express route
// to layer a second zod check onto, same reason the staff LoginPage's schema
// is client-only. Same validators/min-lengths as createUserSchema in
// core/src/schemas/user.ts for consistency.
export const NAME_ERROR = "Name must be at least 3 characters";
export const EMAIL_ERROR = "A valid email is required";
export const PASSWORD_ERROR = "Password must be at least 8 characters";
// 128 matches Better Auth's own default maxPasswordLength, which is the
// actual server-side enforcement for this flow (this schema is client-form
// validation only, per the file comment below) — kept in sync so the client
// never accepts a password the server would then reject.
export const PASSWORD_MAX_ERROR = "Password must be 128 characters or fewer";
export const PASSWORD_REQUIRED_ERROR = "Password is required";

export const customerSignUpSchema = z.object({
  name: z
    .string(NAME_ERROR)
    .trim()
    .min(3, NAME_ERROR)
    .transform(sanitizeText)
    // Sanitizing markup-only input can empty the value after the min check.
    .refine((value) => value.length >= 3, NAME_ERROR),
  email: z.string(EMAIL_ERROR).trim().toLowerCase().pipe(z.email(EMAIL_ERROR)),
  password: z.string(PASSWORD_ERROR).trim().min(8, PASSWORD_ERROR).max(128, PASSWORD_MAX_ERROR),
});

export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>;

export const customerSignInSchema = z.object({
  email: z.string(EMAIL_ERROR).trim().pipe(z.email(EMAIL_ERROR)),
  password: z.string().min(1, PASSWORD_REQUIRED_ERROR),
});

export type CustomerSignInInput = z.infer<typeof customerSignInSchema>;

// Real server-validated schema (unlike the Better-Auth-owned schemas above) —
// backs the hand-written DELETE /customer/account route (no Better Auth
// deleteUser plugin is configured), same pattern as createReviewSchema.
export const deleteCustomerAccountSchema = z.object({
  password: z.string().min(1, PASSWORD_REQUIRED_ERROR),
});

export type DeleteCustomerAccountInput = z.infer<typeof deleteCustomerAccountSchema>;

// Mirrors the `Gender` Prisma enum (server/prisma/schema.prisma) — the client
// has no access to the Prisma-generated enum, same precedent as Role/
// FulfillmentType in user.ts/order.ts.
export const Gender = {
  MALE: "MALE",
  FEMALE: "FEMALE",
  PREFER_NOT_TO_SAY: "PREFER_NOT_TO_SAY",
} as const;

export type Gender = (typeof Gender)[keyof typeof Gender];

export const GENDER_VALUES = [Gender.MALE, Gender.FEMALE, Gender.PREFER_NOT_TO_SAY] as const;

// Client-side form validation only, same reason as customerSignUpSchema
// above — the actual write goes through Better Auth's own /update-user
// endpoint (server/src/lib/customer-auth.ts's additionalFields), not a
// hand-written Express route with its own zod check.
export const MOBILE_ERROR = "A valid phone number is required";
export const REGION_ERROR = "Region must be 100 characters or fewer";

export const updateCustomerProfileSchema = z.object({
  name: z
    .string(NAME_ERROR)
    .trim()
    .min(3, NAME_ERROR)
    .transform(sanitizeText)
    .refine((value) => value.length >= 3, NAME_ERROR),
  // Optional — PhoneInput composes a single "+<dialCode><local>" string, or
  // an empty string when the local part is blank; preprocessed to undefined
  // the same way as assignedAgentId in product.ts so a blank field clears
  // rather than storing "".
  mobile: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string(MOBILE_ERROR)
      .trim()
      .regex(/^\+?[0-9][0-9\s-]{6,17}$/, MOBILE_ERROR)
      .optional(),
  ),
  // shadcn's Select can't use a literal "" value, so the "unset" choice maps
  // to "" in the form and is preprocessed to undefined here — same
  // "Unassigned" convention as assignedAgentId.
  gender: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.enum(GENDER_VALUES).optional(),
  ),
  region: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z
      .string(REGION_ERROR)
      .trim()
      .max(100, REGION_ERROR)
      .transform(sanitizeText)
      .optional(),
  ),
  // Uncapped, same as Order.address (checkoutFieldsSchema in order.ts) — a
  // shipping address isn't a bounded-length field the way region/name are.
  address: z.preprocess(
    (value) => (value === "" ? undefined : value),
    z.string().trim().transform(sanitizeText).optional(),
  ),
});

export type UpdateCustomerProfileInput = z.input<typeof updateCustomerProfileSchema>;
