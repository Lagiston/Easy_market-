import { screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import AccountPage from "./AccountPage";

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn(), signOut: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);

const baseUser = {
  id: "c1",
  name: "Jane Doe",
  email: "jane@example.com",
  image: null,
  mobile: null,
  gender: null,
  region: null,
};

function renderPage() {
  renderWithQuery(
    <MemoryRouter>
      <AccountPage />
    </MemoryRouter>,
  );
}

describe("storefront AccountPage", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("shows only the email when mobile/gender/region are unset", () => {
    mockedUseSession.mockReturnValue({
      data: { user: baseUser, session: {} },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    renderPage();

    expect(screen.getByText("jane@example.com")).toBeInTheDocument();
    expect(screen.queryByText(/Mobile number:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Gender:/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Region:/)).not.toBeInTheDocument();
  });

  it("shows mobile, translated gender, and region when set", () => {
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          ...baseUser,
          mobile: "+255712345678",
          gender: "FEMALE",
          region: "Dar es Salaam",
        },
        session: {},
      },
      isPending: false,
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    renderPage();

    expect(screen.getByText("Mobile number: +255712345678")).toBeInTheDocument();
    expect(screen.getByText("Gender: Female")).toBeInTheDocument();
    expect(screen.getByText("Region: Dar es Salaam")).toBeInTheDocument();
  });
});
