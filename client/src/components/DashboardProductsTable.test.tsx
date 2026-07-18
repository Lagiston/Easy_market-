import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { MemoryRouter } from "react-router";
import DashboardProductsTable from "./DashboardProductsTable";
import type { ProductRow } from "@/components/ProductsTable";

function renderTable(products: ProductRow[]) {
  render(
    <MemoryRouter>
      <DashboardProductsTable products={products} />
    </MemoryRouter>,
  );
}

const baseProduct: ProductRow = {
  id: "1",
  name: { en: "Rice 5kg" },
  description: null,
  price: 1500,
  stock: 20,
  lowStockThreshold: 10,
  imageUrl: null,
  category: { id: "c1", name: { en: "Groceries" } },
  assignedAgent: null,
};

describe("DashboardProductsTable", () => {
  it("shows an In stock badge when stock is above the low-stock threshold", () => {
    renderTable([{ ...baseProduct, stock: 20 }]);
    expect(screen.getByText("In stock")).toBeInTheDocument();
  });

  it("shows a Low stock badge when stock is below the threshold but not zero", () => {
    renderTable([{ ...baseProduct, stock: 5 }]);
    expect(screen.getByText("Low stock")).toBeInTheDocument();
  });

  it("shows an Out of stock badge when stock is zero", () => {
    renderTable([{ ...baseProduct, stock: 0 }]);
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });

  it("renders the product name as a link to its detail page", () => {
    renderTable([baseProduct]);
    expect(screen.getByRole("link", { name: "Rice 5kg" })).toHaveAttribute(
      "href",
      "/admin/products/1",
    );
  });
});
