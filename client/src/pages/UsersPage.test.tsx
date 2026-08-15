import "@/i18n";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { Role } from "@es-market/core";
import { renderWithQuery } from "@/test/render-with-query";
import UsersPage from "./UsersPage";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

function renderUsersPage(initialEntry = "/admin/users") {
  return renderWithQuery(
    <MemoryRouter initialEntries={[initialEntry]}>
      <UsersPage />
    </MemoryRouter>,
  );
}

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

function renderUsersPageWithLocation(initialEntry = "/admin/users") {
  return renderWithQuery(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="*"
          element={
            <>
              <UsersPage />
              <LocationDisplay />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

const users = [
  {
    id: "1",
    name: "Ada Lovelace",
    email: "ada@es-market.test",
    role: Role.ADMIN,
    createdAt: "2026-01-10T00:00:00.000Z",
  },
  {
    id: "2",
    name: "Grace Hopper",
    email: "grace@es-market.test",
    role: Role.AGENT,
    createdAt: "2026-02-14T00:00:00.000Z",
  },
];

describe("UsersPage", () => {
  beforeEach(() => {
    mockedAxios.get.mockReset();
    mockedAxios.post.mockReset();
    mockedAxios.delete.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("shows skeleton rows while loading", () => {
    mockedAxios.get.mockReturnValue(new Promise(() => {}));

    renderUsersPage();

    expect(screen.getByText("Staff accounts")).toBeInTheDocument();
    expect(screen.queryByText("Ada Lovelace")).not.toBeInTheDocument();
  });

  it("renders users once loaded", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });

    renderUsersPage();

    expect(await screen.findByText("Ada Lovelace")).toBeInTheDocument();
    expect(screen.getByText("ada@es-market.test")).toBeInTheDocument();
    expect(screen.getByText("Grace Hopper")).toBeInTheDocument();

    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Agent")).toBeInTheDocument();

    expect(await screen.findByText("2 members")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", async () => {
    mockedAxios.get.mockRejectedValue(new Error("Network error"));

    renderUsersPage();

    await waitFor(() =>
      expect(
        screen.getByText("Could not load users. Please try again."),
      ).toBeInTheDocument(),
    );
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("debounces the search box and refetches with the search param", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup({ delay: null });
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.type(screen.getByLabelText("Search users"), "grace");

    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/users", {
        params: { status: "active", search: "grace" },
      }),
    );
    vi.useRealTimers();
  });

  it("shows a search-specific empty message when no users match", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockImplementation((_url: string, config?: { params?: { search?: string } }) =>
      Promise.resolve({ data: { users: config?.params?.search ? [] : users } }),
    );
    const user = userEvent.setup({ delay: null });
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.type(screen.getByLabelText("Search users"), "nobody");
    await vi.advanceTimersByTimeAsync(300);

    expect(await screen.findByText('No users match "nobody".')).toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows a generic empty message for a status tab with no users", async () => {
    mockedAxios.get.mockImplementation((_url: string, config?: { params?: { status?: string } }) =>
      config?.params?.status === "deactivated"
        ? Promise.resolve({ data: { users: [] } })
        : Promise.resolve({ data: { users } }),
    );
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("tab", { name: "Deactivated" }));

    expect(await screen.findByText("No deactivated users.")).toBeInTheDocument();
  });

  it("shows a searching indicator while a refetch is in flight, then hides it", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockResolvedValueOnce({ data: { users } });
    const user = userEvent.setup({ delay: null });
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    let resolveSearch!: (value: { data: { users: typeof users } }) => void;
    mockedAxios.get.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveSearch = resolve;
      }),
    );

    await user.type(screen.getByLabelText("Search users"), "grace");
    await vi.advanceTimersByTimeAsync(300);

    expect(await screen.findByRole("status", { name: "Searching" })).toBeInTheDocument();

    resolveSearch({ data: { users: [users[1]!] } });

    await waitFor(() =>
      expect(screen.queryByRole("status", { name: "Searching" })).not.toBeInTheDocument(),
    );
    vi.useRealTimers();
  });

  it("shows a clear button once search text is entered, and clears it on click", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Search users"), "grace");

    const clearButton = await screen.findByRole("button", { name: "Clear search" });
    await user.click(clearButton);

    await waitFor(() => expect(screen.getByLabelText("Search users")).toHaveValue(""));
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenLastCalledWith("/api/users", {
        params: { status: "active" },
      }),
    );
  });

  it("initializes the search box from the URL's search param", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users: [users[1]!] } });
    renderUsersPage("/admin/users?search=grace");

    expect(await screen.findByLabelText("Search users")).toHaveValue("grace");
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/users", {
        params: { status: "active", search: "grace" },
      }),
    );
  });

  it("reflects the debounced search term in the URL", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup({ delay: null });
    renderUsersPageWithLocation();
    await screen.findByText("Ada Lovelace");

    expect(screen.getByTestId("location-search")).toHaveTextContent("");

    await user.type(screen.getByLabelText("Search users"), "grace");
    await vi.advanceTimersByTimeAsync(300);

    await waitFor(() =>
      expect(screen.getByTestId("location-search")).toHaveTextContent("?search=grace"),
    );
    vi.useRealTimers();
  });

  it("shows the create user dialog when the button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: /create user/i }));

    expect(await screen.findByRole("dialog")).toBeInTheDocument();
  });

  it("hides the create user dialog when clicking outside", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderUsersPage();
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
    renderUsersPage();
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
    renderUsersPage();
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
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    expect(screen.queryByRole("button", { name: "Delete Ada Lovelace" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Grace Hopper" })).toBeEnabled();
  });

  it("opens a confirmation dialog when the delete button is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));

    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByText("Delete Grace Hopper?")).toBeInTheDocument();
    expect(mockedAxios.delete).not.toHaveBeenCalled();
  });

  it("closes the confirmation dialog without deleting when Cancel is clicked", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    const user = userEvent.setup();
    renderUsersPage();
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
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    await waitFor(() =>
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument(),
    );
    expect(mockedAxios.delete).toHaveBeenCalledWith("/api/users/2");
  });

  it("fetches active users by default", async () => {
    mockedAxios.get.mockResolvedValue({ data: { users } });
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    expect(mockedAxios.get).toHaveBeenCalledWith("/api/users", {
      params: { status: "active" },
    });
  });

  it("switching to the Deactivated tab fetches deactivated users and hides Create user", async () => {
    const deactivatedUsers = [
      {
        id: "3",
        name: "Margaret Hamilton",
        email: "margaret@es-market.test",
        role: Role.AGENT,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];
    mockedAxios.get.mockImplementation((_url: string, config?: { params?: { status?: string } }) =>
      config?.params?.status === "deactivated"
        ? Promise.resolve({ data: { users: deactivatedUsers } })
        : Promise.resolve({ data: { users } }),
    );
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("tab", { name: "Deactivated" }));

    expect(await screen.findByText("Margaret Hamilton")).toBeInTheDocument();
    expect(mockedAxios.get).toHaveBeenCalledWith("/api/users", {
      params: { status: "deactivated" },
    });
    expect(screen.queryByRole("button", { name: /create user/i })).not.toBeInTheDocument();
  });

  it("shows a Reactivate button instead of Edit/Delete for deactivated users", async () => {
    const deactivatedUsers = [
      {
        id: "3",
        name: "Margaret Hamilton",
        email: "margaret@es-market.test",
        role: Role.AGENT,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];
    mockedAxios.get.mockImplementation((_url: string, config?: { params?: { status?: string } }) =>
      config?.params?.status === "deactivated"
        ? Promise.resolve({ data: { users: deactivatedUsers } })
        : Promise.resolve({ data: { users } }),
    );
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("tab", { name: "Deactivated" }));
    await screen.findByText("Margaret Hamilton");

    expect(
      screen.getByRole("button", { name: "Reactivate Margaret Hamilton" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Edit Margaret Hamilton" }),
    ).not.toBeInTheDocument();
  });

  it("clicking Reactivate calls the reactivate endpoint and refreshes the list", async () => {
    const deactivatedUsers = [
      {
        id: "3",
        name: "Margaret Hamilton",
        email: "margaret@es-market.test",
        role: Role.AGENT,
        createdAt: "2026-03-01T00:00:00.000Z",
      },
    ];
    mockedAxios.get.mockImplementation((_url: string, config?: { params?: { status?: string } }) =>
      config?.params?.status === "deactivated"
        ? Promise.resolve({ data: { users: deactivatedUsers } })
        : Promise.resolve({ data: { users } }),
    );
    mockedAxios.post.mockResolvedValue({ data: { user: deactivatedUsers[0] } });
    const user = userEvent.setup();
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("tab", { name: "Deactivated" }));
    await screen.findByText("Margaret Hamilton");

    await user.click(screen.getByRole("button", { name: "Reactivate Margaret Hamilton" }));

    await waitFor(() =>
      expect(mockedAxios.post).toHaveBeenCalledWith("/api/users/3/reactivate"),
    );
    // Refetch is triggered for the currently active tab's query key.
    await waitFor(() =>
      expect(mockedAxios.get).toHaveBeenCalledWith("/api/users", {
        params: { status: "deactivated" },
      }),
    );
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
    renderUsersPage();
    await screen.findByText("Ada Lovelace");

    await user.click(screen.getByRole("button", { name: "Delete Grace Hopper" }));
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete" }));

    expect(await screen.findByText("Admins can't be deleted")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
