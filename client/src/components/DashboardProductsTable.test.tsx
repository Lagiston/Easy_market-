import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import DashboardProductsTable from "./DashboardProductsTable";
import type { ProductRow } from "@/components/ProductsTable";

const baseProduct: ProductRow = {
  id: "1",
  name: { en: "Rice 5kg" },
  description: null,
  price: 1500,
  stock: 20,
  lowStockThreshold: 10,
  imageUrl: null,
  category: { id: "c1", name: { en: "Groceries" } },
};

describe("DashboardProductsTable", () => {
  it("shows an In stock badge when stock is above the low-stock threshold", () => {
    render(<DashboardProductsTable products={[{ ...baseProduct, stock: 20 }]} />);
    expect(screen.getByText("In stock")).toBeInTheDocument();
  });

  it("shows a Low stock badge when stock is below the threshold but not zero", () => {
    render(<DashboardProductsTable products={[{ ...baseProduct, stock: 5 }]} />);
    expect(screen.getByText("Low stock")).toBeInTheDocument();
  });

  it("shows an Out of stock badge when stock is zero", () => {
    render(<DashboardProductsTable products={[{ ...baseProduct, stock: 0 }]} />);
    expect(screen.getByText("Out of stock")).toBeInTheDocument();
  });
});
