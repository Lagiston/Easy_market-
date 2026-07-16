import { randomUUID } from "node:crypto";
import { Router } from "express";
import { hashPassword } from "better-auth/crypto";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createUserSchema } from "@es-market/core";

// All user-related endpoints; mounted at /api in index.ts.
export const usersRouter = Router();

usersRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

usersRouter.get("/users", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
  res.json({ users });
});

usersRouter.post("/users", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = createUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, email, password } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const userId = randomUUID();
  const user = await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      role: Role.AGENT,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      emailVerified: true,
      createdAt: true,
    },
  });
  res.status(201).json({ user });
});
