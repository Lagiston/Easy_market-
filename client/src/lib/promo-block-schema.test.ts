import { describe, it, expect } from "vitest";
import { updatePromoBlockSchema } from "@es-market/core";

// core/ has no test runner of its own (just `tsc --noEmit`), so this
// regression lives here — the client already imports and vitest-tests other
// @es-market/core schemas directly (see PromoBlockForm.tsx's own usage).
//
// Regression: PromoBlockForm.tsx submits the *already-transformed* output of
// this schema (produced client-side by RHF's zodResolver) as the raw request
// body, and the server re-validates that same JSON with this identical
// schema — so any transform here effectively runs twice per real submission.
// Found live: the original endsAt "bump to end of day" transform added 24h
// unconditionally, so a picked "2026-08-05" end date round-tripped to
// "2026-08-06" the next time the edit dialog opened.
describe("updatePromoBlockSchema — endsAt double-transform idempotency", () => {
  const base = {
    headline: { en: "Sale", ar: "" },
    copy: { en: "", ar: "" },
    ctaLabel: "",
    ctaUrl: "",
    isActive: true,
    startsAt: "",
    sortOrder: 0,
  };

  it("bumps a fresh date-only endsAt to the end of that day", () => {
    const result = updatePromoBlockSchema.parse({ ...base, endsAt: "2026-08-05" });
    expect(result.endsAt).toEqual(new Date("2026-08-05T23:59:59.999Z"));
  });

  it("leaves an already end-of-day endsAt unchanged when re-parsed (the double-submit case)", () => {
    const firstPass = updatePromoBlockSchema.parse({ ...base, endsAt: "2026-08-05" });
    // Simulates the server re-validating the client's already-transformed
    // JSON body — Dates serialize to ISO strings over the wire.
    const secondPass = updatePromoBlockSchema.parse({
      ...base,
      endsAt: firstPass.endsAt!.toISOString(),
    });
    expect(secondPass.endsAt).toEqual(firstPass.endsAt);
  });
});
