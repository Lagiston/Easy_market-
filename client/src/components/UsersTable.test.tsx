import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import { Role } from "@es-market/core";
import UsersTable, { type UserRow } from "./UsersTable";

const activeUsers: UserRow[] = [
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

describe("UsersTable", () => {
  it("renders Edit/Delete actions in the active view", () => {
    render(
      <UsersTable
        users={activeUsers}
        status="active"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReactivate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Edit Grace Hopper" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Delete Grace Hopper" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reactivate Grace Hopper" }),
    ).not.toBeInTheDocument();
  });

  it("renders a Reactivate action instead of Edit/Delete in the deactivated view", async () => {
    const onReactivate = vi.fn();
    const user = userEvent.setup();
    render(
      <UsersTable
        users={activeUsers}
        status="deactivated"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReactivate={onReactivate}
      />,
    );

    expect(screen.queryByRole("button", { name: "Edit Grace Hopper" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete Grace Hopper" })).not.toBeInTheDocument();

    const reactivateButton = screen.getByRole("button", { name: "Reactivate Grace Hopper" });
    await user.click(reactivateButton);

    expect(onReactivate).toHaveBeenCalledWith(activeUsers[1]);
  });

  it("still shows a Reactivate action for a deactivated admin row", () => {
    render(
      <UsersTable
        users={activeUsers}
        status="deactivated"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        onReactivate={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Reactivate Ada Lovelace" })).toBeInTheDocument();
  });
});
