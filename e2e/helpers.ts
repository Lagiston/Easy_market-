import { expect, type Page } from "@playwright/test";

/**
 * Logs in through the UI with the given credentials and asserts the
 * resulting redirect to "/". Use for tests that expect a successful login;
 * tests asserting validation/auth errors should fill the form manually.
 */
export async function loginAs(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("/");
}
