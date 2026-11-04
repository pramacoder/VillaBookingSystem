import { z } from "zod";

export const loginSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    password: z.string().min(1).max(256),
  })
  .strict();

export type LoginInput = z.infer<typeof loginSchema>;

export const createUserSchema = z
  .object({
    email: z.string().trim().min(1).max(254).email(),
    name: z.string().trim().min(1).max(120),
    password: z.string().min(12).max(256),
    role: z.enum(["ADMIN", "STAFF"]),
  })
  .strict();

export type CreateUserInput = z.infer<typeof createUserSchema>;
