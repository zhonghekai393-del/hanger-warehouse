import { describe, expect, it } from "vitest";
import { updateVariantQuantity } from "@/src/lib/inventory/client-state";

describe("inventory client state", () => {
  it("updates only the variant whose movement just succeeded", () => {
    const variants = [
      { id: "a", quantity: 2000, model: "A01" },
      { id: "b", quantity: 500, model: "B01" },
    ];

    expect(updateVariantQuantity(variants, "a", 1500)).toEqual([
      { id: "a", quantity: 1500, model: "A01" },
      { id: "b", quantity: 500, model: "B01" },
    ]);
  });
});
