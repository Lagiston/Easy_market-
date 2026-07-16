import { z } from "zod";

const NAME_ERROR = "Name must be at least 3 characters";
const EMAIL_ERROR = "A valid email is required";
const PASSWORD_ERROR = "Password must be at least 8 characters";

export const createUserSchema = z.object({
  name: z.string(NAME_ERROR).trim().min(3, NAME_ERROR),
  email: z.string(EMAIL_ERROR).trim().toLowerCase().pipe(z.email(EMAIL_ERROR)),
  password: z.string(PASSWORD_ERROR).trim().min(8, PASSWORD_ERROR),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;

// Same rules as create, except password is optional: blank keeps the current one.
export const updateUserSchema = createUserSchema.extend({
  password: z
    .string(PASSWORD_ERROR)
    .trim()
    .refine((value) => value === "" || value.length >= 8, PASSWORD_ERROR),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
