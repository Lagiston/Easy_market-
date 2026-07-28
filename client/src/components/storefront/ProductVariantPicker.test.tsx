import { render, screen } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryRouter } from "react-router";
import i18n from "@/i18n";
import ProductVariantPicker from "./ProductVariantPicker";
import type { StorefrontProduct } from "@/pages/storefront/ProductsPage";

const base: StorefrontProduct = {
  id: "p1",
  name: { en: "Shirt" },
  description: null,
  price: 1000,
  stock: 10,
  images: [],
  tags: [],
  size: null,
  color: null,
  category: { id: "c1", name: { en: "Clothing" } },
  averageRating: null,
  reviewCount: 0,
};

function renderPicker(product: StorefrontProduct, relatedProducts: StorefrontProduct[]) {
  render(
    <MemoryRouter>
      <ProductVariantPicker product={product} relatedProducts={relatedProducts} />
    </MemoryRouter>,
  );
}

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

  it("only renders the size row when no group member has a color, and vice versa", () => {
    const current = { ...base, size: null, color: "Red" };
    const relatedProducts = [{ ...base, id: "p2", size: null, color: "Blue" }];
    renderPicker(current, relatedProducts);

    expect(screen.queryByText("Size")).not.toBeInTheDocument();
    expect(screen.getByText("Color")).toBeInTheDocument();
  });
});
