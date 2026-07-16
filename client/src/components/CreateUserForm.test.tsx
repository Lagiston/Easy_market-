import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import axios from "axios";
import { renderWithQuery } from "@/test/render-with-query";
import { Dialog } from "@/components/ui/dialog";
import CreateUserForm from "./CreateUserForm";

vi.mock("axios");
const mockedAxios = vi.mocked(axios, { deep: true });

function renderForm(onSuccess = vi.fn()) {
  renderWithQuery(
    <Dialog open>
      <CreateUserForm onSuccess={onSuccess} />
    </Dialog>,
  );
  return { onSuccess };
}

async function fillForm(
  user: ReturnType<typeof userEvent.setup>,
  { name, email, password }: { name: string; email: string; password: string },
) {
  await user.type(screen.getByLabelText("Name"), name);
  await user.type(screen.getByLabelText("Email"), email);
  await user.type(screen.getByLabelText("Password"), password);
}

describe("CreateUserForm", () => {
  beforeEach(() => {
    mockedAxios.post.mockReset();
    mockedAxios.isAxiosError.mockReset();
  });

  it("renders the name, email, and password fields", () => {
    renderForm();

    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create user" })).toBeInTheDocument();
  });

  it("shows validation errors and does not submit invalid input", async () => {
    const user = userEvent.setup();
    renderForm();

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

  it("submits the form and calls onSuccess", async () => {
    mockedAxios.post.mockResolvedValue({
      data: {
        user: {
          id: "3",
          name: "New Agent",
          email: "agent@es-market.test",
          role: "AGENT",
          emailVerified: false,
          createdAt: "2026-07-16T00:00:00.000Z",
        },
      },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    await fillForm(user, {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(mockedAxios.post).toHaveBeenCalledWith("/api/users", {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
  });

  it("disables the submit button and shows a pending label while submitting", async () => {
    let resolvePost!: (value: unknown) => void;
    mockedAxios.post.mockReturnValue(
      new Promise((resolve) => {
        resolvePost = resolve;
      }),
    );
    const user = userEvent.setup();
    renderForm();

    await fillForm(user, {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    const pendingButton = await screen.findByRole("button", { name: "Creating…" });
    expect(pendingButton).toBeDisabled();

    resolvePost({ data: { user: {} } });
  });

  it("shows the server error and does not call onSuccess on failure", async () => {
    mockedAxios.isAxiosError.mockImplementation(
      (error) => (error as { isAxiosError?: boolean })?.isAxiosError === true,
    );
    mockedAxios.post.mockRejectedValue({
      isAxiosError: true,
      response: { data: { error: "A user with this email already exists" } },
    });
    const user = userEvent.setup();
    const { onSuccess } = renderForm();

    await fillForm(user, {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("A user with this email already exists"),
    ).toBeInTheDocument();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows a generic error for non-axios failures", async () => {
    mockedAxios.isAxiosError.mockReturnValue(false);
    mockedAxios.post.mockRejectedValue(new Error("boom"));
    const user = userEvent.setup();
    renderForm();

    await fillForm(user, {
      name: "New Agent",
      email: "agent@es-market.test",
      password: "supersecret",
    });
    await user.click(screen.getByRole("button", { name: "Create user" }));

    expect(
      await screen.findByText("Could not create the user. Please try again."),
    ).toBeInTheDocument();
  });
});
