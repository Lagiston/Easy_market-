import { expect, test } from "@playwright/test";
import {
  TEST_ADMIN_EMAIL,
  TEST_ADMIN_PASSWORD,
  TEST_AGENT_EMAIL,
  TEST_AGENT_PASSWORD,
} from "./test-env";
import { loginAs } from "./helpers";

test.describe("Login page", () => {
  test("renders the form fields and submit button", async ({ page }) => {
    await page.goto("/login");

    await expect(page.getByText("ES-Market")).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  });

  test("shows client-side validation for an invalid email format", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("not-an-email");
    await page.getByLabel("Password").fill("something");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows client-side validation for an empty password", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows client-side validation for a fully empty form", async ({ page }) => {
    await page.goto("/login");

    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText("Enter a valid email address")).toBeVisible();
    await expect(page.getByText("Password is required")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("shows an error and stays on the page for a wrong password", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill(TEST_ADMIN_EMAIL);
    await page.getByLabel("Password").fill("definitely-the-wrong-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);

    // No session was established: /api/me must still 401.
    const response = await page.request.get("/api/me");
    expect(response.status()).toBe(401);
  });

  test("shows an error for a non-existent email", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("nobody-at-all@e2e.test");
    await page.getByLabel("Password").fill("whatever-password-123");
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Login flow", () => {
  test("valid ADMIN credentials redirect home and establish a session", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

    const response = await page.request.get("/api/me");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe(TEST_ADMIN_EMAIL);
    expect(body.user.role).toBe("ADMIN");
  });

  test("valid AGENT credentials redirect home and establish a session", async ({ page }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();

    const response = await page.request.get("/api/me");
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.user.email).toBe(TEST_AGENT_EMAIL);
    expect(body.user.role).toBe("AGENT");
  });
});

test.describe("Route protection", () => {
  test("unauthenticated access to a protected route redirects to /login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });

  test("unauthenticated access to an admin-only route redirects to /login", async ({ page }) => {
    await page.goto("/users");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Authenticated session", () => {
  test("session persists across a page reload", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.reload();

    await expect(page).toHaveURL("/");
    await expect(page.getByRole("heading", { name: "Home" })).toBeVisible();
  });

  test("navigating to /login while already authenticated redirects home", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.goto("/login");

    await expect(page).toHaveURL("/");
  });

  test("logout clears the session and blocks further access to protected routes", async ({
    page,
  }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await page.getByRole("button", { name: "Sign out" }).click();

    await expect(page).toHaveURL(/\/login$/);

    const response = await page.request.get("/api/me");
    expect(response.status()).toBe(401);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login$/);
  });
});

test.describe("Role-based access control", () => {
  test("ADMIN can access /users and sees the Users nav link", async ({ page }) => {
    await loginAs(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD);

    await expect(page.getByRole("link", { name: "Users" })).toBeVisible();

    await page.getByRole("link", { name: "Users" }).click();
    await expect(page).toHaveURL("/users");
    await expect(page.getByRole("heading", { name: "Users" })).toBeVisible();
  });

  test("AGENT is redirected away from /users and does not see the Users nav link", async ({
    page,
  }) => {
    await loginAs(page, TEST_AGENT_EMAIL, TEST_AGENT_PASSWORD);

    await expect(page.getByRole("link", { name: "Users" })).not.toBeVisible();

    await page.goto("/users");
    await expect(page).toHaveURL("/");
  });
});
