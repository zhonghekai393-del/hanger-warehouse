import { describe, expect, it } from "vitest";
import { calculateMovement, convertInputToBaseUnits, getStockStatus } from "@/src/lib/inventory/rules";

describe("convertInputToBaseUnits", () => {
  it("converts boxes into the smallest inventory unit", () => {
    expect(convertInputToBaseUnits({ quantity: 20, unit: "箱", baseUnit: "个", packSize: 100 })).toBe(2000);
  });

  it("keeps base-unit input unchanged", () => {
    expect(convertInputToBaseUnits({ quantity: 20, unit: "个", baseUnit: "个", packSize: 100 })).toBe(20);
  });

  it.each([
    { quantity: 0, unit: "箱", packSize: 100 },
    { quantity: 1.5, unit: "箱", packSize: 100 },
    { quantity: 1, unit: "箱", packSize: 0 },
    { quantity: 1, unit: "袋", packSize: 100 },
  ])("rejects invalid conversion input %#", ({ quantity, unit, packSize }) => {
    expect(() => convertInputToBaseUnits({ quantity, unit, baseUnit: "个", packSize })).toThrow();
  });
});

describe("calculateMovement", () => {
  it("adds converted IN stock", () => {
    expect(
      calculateMovement({
        type: "IN",
        currentQuantity: 1000,
        inputQuantity: 20,
        inputUnit: "箱",
        baseUnit: "个",
        packSize: 100,
      }),
    ).toEqual({ delta: 2000, afterQuantity: 3000, storedInputQuantity: 20, storedInputUnit: "箱" });
  });

  it("subtracts converted OUT stock", () => {
    expect(
      calculateMovement({
        type: "OUT",
        currentQuantity: 3000,
        inputQuantity: 5,
        inputUnit: "箱",
        baseUnit: "个",
        packSize: 100,
      }),
    ).toEqual({ delta: -500, afterQuantity: 2500, storedInputQuantity: 5, storedInputUnit: "箱" });
  });

  it("rejects an OUT movement that would create negative stock", () => {
    expect(() =>
      calculateMovement({
        type: "OUT",
        currentQuantity: 250,
        inputQuantity: 3,
        inputUnit: "箱",
        baseUnit: "个",
        packSize: 100,
      }),
    ).toThrow("库存不足");
  });

  it("calculates adjustment from actual counted stock", () => {
    expect(
      calculateMovement({
        type: "ADJUSTMENT",
        currentQuantity: 2500,
        inputQuantity: 2490,
        inputUnit: "个",
        baseUnit: "个",
        packSize: 100,
        actualQuantity: 2490,
      }),
    ).toEqual({ delta: -10, afterQuantity: 2490, storedInputQuantity: 2490, storedInputUnit: "个" });
  });

  it("rejects an adjustment without a stock difference", () => {
    expect(() =>
      calculateMovement({
        type: "ADJUSTMENT",
        currentQuantity: 2500,
        inputQuantity: 2500,
        inputUnit: "个",
        baseUnit: "个",
        packSize: 100,
        actualQuantity: 2500,
      }),
    ).toThrow("没有库存差异");
  });
});

describe("getStockStatus", () => {
  it("maps quantity to the requested stock states", () => {
    expect(getStockStatus(0, 500)).toBe("OUT");
    expect(getStockStatus(500, 500)).toBe("LOW");
    expect(getStockStatus(501, 500)).toBe("NORMAL");
  });
});
