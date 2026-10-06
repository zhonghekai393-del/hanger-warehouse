import { describe, expect, it } from "vitest";
import { validateLocalSnapshot } from "@/src/lib/local/backup";
import type { LocalSnapshot } from "@/src/lib/local/types";

function makeSnapshot(): LocalSnapshot {
  return {
    format: "hanger-warehouse-local",
    version: 1,
    exportedAt: "2026-10-06T00:00:00.000Z",
    products: [{ id: "product-1", name: "塑料衣架", isActive: true, createdAt: "2026-10-06T00:00:00.000Z" }],
    variants: [{ id: "variant-1", productId: "product-1", model: "A01", sku: "YJ-A01", unit: "个", packSize: 100, minimumStock: 100, isActive: true, createdAt: "2026-10-06T00:00:00.000Z" }],
    warehouses: [{ id: "warehouse-main", name: "主仓库", code: "MAIN", isActive: true }],
    inventory: [{ id: "inventory-1", variantId: "variant-1", warehouseId: "warehouse-main", quantity: 2000, updatedAt: "2026-10-06T00:00:00.000Z" }],
    movements: [{ id: "movement-1", movementNo: "MOV001", variantId: "variant-1", warehouseId: "warehouse-main", type: "IN", quantity: 2000, inputQuantity: 20, inputUnit: "箱", beforeQuantity: 0, afterQuantity: 2000, operator: "admin", createdAt: "2026-10-06T00:00:00.000Z" }],
    settings: [],
  };
}

describe("local backup format", () => {
  it("accepts a complete snapshot and preserves its records", () => {
    const snapshot = makeSnapshot();
    expect(validateLocalSnapshot(snapshot)).toEqual(snapshot);
  });

  it("rejects a snapshot without the products array", () => {
    const snapshot = makeSnapshot() as unknown as Record<string, unknown>;
    delete snapshot.products;
    expect(() => validateLocalSnapshot(snapshot)).toThrow("备份文件缺少 products 数据");
  });

  it("rejects a movement whose balance does not add up", () => {
    const snapshot = makeSnapshot();
    snapshot.movements[0].afterQuantity = 1999;
    expect(() => validateLocalSnapshot(snapshot)).toThrow("流水余额不一致");
  });

  it("rejects dangling references and negative inventory", () => {
    const snapshot = makeSnapshot();
    snapshot.variants[0].productId = "missing-product";
    expect(() => validateLocalSnapshot(snapshot)).toThrow("型号关联的商品系列不存在");

    const invalidInventory = makeSnapshot();
    invalidInventory.inventory[0].quantity = -1;
    expect(() => validateLocalSnapshot(invalidInventory)).toThrow("库存数量不能为负数");
  });

  it("rejects unsupported backup versions", () => {
    const snapshot = { ...makeSnapshot(), version: 2 };
    expect(() => validateLocalSnapshot(snapshot)).toThrow("不支持的备份版本");
  });
});
