import { describe, it, expect } from "vitest";
import { createReviewSchema, REVIEW_HEADLINE_MAX_LENGTH } from "@es-market/core";

// core/ has no test runner of its own (just `tsc --noEmit`), so this lives
// here — same precedent as promo-block-schema.test.ts: the client already
// imports and vitest-tests other @es-market/core schemas directly.
describe("createReviewSchema — headline", () => {
  const base = { authorName: "Jane Doe", rating: 5 };

  it("accepts a headline within the length cap", () => {
    const result = createReviewSchema.parse({ ...base, headline: "Great value" });
    expect(result.headline).toBe("Great value");
  });

  it("treats an empty string as no headline (form-field clearing)", () => {
    const result = createReviewSchema.parse({ ...base, headline: "" });
    expect(result.headline).toBeUndefined();
  });

  it("omitting headline entirely is valid", () => {
    const result = createReviewSchema.parse(base);
    expect(result.headline).toBeUndefined();
  });

  it(`rejects a headline over ${REVIEW_HEADLINE_MAX_LENGTH} characters`, () => {
    const result = createReviewSchema.safeParse({
      ...base,
      headline: "a".repeat(REVIEW_HEADLINE_MAX_LENGTH + 1),
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]!.path).toEqual(["headline"]);
    }
  });

  it(`accepts a headline exactly at the ${REVIEW_HEADLINE_MAX_LENGTH}-character cap`, () => {
    const result = createReviewSchema.parse({
      ...base,
      headline: "a".repeat(REVIEW_HEADLINE_MAX_LENGTH),
    });
    expect(result.headline).toHaveLength(REVIEW_HEADLINE_MAX_LENGTH);
  });
});
