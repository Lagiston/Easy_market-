import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";
import type { SortingState } from "@tanstack/react-table";
import ProductsTable, { type ProductRow } from "./ProductsTable";

const products: ProductRow[] = [
  {
    id: "1",
    name: { en: "Rice 5kg" },
    description: null,
    price: 1500,
    stock: 20,
    lowStockThreshold: 10,
    imageUrl: null,
    category: { id: "c1", name: { en: "Groceries" } },
  },
  {
    id: "2",
    name: { en: "Orange Juice" },
    description: null,
    price: 300,
    stock: 5,
    lowStockThreshold: 10,
    imageUrl: null,
    category: { id: "c2", name: { en: "Beverages" } },
  },
];

function renderTable(sorting: SortingState, onSortingChange = vi.fn()) {
  render(
    <ProductsTable
      products={products}
      sorting={sorting}
      onSortingChange={onSortingChange}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
    />,
  );
  return { onSortingChange };
}

describe("ProductsTable sorting", () => {
  it("renders rows in the order given by the products prop (server-sorted)", () => {
    renderTable([{ id: "createdAt", desc: true }]);

    const rows = screen.getAllByRole("row").slice(1); // drop header row
    expect(rows[0]).toHaveTextContent("Rice 5kg");
    expect(rows[1]).toHaveTextContent("Orange Juice");
  });

  function applyUpdate(onSortingChange: ReturnType<typeof vi.fn>, previous: SortingState) {
    const updater = onSortingChange.mock.calls[0]![0];
    return typeof updater === "function" ? updater(previous) : updater;
  }

  it("clicking an unsorted numeric column header sorts descending first", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "createdAt", desc: true }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Stock" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "stock", desc: true }]);
  });

  it("clicking an unsorted text column header sorts ascending first", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "createdAt", desc: true }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Name" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "name", desc: false }]);
  });

  it("clicking the already-ascending sorted column toggles to descending", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "stock", desc: false }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Stock" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "stock", desc: true }]);
  });

  it("clicking the already-descending sorted column toggles to ascending instead of clearing the sort", async () => {
    const user = userEvent.setup();
    const initial: SortingState = [{ id: "stock", desc: true }];
    const { onSortingChange } = renderTable(initial);

    await user.click(screen.getByRole("button", { name: "Stock" }));

    expect(applyUpdate(onSortingChange, initial)).toEqual([{ id: "stock", desc: false }]);
  });

  it("does not render Image or Actions columns as sortable buttons", () => {
    renderTable([{ id: "createdAt", desc: true }]);

    expect(screen.queryByRole("button", { name: "Image" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Actions" })).not.toBeInTheDocument();
  });
});
