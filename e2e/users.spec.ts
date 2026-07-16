import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_AGENT_EMAIL,
  TEST_AGENT_PASSWORD,
} from "./test-env";
import { loginAs } from "./helpers";

test.describe("User list (ADMIN)", () => {
  test("admin navigates via the Users nav link and sees the user table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL("/users");

    // Table headers
    await expect(page.getByRole("columnheader", { name: "User" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Role" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Verified" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Joined" })).toBeVisible();

    // Seeded admin row: name, email, Admin badge, avatar initials
    const adminRow = page.getByRole("row").filter({ hasText: TEST_ADMIN_EMAIL });
    await expect(adminRow).toBeVisible();
    await expect(adminRow.getByText("E2E Admin", { exact: true })).toBeVisible();
    await expect(adminRow.getByText("Admin", { exact: true })).toBeVisible();
    await expect(adminRow.getByText("EA", { exact: true })).toBeVisible();

    // Seeded agent row: name, email, Agent badge
    const agentRow = page.getByRole("row").filter({ hasText: TEST_AGENT_EMAIL });
    await expect(agentRow).toBeVisible();
    await expect(agentRow.getByText("E2E Agent", { exact: true })).toBeVisible();
    await expect(agentRow.getByText("Agent", { exact: true })).toBeVisible();

    // Member count description matches the number of data rows shown.
    const rowCount = await page
      .getByRole("row")
      .filter({ hasNotText: "Joined" }) // exclude the header row
      .count();
    await expect(
      page.getByText(`${rowCount} member${rowCount === 1 ? "" : "s"}`, { exact: true }),
    ).toBeVisible();

    // Joined column shows a formatted date (e.g. "Jul 16, 2026") for the admin.
    await expect(adminRow.getByText(/^[A-Z][a-z]{2} \d{1,2}, \d{4}$/)).toBeVisible();
  });

  test("shows the error message when the users request fails", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.route("**/api/users", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" }),
    );
    await page.goto("/users");

    await expect(
      page.getByText("Could not load users. Please try again."),
    ).toBeVisible();
    await expect(page.getByRole("table")).not.toBeVisible();
  });
});

test.describe("User list access control", () => {
  test("AGENT visiting /users is redirected home and sees no Users nav link", async ({
    page,
  }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();

    await page.goto("/users");
    await expect(page).toHaveURL("/");
    await expect(page.getByRole("columnheader", { name: "Verified" })).not.toBeVisible();
  });

  test("unauthenticated visit to /users redirects to /login", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("GET /api/users API guards", () => {
  test("returns 401 without a session", async ({ request }) => {
    const response = await request.get("/api/users");
    expect(response.status()).toBe(401);
  });

  test("returns 403 with an AGENT session", async ({ page }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(403);
  });

  test("returns the user list for an ADMIN session", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    const response = await page.request.get("/api/users");
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      users: { email: string; role: string; name: string; createdAt: string }[];
    };

    const emails = body.users.map((u) => u.email);
    expect(emails).toContain(TEST_ADMIN_EMAIL);
    expect(emails).toContain(TEST_AGENT_EMAIL);

    const admin = body.users.find((u) => u.email === TEST_ADMIN_EMAIL)!;
    expect(admin.role).toBe("ADMIN");
    const agent = body.users.find((u) => u.email === TEST_AGENT_EMAIL)!;
    expect(agent.role).toBe("AGENT");

    // Ordered by createdAt ascending.
    const timestamps = body.users.map((u) => new Date(u.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });
});
