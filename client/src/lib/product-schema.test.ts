import { describe, it, expect } from "vitest";
import { createProductSchema } from "@es-market/core";

// core/ has no test runner of its own (just `tsc --noEmit`), so this lives
// here — same precedent as promo-block-schema.test.ts: the client already
// imports and vitest-tests other @es-market/core schemas directly.
describe("createProductSchema — salePrice", () => {
  const base = {
    name: { en: "Rice 5kg" },
    price: 1000,
    stock: 10,
    lowStockThreshold: 5,
    categoryId: "cat1",
    tags: [],
  };

  it("accepts a salePrice lower than price", () => {
    const result = createProductSchema.parse({ ...base, salePrice: 800 });
    expect(result.salePrice).toBe(800);
  });

  it("rejects a salePrice equal to price", () => {
    const result = createProductSchema.safeParse({ ...base, salePrice: 1000 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.message).toBe(
        "Sale price must be less than the regular price",
      );
      expect(result.error.issues[0]!.path).toEqual(["salePrice"]);
    }
  });

  it("rejects a salePrice higher than price", () => {
    const result = createProductSchema.safeParse({ ...base, salePrice: 1200 });
    expect(result.success).toBe(false);
  });

  it("treats an empty string as no sale price (form-field clearing)", () => {
    const result = createProductSchema.parse({ ...base, salePrice: "" });
    expect(result.salePrice).toBeUndefined();
  });

  it("treats NaN as no sale price (a cleared number input's valueAsNumber)", () => {
    const result = createProductSchema.parse({ ...base, salePrice: Number.NaN });
    expect(result.salePrice).toBeUndefined();
  });

  it("omitting salePrice entirely is valid", () => {
    const result = createProductSchema.parse(base);
    expect(result.salePrice).toBeUndefined();
  });
});
