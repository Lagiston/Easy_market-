import { act, renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { CartProvider, useCart } from "./cart";

const product = {
  productId: "p1",
  name: { en: "Rice 5kg" },
  price: 1500,
  imageUrl: null,
  stock: 5,
};

function renderCart() {
  return renderHook(() => useCart(), { wrapper: CartProvider });
}

describe("cart", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("adds a new item with the requested quantity", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 2));

    expect(result.current.items).toEqual([{ ...product, quantity: 2 }]);
    expect(result.current.totalQuantity).toBe(2);
    expect(result.current.subtotal).toBe(3000);
  });

  it("does not add an out-of-stock product", () => {
    const { result } = renderCart();

    act(() => result.current.addItem({ ...product, stock: 0 }));

    expect(result.current.items).toEqual([]);
  });

  it("merges quantities when adding an already-cart product again", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 2));
    act(() => result.current.addItem(product, 1));

    expect(result.current.items).toEqual([{ ...product, quantity: 3 }]);
  });

  it("clamps the merged quantity to the product's stock", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 3));
    act(() => result.current.addItem(product, 10));

    expect(result.current.items).toEqual([{ ...product, quantity: 5 }]);
  });

  it("refreshes the item's snapshot (price/stock) on a repeat add", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 1));
    act(() => result.current.addItem({ ...product, price: 1200, stock: 8 }, 1));

    expect(result.current.items).toEqual([
      { ...product, price: 1200, stock: 8, quantity: 2 },
    ]);
  });

  it("removes the item if a repeat add clamps its quantity to zero (product went out of stock)", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 2));
    act(() => result.current.addItem({ ...product, stock: 0 }, 1));

    expect(result.current.items).toEqual([]);
  });

  it("updateQuantity clamps to stock and floors at 1 for an in-stock item", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 2));
    act(() => result.current.updateQuantity(product.productId, 0));

    expect(result.current.items[0]!.quantity).toBe(1);
  });

  it("removeItem removes the item outright", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 1));
    act(() => result.current.removeItem(product.productId));

    expect(result.current.items).toEqual([]);
  });

  it("clearCart empties the cart", () => {
    const { result } = renderCart();

    act(() => result.current.addItem(product, 1));
    act(() => result.current.clearCart());

    expect(result.current.items).toEqual([]);
  });

  it("persists items to localStorage and reloads them for a fresh provider", () => {
    const { result, unmount } = renderCart();
    act(() => result.current.addItem(product, 2));
    unmount();

    const { result: reloaded } = renderCart();
    expect(reloaded.current.items).toEqual([{ ...product, quantity: 2 }]);
  });

  it("drops a corrupt or invalid persisted cart rather than throwing", () => {
    window.localStorage.setItem("es-market-cart", "not json");
    const { result } = renderCart();

    expect(result.current.items).toEqual([]);
  });
});
