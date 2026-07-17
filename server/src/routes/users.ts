import { randomUUID } from "node:crypto";
import { Router } from "express";
import { hashPassword } from "better-auth/crypto";
import { Role } from "../generated/prisma/client";
import { prisma } from "../lib/prisma";
import { requireAuth, requireRole } from "../middleware/require-auth";
import { createUserSchema, updateUserSchema } from "@es-market/core";

// All user-related endpoints; mounted at /api in index.ts.
export const usersRouter = Router();

const userSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  emailVerified: true,
  createdAt: true,
} as const;

usersRouter.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

usersRouter.get("/users", requireAuth, requireRole(Role.ADMIN), async (_req, res) => {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: userSelect,
    orderBy: { createdAt: "desc" },
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
    select: userSelect,
  });
  res.status(201).json({ user });
});

usersRouter.put<{ id: string }>("/users/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const parsed = updateUserSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.issues[0]!.message });
    return;
  }
  const { name, email, password } = parsed.data;
  const userId = req.params.id;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing && existing.id !== userId) {
    res.status(409).json({ error: "A user with this email already exists" });
    return;
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { name, email },
    select: userSelect,
  });

  if (password !== "") {
    const hashed = await hashPassword(password);
    const updated = await prisma.account.updateMany({
      where: { userId, providerId: "credential" },
      data: { password: hashed },
    });
    if (updated.count === 0) {
      await prisma.account.create({
        data: {
          id: randomUUID(),
          userId,
          accountId: userId,
          providerId: "credential",
          password: hashed,
        },
      });
    }
  }

  res.json({ user });
});

usersRouter.delete<{ id: string }>("/users/:id", requireAuth, requireRole(Role.ADMIN), async (req, res) => {
  const userId = req.params.id;

  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.deletedAt) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  if (target.role === Role.ADMIN) {
    res.status(400).json({ error: "Admins can't be deleted" });
    return;
  }

  await prisma.user.update({ where: { id: userId }, data: { deletedAt: new Date() } });
  await prisma.session.deleteMany({ where: { userId } });

  res.status(204).end();
});
