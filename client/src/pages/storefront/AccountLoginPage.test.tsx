import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import AccountLoginPage from "./AccountLoginPage";

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: {
    useSession: vi.fn(),
    signIn: { email: vi.fn() },
  },
}));

import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);
const mockedSignIn = vi.mocked(customerAuthClient.signIn.email);

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/account/login"]}>
      <Routes>
        <Route path="/account/login" element={<AccountLoginPage />} />
        <Route path="/account" element={<div>Account page</div>} />
        <Route path="/account/signup" element={<div>Sign up page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountLoginPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockedUseSession.mockReset();
    mockedSignIn.mockReset();
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
  });

  it("shows validation errors for an empty submit", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("A valid email is required")).toBeInTheDocument();
  });

  it("signs in and navigates to the account page on success", async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValue({ data: {}, error: null } as unknown as ReturnType<
      typeof customerAuthClient.signIn.email
    >);
    renderPage();

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    await waitFor(() => {
      expect(mockedSignIn).toHaveBeenCalledWith({
        email: "jane@example.com",
        password: "password123",
      });
    });
    expect(await screen.findByText("Account page")).toBeInTheDocument();
  });

  it("shows an error message when sign-in fails", async () => {
    const user = userEvent.setup();
    mockedSignIn.mockResolvedValue({
      data: null,
      error: { message: "Invalid email or password" },
    } as unknown as ReturnType<typeof customerAuthClient.signIn.email>);
    renderPage();

    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "wrongpassword");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Invalid email or password")).toBeInTheDocument();
  });

  it("redirects to the account page when already signed in", () => {
    mockedUseSession.mockReturnValue({
      data: { user: { name: "Jane" } },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    renderPage();

    expect(screen.getByText("Account page")).toBeInTheDocument();
  });
});
