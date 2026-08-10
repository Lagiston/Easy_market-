import { expect, test, type Page } from "@playwright/test";
import { Client } from "pg";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_AGENT_EMAIL,
  TEST_AGENT_PASSWORD,
  TEST_DATABASE_URL,
} from "./test-env";
import { loginAs } from "./helpers";

// Creates a throwaway AGENT via the API (as an already-logged-in admin) for
// tests that delete a user, so the shared seeded TEST_AGENT_EMAIL row is
// never touched. Returns the created user's name/email for locating its row.
async function createThrowawayAgent(page: Page, label: string) {
  const email = `${label}-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
  const name = `Throwaway ${label}`;
  const response = await page.request.post("/api/users", {
    data: { name, email, password: "throwaway-password-123" },
  });
  if (!response.ok()) {
    throw new Error(`Failed to create throwaway agent: ${response.status()}`);
  }
  return { name, email };
}

// Hard-deletes a throwaway user (bypassing the soft-delete API) so repeated
// local/CI runs against the shared test DB don't accumulate rows. Cascades to
// the user's account/session rows per the schema's onDelete: Cascade.
async function hardDeleteUser(email: string) {
  const client = new Client({ connectionString: TEST_DATABASE_URL });
  await client.connect();
  try {
    await client.query('DELETE FROM "user" WHERE email = $1', [email]);
  } finally {
    await client.end();
  }
}

test.describe("User list (ADMIN)", () => {
  test("admin navigates via the Users nav link and sees the user table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL("/admin/users");

    // Table headers
    await expect(page.getByRole("columnheader", { name: "User" })).toBeVisible();
    await expect(page.getByRole("columnheader", { name: "Role" })).toBeVisible();
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

    await page.route("**/api/users?**", (route) =>
      route.fulfill({ status: 500, body: "Internal Server Error" }),
    );
    await page.goto("/admin/users");

    // TanStack Query's default client retries the failed request 3 times with
    // exponential backoff (~7s total) before surfacing the error state, so
    // allow extra time beyond the default 5s expect timeout.
    await expect(
      page.getByText("Could not load users. Please try again."),
    ).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole("table")).not.toBeVisible();
  });
});

test.describe("User list access control", () => {
  test("AGENT visiting /admin/users is redirected home and sees no Users nav link", async ({
    page,
  }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();

    await page.goto("/admin/users");
    await expect(page).toHaveURL("/admin");
  });

  test("unauthenticated visit to /admin/users redirects to /admin/login", async ({ page }) => {
    await page.goto("/admin/users");
    await expect(page).toHaveURL(/\/admin\/login$/);
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

    // Ordered by createdAt descending (newest first).
    const timestamps = body.users.map((u) => new Date(u.createdAt).getTime());
    expect(timestamps).toEqual([...timestamps].sort((a, b) => b - a));
  });
});

test.describe("Create user (ADMIN)", () => {
  test("creating a user via the dialog adds it to the table", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/users");

    const email = `create-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;
    const name = "Created Via UI";

    try {
      await page.getByRole("button", { name: "Create user" }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Create user" })).toBeVisible();

      await dialog.getByLabel("Name").fill(name);
      await dialog.getByLabel("Email").fill(email);
      await dialog.getByLabel("Password").fill("created-via-ui-password-123");

      await dialog.getByRole("button", { name: "Create user" }).click();

      await expect(dialog).not.toBeVisible();

      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible();
      await expect(row.getByText(name, { exact: true })).toBeVisible();
      await expect(row.getByText("Agent", { exact: true })).toBeVisible();
    } finally {
      await hardDeleteUser(email);
    }
  });
});

test.describe("Edit user (ADMIN)", () => {
  test("editing a user's name and email updates the table row", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const { name, email } = await createThrowawayAgent(page, "edit-confirm");
    const newName = "Edited Via UI";
    const newEmail = `edited-${Date.now()}-${Math.random().toString(36).slice(2)}@e2e.test`;

    try {
      await page.goto("/admin/users");
      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: `Edit ${name}` }).click();

      const dialog = page.getByRole("dialog");
      await expect(dialog.getByRole("heading", { name: "Edit user" })).toBeVisible();

      await dialog.getByLabel("Name").fill(newName);
      await dialog.getByLabel("Email").fill(newEmail);

      await dialog.getByRole("button", { name: "Save changes" }).click();

      await expect(dialog).not.toBeVisible();

      const updatedRow = page.getByRole("row").filter({ hasText: newEmail });
      await expect(updatedRow).toBeVisible();
      await expect(updatedRow.getByText(newName, { exact: true })).toBeVisible();
      await expect(page.getByRole("row").filter({ hasText: email })).not.toBeVisible();
    } finally {
      await hardDeleteUser(newEmail);
    }
  });
});

