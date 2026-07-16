import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import CreateUserDialog from "./CreateUserDialog";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

const createdUser = {
  id: "3",
  name: "New Agent",
  email: "agent@es-market.test",
  role: "AGENT" as const,
  emailVerified: false,
  createdAt: "2026-07-16T00:00:00.000Z",
};

async function openDialog() {
  const user = userEvent.setup();
  renderWithQuery(<CreateUserDialog />);
  await user.click(screen.getByRole("button", { name: /create user/i }));
  await screen.findByRole("dialog");
  return user;
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
}

describe("CreateUserDialog", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("opens the modal from the trigger button", async () => {
    await openDialog();

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("shows validation errors and does not submit invalid input", async () => {
    const user = await openDialog();
    await fillForm(user, {
      name: "Al",
      email: "not-an-email",
      password: "short12",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("Name must be at least 3 characters"),
    ).toBeInTheDocument();
    expect(screen.getByText("A valid email is required")).toBeInTheDocument();
    expect(
      screen.getByText("Password must be at least 8 characters"),
    ).toBeInTheDocument();
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it("creates the user and closes the modal on success", async () => {
    mockedAxios.post.mockResolvedValue({ data: { user: createdUser } });

    const user = await openDialog();
    await fillForm(user, {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mockedAxios.post).toHaveBeenCalledWith("/api/users", {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
  });

  it("shows the server error and keeps the modal open on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "A user with this email already exists" } },
    });

    const user = await openDialog();
    await fillForm(user, {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("A user with this email already exists"),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
