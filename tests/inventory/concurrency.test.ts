import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("concurrent stock movements", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let applyStockMovement: typeof import("@/src/lib/inventory/service").applyStockMovement;
  let userId: string;
  let variantId: string;
  let warehouseId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ applyStockMovement } = await import("@/src/lib/inventory/service"));
    const product = await pool.query<{ id: string }>("INSERT INTO products (name) VALUES ($1) RETURNING id", [`并发测试商品-${randomUUID()}`]);
    const variant = await pool.query<{ id: string }>(
      `INSERT INTO product_variants (product_id, model, sku, unit, pack_size)
       VALUES ($1, '并发型号', $2, '个', 100) RETURNING id`,
      [product.rows[0].id, `CON-${randomUUID()}`],
    );
    const warehouse = await pool.query<{ id: string }>("INSERT INTO warehouses (name, code) VALUES ($1, $2) RETURNING id", [`并发仓库-${randomUUID()}`, `C-${randomUUID()}`]);
    const user = await pool.query<{ id: string }>("INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'ADMIN') RETURNING id", [`con-${randomUUID()}`]);
    variantId = variant.rows[0].id;
    warehouseId = warehouse.rows[0].id;
    userId = user.rows[0].id;
    await pool.query("INSERT INTO inventory (variant_id, warehouse_id, quantity) VALUES ($1, $2, 500)", [variantId, warehouseId]);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("UPDATE inventory SET quantity = 500 WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
  });

  it("serializes competing OUT operations on the same inventory row", async () => {
    const results = await Promise.allSettled([
      applyStockMovement({ variantId, warehouseId, type: "OUT", inputQuantity: 4, inputUnit: "箱", operatorId: userId }),
      applyStockMovement({ variantId, warehouseId, type: "OUT", inputQuantity: 2, inputUnit: "箱", operatorId: userId }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    const inventory = await pool.query("SELECT quantity FROM inventory WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    expect(inventory.rows[0].quantity).toBe(100);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    await pool.end();
  });
});
