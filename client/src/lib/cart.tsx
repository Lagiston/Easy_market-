import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { LocalizedName } from "@es-market/core";

// Snapshot of the product at add time — display-only; the order placement API
// revalidates price and stock server-side.
export type CartItem = {
  productId: string;
  name: LocalizedName;
  price: number;
  imageUrl: string | null;
  stock: number;
  quantity: number;
  // Optional (not required-but-nullable like the server's StorefrontProduct
  // type) since loadCart's runtime guard below reads arbitrary pre-existing
  // localStorage JSON that predates these fields.
  size?: string | null;
  color?: string | null;
};

type CartContextValue = {
  items: CartItem[];
  totalQuantity: number;
  subtotal: number;
  addItem: (product: Omit<CartItem, "quantity">, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  // Re-inserts a previously removed item at its original position — powers
  // CartPage.tsx's undo bar, where "moved to the end" would read as a bug
  // (the item visibly jumping down the list) rather than a true undo.
  // No-ops if the item is already back (e.g. a fast double-click on Undo).
  restoreItem: (item: CartItem, index: number) => void;
  clearCart: () => void;
};

const STORAGE_KEY = "es-market-cart";

const CartContext = createContext<CartContextValue | null>(null);

function loadCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as CartItem).productId === "string" &&
        typeof (item as CartItem).name === "object" &&
        typeof (item as CartItem).price === "number" &&
        typeof (item as CartItem).stock === "number" &&
        typeof (item as CartItem).quantity === "number" &&
        (item as CartItem).quantity > 0,
    );
  } catch {
    return [];
  }
}

function clampQuantity(quantity: number, stock: number) {
  if (stock === 0) return 0;
  return Math.max(1, Math.min(quantity, stock));
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(loadCart);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartContextValue>(() => {
    return {
      items,
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      addItem: (product, quantity = 1) =>
        setItems((current) => {
          const existing = current.find((item) => item.productId === product.productId);
          if (!existing) {
            const clamped = clampQuantity(quantity, product.stock);
            // Out of stock — nothing to add rather than a zero-quantity item.
            if (clamped === 0) return current;
            return [...current, { ...product, quantity: clamped }];
          }
          const clamped = clampQuantity(existing.quantity + quantity, product.stock);
          if (clamped === 0) {
            return current.filter((item) => item.productId !== product.productId);
          }
          // Refresh the snapshot too — the product may have changed since it was added.
          return current.map((item) =>
            item.productId === product.productId ? { ...product, quantity: clamped } : item,
          );
        }),
      updateQuantity: (productId, quantity) =>
        setItems((current) => {
          const existing = current.find((item) => item.productId === productId);
          if (!existing) return current;
          const clamped = clampQuantity(quantity, existing.stock);
          if (clamped === 0) return current.filter((item) => item.productId !== productId);
          return current.map((item) =>
            item.productId === productId ? { ...item, quantity: clamped } : item,
          );
        }),
      removeItem: (productId) =>
        setItems((current) => current.filter((item) => item.productId !== productId)),
      restoreItem: (item, index) =>
        setItems((current) => {
          if (current.some((existing) => existing.productId === item.productId)) return current;
          const next = [...current];
          next.splice(Math.min(index, next.length), 0, item);
          return next;
        }),
      clearCart: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used within a CartProvider");
  return context;
}
