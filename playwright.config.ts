import { defineConfig, devices } from "@playwright/test";
import { CLIENT_PORT, CLIENT_URL, SERVER_URL, serverEnv } from "./e2e/test-env";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "html",
  use: {
    baseURL: CLIENT_URL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bun run --cwd server start",
      url: `${SERVER_URL}/api/health`,
      env: serverEnv,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `bun run --cwd client dev --port ${CLIENT_PORT} --strictPort`,
      url: CLIENT_URL,
      env: { API_PROXY_TARGET: SERVER_URL },
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
