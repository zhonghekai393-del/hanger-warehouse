import { describe, expect, it } from "vitest";
import type { LocalState } from "@/src/lib/local/types";
import { applyMovementToState, calculateDashboardMetrics, deleteLatestMovementFromState } from "@/src/lib/local/domain";

function makeState(quantity = 0): LocalState {
  return {
    products: [{ id: "product-1", name: "塑料衣架", description: "衣架商品系列", isActive: true, createdAt: "2026-10-06T00:00:00.000Z" }],
    variants: [{ id: "variant-1", productId: "product-1", model: "A01", sku: "YJ-A01", color: "黑色", unit: "个", packSize: 100, minimumStock: 100, isActive: true, createdAt: "2026-10-06T00:00:00.000Z" }],
    warehouses: [{ id: "warehouse-main", name: "主仓库", code: "MAIN", isActive: true }],
    inventory: [{ id: "inventory-1", variantId: "variant-1", warehouseId: "warehouse-main", quantity, updatedAt: "2026-10-06T00:00:00.000Z" }],
    movements: [],
    settings: [],
  };
}

describe("local inventory domain", () => {
  it("applies an IN movement and stores before/after balances", () => {
    const result = applyMovementToState(makeState(), {
      variantId: "variant-1",
      warehouseId: "warehouse-main",
      type: "IN",
      inputQuantity: 20,
      inputUnit: "箱",
      remark: "首次入库",
      operator: "本机用户",
      createdAt: "2026-10-06T00:00:00.000Z",
    });

    expect(result.movement).toMatchObject({ beforeQuantity: 0, quantity: 2000, afterQuantity: 2000, inputQuantity: 20, inputUnit: "箱" });
    expect(result.state.inventory[0].quantity).toBe(2000);
  });

  it("rejects an OUT movement that would create negative stock", () => {
    expect(() => applyMovementToState(makeState(250), {
      variantId: "variant-1",
      warehouseId: "warehouse-main",
      type: "OUT",
      inputQuantity: 3,
      inputUnit: "箱",
      operator: "本机用户",
      createdAt: "2026-10-06T00:01:00.000Z",
    })).toThrow("库存不足");
  });

  it("applies an adjustment to the counted quantity", () => {
    const result = applyMovementToState(makeState(2500), {
      variantId: "variant-1",
      warehouseId: "warehouse-main",
      type: "ADJUSTMENT",
      inputQuantity: 2490,
      inputUnit: "个",
      actualQuantity: 2490,
      remark: "盘点差异",
      operator: "本机用户",
      createdAt: "2026-10-06T00:02:00.000Z",
    });

    expect(result.movement).toMatchObject({ quantity: -10, beforeQuantity: 2500, afterQuantity: 2490 });
  });

  it("does not allow an inactive variant to receive new stock", () => {
    const state = makeState();
    state.variants[0].isActive = false;
    expect(() => applyMovementToState(state, {
      variantId: "variant-1",
      warehouseId: "warehouse-main",
      type: "IN",
      inputQuantity: 1,
      inputUnit: "个",
      operator: "本机用户",
      createdAt: "2026-10-06T00:03:00.000Z",
    })).toThrow("型号已停用");
  });

  it("deletes only the newest movement and restores its before balance", () => {
    const afterIn = applyMovementToState(makeState(), {
      variantId: "variant-1", warehouseId: "warehouse-main", type: "IN", inputQuantity: 20, inputUnit: "箱", operator: "本机用户", createdAt: "2026-10-06T00:00:00.000Z",
    });
    const afterOut = applyMovementToState(afterIn.state, {
      variantId: "variant-1", warehouseId: "warehouse-main", type: "OUT", inputQuantity: 5, inputUnit: "箱", operator: "本机用户", createdAt: "2026-10-06T00:01:00.000Z",
    });

    expect(() => deleteLatestMovementFromState(afterOut.state, afterIn.movement.id)).toThrow("只能删除最新一条记录");
    const restored = deleteLatestMovementFromState(afterOut.state, afterOut.movement.id);
    expect(restored.inventory[0].quantity).toBe(afterIn.state.inventory[0].quantity);
    expect(restored.movements).toHaveLength(1);
  });

  it("counts active stock and today's movements", () => {
    let state = makeState();
    state = applyMovementToState(state, {
      variantId: "variant-1", warehouseId: "warehouse-main", type: "IN", inputQuantity: 20, inputUnit: "箱", operator: "本机用户", createdAt: "2026-10-06T00:00:00.000Z",
    }).state;
    state = applyMovementToState(state, {
      variantId: "variant-1", warehouseId: "warehouse-main", type: "OUT", inputQuantity: 5, inputUnit: "箱", operator: "本机用户", createdAt: "2026-10-06T01:00:00.000Z",
    }).state;

    expect(calculateDashboardMetrics(state, new Date("2026-10-06T08:00:00.000Z"))).toMatchObject({ skuCount: 1, totalQuantity: 1500, todayIn: 2000, todayOut: 500, lowCount: 0, outCount: 0 });
  });
});
