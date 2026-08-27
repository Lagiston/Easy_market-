import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import { renderWithQuery } from "@/test/render-with-query";
import { Toaster } from "@/components/ui/sonner";
import DeleteAccountDialog from "./DeleteAccountDialog";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

vi.mock("@/lib/customer-auth-client", () => ({
  customerAuthClient: { signOut: vi.fn() },
}));
import { customerAuthClient } from "@/lib/customer-auth-client";
const mockedSignOut = vi.mocked(customerAuthClient.signOut);

const mockedNavigate = vi.fn();
vi.mock("react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react-router")>();
  return { ...actual, useNavigate: () => mockedNavigate };
});

function renderDialog(open = true) {
  const onOpenChange = vi.fn();
  renderWithQuery(
    <MemoryRouter>
      <DeleteAccountDialog open={open} onOpenChange={onOpenChange} />
      <Toaster />
    </MemoryRouter>,
  );
  return { onOpenChange };
}

describe("DeleteAccountDialog", () => {
  beforeEach(async () => {
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
    mockedSignOut.mockReset();
    mockedNavigate.mockReset();
    await i18n.changeLanguage("en");
  });

  it("blocks submission with an empty password", async () => {
    const user = userEvent.setup();
    renderDialog();

    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(await screen.findByText("Password is required")).toBeInTheDocument();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("shows an inline error and keeps the dialog open on a wrong password", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.delete.mockRejectedValue({
      isAxiosError: true,
      response: { status: 401, data: { error: "Incorrect password" } },
    });
    const user = userEvent.setup();
    const { onOpenChange } = renderDialog();

    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    expect(await screen.findByText("Incorrect password")).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(mockedSignOut).not.toHaveBeenCalled();
  });

  it("signs out and navigates home on success", async () => {
    mockedAxios.delete.mockResolvedValue({ status: 204 });
    mockedSignOut.mockResolvedValue(undefined as never);
    const user = userEvent.setup();
    renderDialog();

    await user.type(screen.getByLabelText("Password"), "correct-password");
    await user.click(screen.getByRole("button", { name: "Delete account" }));

    await waitFor(() => expect(mockedSignOut).toHaveBeenCalled());
    expect(mockedNavigate).toHaveBeenCalledWith("/");
    expect(await screen.findByText("Your account has been deleted.")).toBeInTheDocument();
  });
});
