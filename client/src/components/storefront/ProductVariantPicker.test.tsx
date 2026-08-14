import { render, screen, within } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import ProductVariantPicker, { compareSizes } from "./ProductVariantPicker";
import type { StorefrontProduct } from "@/pages/storefront/ProductsPage";

const base: StorefrontProduct = {
  id: "p1",
  name: { en: "Shirt" },
  description: null,
  price: 1000,
  salePrice: null,
  stock: 10,
  lowStockThreshold: 10,
  images: [],
  tags: [],
  tagNames: {},
  size: null,
  color: null,
  category: { id: "c1", name: { en: "Clothing" } },
  averageRating: null,
  reviewCount: 0,
  wishlistCount: 0,
  createdAt: "2026-07-20T10:00:00.000Z",
};

function renderPicker(product: StorefrontProduct, relatedProducts: StorefrontProduct[]) {
  render(
    <MemoryRouter>
      <ProductVariantPicker product={product} relatedProducts={relatedProducts} />
    </MemoryRouter>,
  );
}

describe("compareSizes", () => {
  it("sorts recognized letter sizes in conventional order", () => {
    expect(["L", "XS", "M", "S"].sort(compareSizes)).toEqual(["XS", "S", "M", "L"]);
  });

  it("is case-insensitive for letter sizes", () => {
    expect(["l", "s", "m"].sort(compareSizes)).toEqual(["s", "m", "l"]);
  });

  it("sorts purely numeric sizes numerically, not lexicographically", () => {
    expect(["40", "9", "38"].sort(compareSizes)).toEqual(["9", "38", "40"]);
  });

  it("sorts unrecognized labels alphabetically, after every recognized size", () => {
    expect(["M", "Custom", "S", "Alpha"].sort(compareSizes)).toEqual([
      "S",
      "M",
      "Alpha",
      "Custom",
    ]);
  });
});

describe("ProductVariantPicker", () => {
  beforeEach(async () => {
    await i18n.changeLanguage("en");
  });

  it("renders nothing when no group member has a size or color", () => {
    const { container } = render(
      <MemoryRouter>
        <ProductVariantPicker product={base} relatedProducts={[{ ...base, id: "p2" }]} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a link per distinct size and color, pointing at the matching sibling", () => {
    const current = { ...base, size: "M", color: "Red" };
    const relatedProducts = [
      { ...base, id: "p2", size: "L", color: "Red" },
      { ...base, id: "p3", size: "M", color: "Blue" },
    ];
    renderPicker(current, relatedProducts);

    expect(screen.getByRole("link", { name: "Select size L" })).toHaveAttribute(
      "href",
      "/products/p2",
    );
    expect(screen.getByRole("link", { name: "Select color Blue" })).toHaveAttribute(
      "href",
      "/products/p3",
    );
  });

  it("marks the current product's own values as pressed", () => {
    const current = { ...base, size: "M", color: "Red" };
    const relatedProducts = [{ ...base, id: "p2", size: "L", color: "Red" }];
    renderPicker(current, relatedProducts);

    expect(screen.getByRole("link", { name: "Select color Red" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("link", { name: "Select size L" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("renders an out-of-stock sibling's option as disabled, not a link", () => {
    const current = { ...base, size: "M", color: null, stock: 5 };
    const relatedProducts = [{ ...base, id: "p2", size: "L", color: null, stock: 0 }];
    renderPicker(current, relatedProducts);

    expect(screen.queryByRole("link", { name: "Select size L" })).not.toBeInTheDocument();
    expect(screen.getByText("L")).toHaveAttribute("aria-disabled", "true");
  });

  it("renders letter sizes in canonical order regardless of group insertion order", () => {
    const current = { ...base, size: "L", color: null };
    const relatedProducts = [
      { ...base, id: "p2", size: "XS", color: null },
      { ...base, id: "p3", size: "M", color: null },
      { ...base, id: "p4", size: "S", color: null },
    ];
    renderPicker(current, relatedProducts);

    const sizeRow = screen.getByText("Size").parentElement!;
    const labels = within(sizeRow)
      .getAllByRole("link")
      .map((link) => link.textContent);
    expect(labels).toEqual(["XS", "S", "M", "L"]);
  });

  it("renders numeric sizes in numeric order", () => {
    const current = { ...base, size: "40", color: null };
    const relatedProducts = [
      { ...base, id: "p2", size: "38", color: null },
      { ...base, id: "p3", size: "9", color: null },
    ];
    renderPicker(current, relatedProducts);

    const sizeRow = screen.getByText("Size").parentElement!;
    const labels = within(sizeRow)
      .getAllByRole("link")
      .map((link) => link.textContent);
    // Numeric comparison, not string comparison — "9" sorts before "38".
    expect(labels).toEqual(["9", "38", "40"]);
  });

  it("only renders the size row when no group member has a color, and vice versa", () => {
    const current = { ...base, size: null, color: "Red" };
    const relatedProducts = [{ ...base, id: "p2", size: null, color: "Blue" }];
    renderPicker(current, relatedProducts);

    expect(screen.queryByText("Size")).not.toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
  });
});
