import { describe, expect, it } from "vitest";
import { mapDatabaseRowsToLocalSnapshot } from "@/db/export-local";

describe("postgresql migration mapping", () => {
  it("maps database rows to the local backup format without secrets", () => {
    const snapshot = mapDatabaseRowsToLocalSnapshot({
      products: [{ id: "product-1", name: "塑料衣架", description: null, is_active: true, created_at: "2026-10-06T00:00:00.000Z", updated_at: "2026-10-06T00:00:00.000Z" }],
      variants: [{ id: "variant-1", product_id: "product-1", model: "A01", sku: "YJ-A01", barcode: null, color: "黑色", size: null, material: null, unit: "个", pack_size: 100, minimum_stock: 100, remark: null, is_active: true, created_at: "2026-10-06T00:00:00.000Z", updated_at: "2026-10-06T00:00:00.000Z" }],
      warehouses: [{ id: "warehouse-main", name: "主仓库", code: "MAIN", is_active: true }],
      inventory: [{ id: "inventory-1", variant_id: "variant-1", warehouse_id: "warehouse-main", quantity: 2000, updated_at: "2026-10-06T00:00:00.000Z" }],
      movements: [{ id: "movement-1", movement_no: "MOV001", variant_id: "variant-1", warehouse_id: "warehouse-main", type: "IN", quantity: 2000, input_quantity: 20, input_unit: "箱", before_quantity: 0, after_quantity: 2000, operator: "admin", remark: "首次入库", created_at: "2026-10-06T00:00:00.000Z" }],
    });

    expect(snapshot.movements[0]).toMatchObject({ beforeQuantity: 0, quantity: 2000, afterQuantity: 2000, operator: "admin" });
    expect(JSON.stringify(snapshot)).not.toContain("password_hash");
    expect(JSON.stringify(snapshot)).not.toContain("sessions");
  });

  it("keeps inactive rows and does not create products from categories", () => {
    const snapshot = mapDatabaseRowsToLocalSnapshot({
      products: [{ id: "product-1", name: "已停用系列", description: null, is_active: false, created_at: "2026-10-06T00:00:00.000Z", updated_at: "2026-10-06T00:00:00.000Z" }],
      variants: [],
      warehouses: [],
      inventory: [],
      movements: [],
    });

    expect(snapshot.products).toHaveLength(1);
    expect(snapshot.products[0].isActive).toBe(false);
  });
});
