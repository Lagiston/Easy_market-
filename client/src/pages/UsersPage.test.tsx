import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { Role } from "@es-market/core";
import { renderWithQuery } from "@/test/render-with-query";
import UsersPage from "./UsersPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const users = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@es-market.test",
    role: Role.ADMIN,
    emailVerified: true,
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Grace Hopper",
    email: "grace@es-market.test",
    role: Role.AGENT,
    emailVerified: false,
    createdAt: "2026-02-14T00:00:00.000Z",
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderWithQuery(<UsersPage />);

    expect(screen.getByText("Staff accounts")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("renders users once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });

    renderWithQuery(<UsersPage />);

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@es-market.test")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();

    expect(screen.getByLabelText("Verified")).toBeInTheDocument();
    expect(screen.getByLabelText("Not verified")).toBeInTheDocument();

    expect(await screen.findByText("2 members")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderWithQuery(<UsersPage />);

    await waitFor(() =>
      expect(
        screen.getByText("Could not load users. Please try again."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("shows the create user dialog when the button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("hides the create user dialog when clicking outside", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /create user/i }));
    await screen.findByRole("dialog");

    await user.click(document.body);

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("hides the create user dialog when pressing Escape", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /create user/i }));
    await screen.findByRole("dialog");

    await user.keyboard("{Escape}");

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("opens the edit dialog pre-filled when a row's edit button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Edit Ada Lovelace" }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Edit user")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@es-market.test");
    expect(screen.getByLabelText("Password")).toHaveValue("");
  });

  it("does not render a delete button for the admin row", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    expect(screen.queryByRole("button", { name: "Delete Ada Lovelace" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Grace Hopper" })).toBeEnabled();
  });

  it("opens a confirmation dialog when the delete button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Grace Hopper?")).toBeInTheDocument();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("closes the confirmation dialog without deleting when Cancel is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));
    await screen.findByRole("alertdialog");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("deletes the user when the confirmation is accepted", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    mockedAxios.delete.mockResolvedValue({});
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(mockedAxios.delete).toHaveBeenCalledWith("/api/users/2");
  });

  it("shows the server error and keeps the dialog open when deletion fails", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.delete.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "Admins can't be deleted" } },
    });
    const user = userEvent.setup();
    renderWithQuery(<UsersPage />);
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Admins can't be deleted")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
