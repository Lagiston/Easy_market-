import { z } from "zod";
import { sanitizeText } from "../sanitize";

// Client-side form validation only — Better Auth's own /sign-up/email and
// /sign-in/email endpoints (server/src/lib/customer-auth.ts) are the actual
// server-side validation surface here; there's no hand-written Express route
// to layer a second zod check onto, same reason the staff LoginPage's schema
// is client-only. Same validators/min-lengths as createUserSchema in
// core/src/schemas/user.ts for consistency.
const NAME_ERROR = "Name must be at least 3 characters";
const EMAIL_ERROR = "A valid email is required";
const PASSWORD_ERROR = "Password must be at least 8 characters";

export const customerSignUpSchema = z.object({
  name: z
    .string(NAME_ERROR)
    .trim()
    .min(3, NAME_ERROR)
    .transform(sanitizeText)
    // Sanitizing markup-only input can empty the value after the min check.
    .refine((value) => value.length >= 3, NAME_ERROR),
  email: z.string(EMAIL_ERROR).trim().toLowerCase().pipe(z.email(EMAIL_ERROR)),
  password: z.string(PASSWORD_ERROR).trim().min(8, PASSWORD_ERROR),
});

export type CustomerSignUpInput = z.infer<typeof customerSignUpSchema>;

export const customerSignInSchema = z.object({
  email: z.string(EMAIL_ERROR).trim().pipe(z.email(EMAIL_ERROR)),
  password: z.string().min(1, "Password is required"),
});

export type CustomerSignInInput = z.infer<typeof customerSignInSchema>;
