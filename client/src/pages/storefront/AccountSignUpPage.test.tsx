import { screen, waitFor, render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import i18n from "@/i18n";
import AccountSignUpPage from "./AccountSignUpPage";

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: {
    useSession: vi.fn(),
    signUp: { email: vi.fn() },
  },
}));

import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);
const mockedSignUp = vi.mocked(customerAuthClient.signUp.email);

function renderPage() {
  render(
    <MemoryRouter initialEntries={["/account/signup"]}>
      <Routes>
        <Route path="/account/signup" element={<AccountSignUpPage />} />
        <Route path="/account" element={<div>Account page</div>} />
        <Route path="/account/login" element={<div>Login page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AccountSignUpPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
    mockedUseSession.mockReset();
    mockedSignUp.mockReset();
    mockedUseSession.mockReturnValue({
      data: null,
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
  });

  it("shows validation errors for an empty submit", async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Name must be at least 3 characters")).toBeInTheDocument();
  });

  it("signs up and navigates to the account page on success", async () => {
    const user = userEvent.setup();
    mockedSignUp.mockResolvedValue({ data: {}, error: null } as unknown as ReturnType<
      typeof customerAuthClient.signUp.email
    >);
    renderPage();

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    await waitFor(() => {
      expect(mockedSignUp).toHaveBeenCalledWith({
        name: "Jane Doe",
        email: "jane@example.com",
        password: "password123",
      });
    });
    expect(await screen.findByText("Account page")).toBeInTheDocument();
  });

  it("shows an error message when sign-up fails", async () => {
    const user = userEvent.setup();
    mockedSignUp.mockResolvedValue({
      data: null,
      error: { message: "Email already in use" },
    } as unknown as ReturnType<typeof customerAuthClient.signUp.email>);
    renderPage();

    await user.type(screen.getByLabelText("Name"), "Jane Doe");
    await user.type(screen.getByLabelText("Email"), "jane@example.com");
    await user.type(screen.getByLabelText("Password"), "password123");
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(await screen.findByText("Email already in use")).toBeInTheDocument();
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
