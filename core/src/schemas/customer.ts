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
