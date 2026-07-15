import { spawnSync } from "node:child_process";
import path from "node:path";
import { Client } from "pg";
import { serverEnv, TEST_DATABASE_URL, TEST_DB_NAME } from "./test-env";

const serverDir = path.join(import.meta.dirname, "../server");

// Guardrail: never let a bad override migrate or seed anything but the test DB.
const dbName = new URL(TEST_DATABASE_URL).pathname.slice(1);
if (dbName !== TEST_DB_NAME) {
  console.error(`Refusing to run: database is "${dbName}", expected "${TEST_DB_NAME}"`);
  process.exit(1);
}

async function createDatabaseIfMissing() {
  const maintenanceUrl = new URL(TEST_DATABASE_URL);
  maintenanceUrl.pathname = "/postgres";
  const client = new Client({ connectionString: maintenanceUrl.toString() });
  await client.connect();
  try {
    await client.query(`CREATE DATABASE ${TEST_DB_NAME}`);
    console.log(`Created database ${TEST_DB_NAME}`);
  } catch (error) {
    if ((error as { code?: string }).code !== "42P04") throw error; // 42P04 = duplicate_database
    console.log(`Database ${TEST_DB_NAME} already exists, skipping.`);
  } finally {
    await client.end();
  }
}

function run(command: string, args: string[], env: Record<string, string>) {
  const result = spawnSync(command, args, {
    cwd: serverDir,
    env: { ...process.env, ...env },
    stdio: "inherit",
  });
  if (result.status !== 0) {
    console.error(`${command} ${args.join(" ")} failed with status ${result.status}`);
    process.exit(result.status ?? 1);
  }
}

await createDatabaseIfMissing();
run("bunx", ["prisma", "migrate", "deploy"], { DATABASE_URL: TEST_DATABASE_URL });
run("bun", ["prisma/seed.ts"], serverEnv);
console.log("Test database ready.");
