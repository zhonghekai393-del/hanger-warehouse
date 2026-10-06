import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("transactional stock movement service", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let applyStockMovement: typeof import("@/src/lib/inventory/service").applyStockMovement;
  let userId: string;
  let variantId: string;
  let warehouseId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ applyStockMovement } = await import("@/src/lib/inventory/service"));
    const category = await pool.query<{ id: string }>("INSERT INTO categories (name) VALUES ($1) RETURNING id", [`测试分类-${randomUUID()}`]);
    const product = await pool.query<{ id: string }>("INSERT INTO products (name, category_id) VALUES ($1, $2) RETURNING id", [`测试商品-${randomUUID()}`, category.rows[0].id]);
    const variant = await pool.query<{ id: string }>(
      `INSERT INTO product_variants (product_id, model, sku, unit, pack_size, minimum_stock)
       VALUES ($1, $2, $3, '个', 100, 100) RETURNING id`,
      [product.rows[0].id, "测试型号", `TEST-${randomUUID()}`],
    );
    const warehouse = await pool.query<{ id: string }>("INSERT INTO warehouses (name, code) VALUES ($1, $2) RETURNING id", [`测试仓库-${randomUUID()}`, `T-${randomUUID()}`]);
    const user = await pool.query<{ id: string }>(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'ADMIN') RETURNING id",
      [`test-${randomUUID()}`],
    );
    variantId = variant.rows[0].id;
    warehouseId = warehouse.rows[0].id;
    userId = user.rows[0].id;
    await pool.query("INSERT INTO inventory (variant_id, warehouse_id, quantity) VALUES ($1, $2, 1000)", [variantId, warehouseId]);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("UPDATE inventory SET quantity = 1000 WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
  });

  it("writes the movement and balance in one call", async () => {
    const result = await applyStockMovement({ variantId, warehouseId, type: "IN", inputQuantity: 20, inputUnit: "箱", operatorId: userId });
    expect(result).toMatchObject({ beforeQuantity: 1000, delta: 2000, afterQuantity: 3000 });
    const movement = await pool.query("SELECT type, quantity, before_quantity, after_quantity FROM stock_movements WHERE id = $1", [result.movementId]);
    expect(movement.rows[0]).toMatchObject({ type: "IN", quantity: 2000, before_quantity: 1000, after_quantity: 3000 });
  });

  it("rejects overdraw without creating a movement", async () => {
    await pool.query("UPDATE inventory SET quantity = 250 WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    await expect(applyStockMovement({ variantId, warehouseId, type: "OUT", inputQuantity: 3, inputUnit: "箱", operatorId: userId })).rejects.toThrow("库存不足");
    const inventory = await pool.query("SELECT quantity FROM inventory WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    const movements = await pool.query("SELECT count(*)::int AS count FROM stock_movements WHERE variant_id = $1", [variantId]);
    expect(inventory.rows[0].quantity).toBe(250);
    expect(movements.rows[0].count).toBe(0);
  });

  it("rolls back both rows when the movement insert fails", async () => {
    await pool.query(`
      CREATE OR REPLACE FUNCTION test_fail_stock_movement() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.remark = 'force failure' THEN RAISE EXCEPTION 'forced integration failure'; END IF;
        RETURN NEW;
      END;
      $$;
    `);
    await pool.query("DROP TRIGGER IF EXISTS test_fail_stock_movement_trigger ON stock_movements");
    await pool.query("CREATE TRIGGER test_fail_stock_movement_trigger AFTER INSERT ON stock_movements FOR EACH ROW EXECUTE FUNCTION test_fail_stock_movement()");
    await expect(applyStockMovement({ variantId, warehouseId, type: "IN", inputQuantity: 1, inputUnit: "个", operatorId: userId, remark: "force failure" })).rejects.toThrow("forced integration failure");
    const inventory = await pool.query("SELECT quantity FROM inventory WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    const movements = await pool.query("SELECT count(*)::int AS count FROM stock_movements WHERE variant_id = $1", [variantId]);
    expect(inventory.rows[0].quantity).toBe(1000);
    expect(movements.rows[0].count).toBe(0);
    await pool.query("DROP TRIGGER test_fail_stock_movement_trigger ON stock_movements");
    await pool.query("DROP FUNCTION test_fail_stock_movement()");
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    await pool.end();
  });
});
