import { randomUUID } from "node:crypto";
import { hashPassword } from "better-auth/crypto";
import { PrismaClient, Role } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  TEST_AGENT_EMAIL,
  TEST_AGENT_NAME,
  TEST_AGENT_PASSWORD,
  TEST_DATABASE_URL,
  TEST_DB_NAME,
} from "../../e2e/test-env";

// Guardrail: never let a bad override seed anything but the test DB.
const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
if (dbName !== TEST_DB_NAME) {
  console.error(`Refusing to run: database is "${dbName}", expected "${TEST_DB_NAME}"`);
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: TEST_AGENT_EMAIL } });
  if (existing) {
    console.log("E2E agent user already exists, skipping.");
    return;
  }

  const userId = randomUUID();
  await prisma.user.create({
    data: {
      id: userId,
      name: TEST_AGENT_NAME,
      email: TEST_AGENT_EMAIL,
      emailVerified: true,
      role: Role.AGENT,
      accounts: {
        create: {
          id: randomUUID(),
          accountId: userId,
          providerId: "credential",
          password: await hashPassword(TEST_AGENT_PASSWORD),
        },
      },
    },
  });
  console.log(`Seeded E2E agent user ${TEST_AGENT_EMAIL}`);
}

main().finally(() => prisma.$disconnect());
