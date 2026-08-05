import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { Toaster } from "@/components/ui/sonner";
import AccountProfilePage from "./AccountProfilePage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { useSession: vi.fn(), updateUser: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedUseSession = vi.mocked(customerAuthClient.useSession);
const mockedUpdateUser = vi.mocked(customerAuthClient.updateUser);

const baseUser = {
  id: "c1",
  name: "Jane Doe",
  email: "jane@example.com",
  image: null,
  mobile: null,
  gender: null,
  region: null,
  address: null,
};

function renderPage() {
  renderWithQuery(
    <>
      <AccountProfilePage />
      <Toaster />
    </>,
  );
}

describe("AccountProfilePage", () => {
  beforeEach(async () => {
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedUpdateUser.mockReset();
    await i18n.changeLanguage("en");
    mockedUseSession.mockReturnValue({
      data: { user: baseUser, session: {} },
      isPending: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
  });

  it("prefills the form from the current session", async () => {
    mockedUseSession.mockReturnValue({
      data: {
        user: {
          ...baseUser,
          mobile: "+255712345678",
          gender: "FEMALE",
          region: "Dar es Salaam",
          address: "12 Main Street",
        },
        session: {},
      },
      isPending: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    renderPage();

    expect(await screen.findByLabelText("Name")).toHaveValue("Jane Doe");
    expect(screen.getByLabelText("Region")).toHaveValue("Dar es Salaam");
    expect(screen.getByLabelText("Address")).toHaveValue("12 Main Street");
    expect(screen.getByRole("combobox", { name: "Gender" })).toHaveTextContent("Female");
  });

  it("submits the edited fields via updateUser and shows a success toast", async () => {
    mockedUpdateUser.mockResolvedValue({ data: {}, error: null } as unknown as ReturnType<
      typeof customerAuthClient.updateUser
    >);
    const user = userEvent.setup();
    renderPage();

    await user.clear(await screen.findByLabelText("Region"));
    await user.type(screen.getByLabelText("Region"), "Arusha");
    await user.type(screen.getByLabelText("Address"), "12 Main Street");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(mockedUpdateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Jane Doe",
          region: "Arusha",
          address: "12 Main Street",
        }),
      ),
    );
    expect(await screen.findByText("Profile updated")).toBeInTheDocument();
  });

  it("shows a server error when updateUser fails", async () => {
    mockedUpdateUser.mockResolvedValue({
      data: null,
      error: { message: "Something went wrong" },
    } as unknown as ReturnType<typeof customerAuthClient.updateUser>);
    const user = userEvent.setup();
    renderPage();

    await screen.findByLabelText("Name");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
  });

  it("renders the avatar upload with the session's current image", async () => {
    mockedUseSession.mockReturnValue({
      data: { user: { ...baseUser, image: "/api/uploads/customers/1.jpg" }, session: {} },
      isPending: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof customerAuthClient.useSession>);
    renderPage();

    expect(await screen.findByAltText("Profile picture")).toHaveAttribute(
      "src",
      "/api/uploads/customers/1.jpg",
    );
  });
});
