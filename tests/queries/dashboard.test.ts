import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("dashboard query", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let getDashboard: typeof import("@/src/lib/queries/dashboard").getDashboard;
  let variantId: string;
  let warehouseId: string;
  let userId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ getDashboard } = await import("@/src/lib/queries/dashboard"));
    const product = await pool.query<{ id: string }>("INSERT INTO products (name) VALUES ($1) RETURNING id", [`看板商品-${randomUUID()}`]);
    const variant = await pool.query<{ id: string }>("INSERT INTO product_variants (product_id, model, sku, unit, pack_size, minimum_stock) VALUES ($1, '看板型号', $2, '个', 100, 100) RETURNING id", [product.rows[0].id, `DASH-${randomUUID()}`]);
    const warehouse = await pool.query<{ id: string }>("INSERT INTO warehouses (name, code) VALUES ($1, $2) RETURNING id", [`看板仓库-${randomUUID()}`, `D-${randomUUID()}`]);
    const user = await pool.query<{ id: string }>("INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'ADMIN') RETURNING id", [`dash-${randomUUID()}`]);
    variantId = variant.rows[0].id;
    warehouseId = warehouse.rows[0].id;
    userId = user.rows[0].id;
    await pool.query("INSERT INTO inventory (variant_id, warehouse_id, quantity) VALUES ($1, $2, 0)", [variantId, warehouseId]);
    await pool.query("INSERT INTO stock_movements (movement_no, variant_id, warehouse_id, type, quantity, input_quantity, input_unit, before_quantity, after_quantity, operator_id) VALUES ('DASH-' || $1, $2, $3, 'IN', 100, 1, '箱', 0, 100, $4)", [randomUUID(), variantId, warehouseId, userId]);
  });

  it("returns SKU, quantity, low-stock, and today movement totals", async () => {
    const result = await getDashboard();
    expect(result).toMatchObject({ skuCount: expect.any(Number), totalQuantity: expect.any(Number), todayIn: expect.any(Number), todayOut: expect.any(Number) });
    expect(result.lowCount + result.outCount).toBeGreaterThanOrEqual(1);
    expect(result.outCount).toBeGreaterThanOrEqual(1);
    expect(result.todayIn).toBeGreaterThanOrEqual(100);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.end();
  });
});
