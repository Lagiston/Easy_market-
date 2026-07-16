import { z } from "zod";

export const createUserSchema = z.object({
  name: z
    .string("Name must be at least 3 characters")
    .trim()
    .min(3, "Name must be at least 3 characters"),
  email: z
    .string("A valid email is required")
    .trim()
    .toLowerCase()
    .pipe(z.email("A valid email is required")),
  password: z
    .string("Password must be at least 8 characters")
    .trim()
    .min(8, "Password must be at least 8 characters"),
});

export type CreateUserInput = z.infer<typeof createUserSchema>;
