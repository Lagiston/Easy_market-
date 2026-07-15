import { readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "dotenv";

export const SERVER_PORT = 3100;
export const CLIENT_PORT = 5273;
export const SERVER_URL = `http://localhost:${SERVER_PORT}`;
export const CLIENT_URL = `http://localhost:${CLIENT_PORT}`;

export const TEST_DB_NAME = "es_market_test";

// Derive the test DB URL from the dev DATABASE_URL in server/.env (same host and
// credentials, different database) so no credentials live in this committed file.
function deriveTestDatabaseUrl(): string {
  const envPath = path.join(import.meta.dirname, "../server/.env");
  const devUrl = parse(readFileSync(envPath, "utf8")).DATABASE_URL;
  if (!devUrl) {
    throw new Error(`DATABASE_URL not found in ${envPath}`);
  }
  const url = new URL(devUrl);
  url.pathname = `/${TEST_DB_NAME}`;
  return url.toString();
}

export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? deriveTestDatabaseUrl();

// Test-only credentials, never used outside local E2E runs — safe to commit.
export const TEST_ADMIN_EMAIL = "admin@e2e.test";
export const TEST_ADMIN_PASSWORD = "e2e-admin-password-123";

export const serverEnv = {
  DATABASE_URL: TEST_DATABASE_URL,
  PORT: String(SERVER_PORT),
  BETTER_AUTH_SECRET: "e2e-only-secret-not-for-production-0000000000",
  BETTER_AUTH_URL: SERVER_URL,
  CLIENT_URL,
  ADMIN_EMAIL: TEST_ADMIN_EMAIL,
  ADMIN_PASSWORD: TEST_ADMIN_PASSWORD,
  ADMIN_NAME: "E2E Admin",
};
