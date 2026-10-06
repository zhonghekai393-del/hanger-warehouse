import { describe, expect, it } from "vitest";
import { loginSchema, movementRequestSchema, productVariantInputSchema } from "@/src/lib/api/validation";

describe("API input validation", () => {
  it("rejects blank credentials", () => {
    expect(loginSchema.safeParse({ username: "", password: "" }).success).toBe(false);
  });

  it("rejects a variant with an invalid SKU or pack size", () => {
    const result = productVariantInputSchema.safeParse({ productId: "p", model: "A01", sku: "", packSize: 0, minimumStock: 0 });
    expect(result.success).toBe(false);
  });

  it("rejects a client-supplied final inventory value", () => {
    const result = movementRequestSchema.safeParse({
      variantId: "v",
      warehouseId: "w",
      type: "OUT",
      inputQuantity: 5,
      inputUnit: "箱",
      afterQuantity: 0,
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-UUID resource identifiers at the API boundary", () => {
    const result = movementRequestSchema.safeParse({
      variantId: "not-a-uuid",
      warehouseId: "also-not-a-uuid",
      type: "IN",
      inputQuantity: 1,
      inputUnit: "个",
    });
    expect(result.success).toBe(false);
  });
});