test.describe("Reactivate user (ADMIN)", () => {
  test("deactivating then reactivating a user moves it between tabs and restores login", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const { name, email } = await createThrowawayAgent(page, "reactivate");
    const password = "throwaway-password-123";

    try {
      await page.goto("/admin/users");

      const activeTab = page.getByRole("tab", { name: "Active" });
      const deactivatedTab = page.getByRole("tab", { name: "Deactivated" });

      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible();

      // Deactivate (soft-delete) the throwaway user from the Active tab.
      await row.getByRole("button", { name: `Delete ${name}` }).click();
      const deleteDialog = page.getByRole("alertdialog");
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole("button", { name: "Delete" }).click();
      await expect(deleteDialog).not.toBeVisible();
      await expect(row).not.toBeVisible();

      // Switch to the Deactivated tab: the user shows up with a Reactivate button.
      await deactivatedTab.click();
      const deactivatedRow = page.getByRole("row").filter({ hasText: email });
      await expect(deactivatedRow).toBeVisible();
      const reactivateButton = deactivatedRow.getByRole("button", {
        name: `Reactivate ${name}`,
      });
      await expect(reactivateButton).toBeVisible();

      // Not on the Active tab while deactivated.
      await activeTab.click();
      await expect(page.getByRole("row").filter({ hasText: email })).not.toBeVisible();

      // A deactivated user cannot log in — the credentials are correct, but
      // the Better Auth `before` session hook in server/src/lib/auth.ts
      // blocks session creation for a soft-deleted user, which surfaces as a
      // "Failed to create session" error rather than an invalid-credentials one.
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/admin\/login$/);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page.getByText(/failed to create session/i)).toBeVisible();
      await expect(page).toHaveURL(/\/admin\/login$/);

      // Log back in as admin and reactivate the user.
      await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
      await page.goto("/admin/users");
      await deactivatedTab.click();
      await expect(
        page.getByRole("row").filter({ hasText: email }),
      ).toBeVisible();
      await page
        .getByRole("row")
        .filter({ hasText: email })
        .getByRole("button", { name: `Reactivate ${name}` })
        .click();
      await expect(page.getByRole("row").filter({ hasText: email })).not.toBeVisible();

      // Reappears on the Active tab.
      await activeTab.click();
      await expect(page.getByRole("row").filter({ hasText: email })).toBeVisible();

      // The reactivated user can log in again.
      await page.getByRole("button", { name: "Sign out" }).click();
      await expect(page).toHaveURL(/\/admin\/login$/);
      await page.getByLabel("Email").fill(email);
      await page.getByLabel("Password").fill(password);
      await page.getByRole("button", { name: "Sign in" }).click();
      await expect(page).toHaveURL("/admin");

      const meResponse = await page.request.get("/api/me");
      expect(meResponse.status()).toBe(200);
      const meBody = await meResponse.json();
      expect(meBody.user.email).toBe(email);
    } finally {
      await hardDeleteUser(email);
    }
  });
});

test.describe("Delete user (ADMIN)", () => {
  test("the admin's own row has no delete button", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    await page.goto("/admin/users");

    const adminRow = page.getByRole("row").filter({ hasText: TEST_ADMIN_EMAIL });
    await expect(adminRow.getByRole("button", { name: "Delete E2E Admin" })).not.toBeVisible();
  });

  test("deleting a user removes it from the table and updates the member count", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const { name, email } = await createThrowawayAgent(page, "delete-confirm");

    try {
      await page.goto("/admin/users");
      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible();

      await row.getByRole("button", { name: `Delete ${name}` }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();
      await expect(dialog.getByRole("heading", { name: `Delete ${name}?` })).toBeVisible();

      await dialog.getByRole("button", { name: "Delete" }).click();

      await expect(dialog).not.toBeVisible();
      await expect(row).not.toBeVisible();

      // The member count description tracks the table's actual row count, so
      // recompute it after the deletion rather than diffing against a
      // "before" snapshot — other tests run in parallel against the same
      // shared user table and may add/remove rows concurrently.
      const rowCountAfter = await page
        .getByRole("row")
        .filter({ hasNotText: "Joined" }) // exclude the header row
        .count();
      await expect(
        page.getByText(`${rowCountAfter} member${rowCountAfter === 1 ? "" : "s"}`, {
          exact: true,
        }),
      ).toBeVisible();
    } finally {
      await hardDeleteUser(email);
    }
  });

  test("canceling the confirm dialog keeps the user and sends no delete request", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);
    const { name, email } = await createThrowawayAgent(page, "delete-cancel");

    try {
      await page.goto("/admin/users");
      const row = page.getByRole("row").filter({ hasText: email });
      await expect(row).toBeVisible();

      let deleteRequestSent = false;
      await page.route(`**/api/users/*`, (route) => {
        if (route.request().method() === "DELETE") deleteRequestSent = true;
        return route.continue();
      });

      await row.getByRole("button", { name: `Delete ${name}` }).click();

      const dialog = page.getByRole("alertdialog");
      await expect(dialog).toBeVisible();

      await dialog.getByRole("button", { name: "Cancel" }).click();

      await expect(dialog).not.toBeVisible();
      await expect(row).toBeVisible();
      expect(deleteRequestSent).toBe(false);
    } finally {
      await hardDeleteUser(email);
    }
  });
});
