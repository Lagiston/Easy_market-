import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { Role } from "../src/generated/prisma/client";
import { prisma } from "../src/lib/prisma";

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME ?? "Admin";
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set");
  }
  if (password.length < 12 || password === "change-me") {
    throw new Error(
      "ADMIN_PASSWORD must be at least 12 characters and not the .env.example placeholder",
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Admin user already exists, skipping.");
    return;
  }

  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name,
      email,
      emailVerified: true,
      role: Role.ADMIN,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(password),
        },
      },
    },
  });
  console.log(`Seeded admin user ${email}`);
}

async function seedCategories() {
  // homeRow drives the storefront homepage's category browse section —
  // currently just "look_good" (fashion/beauty, not yet stocked). The
  // grocery/household categories are explicitly homeRow: null (not shown
  // on the homepage) — a second row was tried and removed, so these stay
  // unset rather than tagged for a row that no longer renders.
  const rows: { en: string; homeRow: string | null }[] = [
    { en: "Groceries", homeRow: null },
    { en: "Beverages", homeRow: null },
    { en: "Household", homeRow: null },
    { en: "Personal Care", homeRow: null },
    { en: "Snacks", homeRow: null },
    { en: "Frozen & Chilled Foods", homeRow: null },
    { en: "Wigs", homeRow: "look_good" },
    { en: "Makeup", homeRow: "look_good" },
    { en: "Clothing", homeRow: "look_good" },
    { en: "Shoes", homeRow: "look_good" },
    { en: "Bags", homeRow: "look_good" },
    { en: "Earrings", homeRow: "look_good" },
  ];
  for (const { en, homeRow } of rows) {
    const existing = await prisma.category.findFirst({
      where: { deletedAt: null, name: { path: ["en"], equals: en } },
    });
    if (existing) {
      if (existing.homeRow !== homeRow) {
        await prisma.category.update({ where: { id: existing.id }, data: { homeRow } });
      }
      continue;
    }
    await prisma.category.create({ data: { id: randomUUID(), name: { en }, homeRow } });
  }
  console.log(`Seeded ${rows.length} categories`);
}

main()
  .then(seedCategories)
  .finally(() => prisma.$disconnect());
