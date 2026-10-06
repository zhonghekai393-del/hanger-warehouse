import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("出入库记录删除接口", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let deleteMovement: typeof import("@/app/api/movements/route").DELETE;
  let createSession: typeof import("@/src/lib/auth/session").createSession;
  let sessionCookie: typeof import("@/src/lib/auth/session").sessionCookie;
  let userId: string;
  let productId: string;
  let variantId: string;
  let warehouseId: string;
  let firstMovementId: string;
  let latestMovementId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ DELETE: deleteMovement } = await import("@/app/api/movements/route"));
    ({ createSession, sessionCookie } = await import("@/src/lib/auth/session"));
    const product = await pool.query<{ id: string }>("INSERT INTO products (name) VALUES ($1) RETURNING id", [`流水删除测试-${randomUUID()}`]);
    const variant = await pool.query<{ id: string }>(
      "INSERT INTO product_variants (product_id, model, sku, unit, pack_size) VALUES ($1, '测试型号', $2, '个', 100) RETURNING id",
      [product.rows[0].id, `DELETE-MOVEMENT-${randomUUID()}`],
    );
    const warehouse = await pool.query<{ id: string }>("INSERT INTO warehouses (name, code) VALUES ($1, $2) RETURNING id", [`流水删除仓库-${randomUUID()}`, `DM-${randomUUID()}`]);
    const user = await pool.query<{ id: string }>("INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'ADMIN') RETURNING id", [`delete-movement-${randomUUID()}`]);
    const movementPrefix = `DELETE-MOV-${randomUUID()}`;
    const firstMovement = await pool.query<{ id: string }>(
      `INSERT INTO stock_movements
        (movement_no, variant_id, warehouse_id, type, quantity, input_quantity, input_unit, before_quantity, after_quantity, operator_id)
       VALUES ($1, $2, $3, 'IN', 100, 1, '箱', 0, 100, $4) RETURNING id`,
      [`${movementPrefix}-1`, variant.rows[0].id, warehouse.rows[0].id, user.rows[0].id],
    );
    const latestMovement = await pool.query<{ id: string }>(
      `INSERT INTO stock_movements
        (movement_no, variant_id, warehouse_id, type, quantity, input_quantity, input_unit, before_quantity, after_quantity, operator_id)
       VALUES ($1, $2, $3, 'OUT', -20, 20, '个', 100, 80, $4) RETURNING id`,
      [`${movementPrefix}-2`, variant.rows[0].id, warehouse.rows[0].id, user.rows[0].id],
    );
    await pool.query("INSERT INTO inventory (variant_id, warehouse_id, quantity) VALUES ($1, $2, 80)", [variant.rows[0].id, warehouse.rows[0].id]);
    productId = product.rows[0].id;
    variantId = variant.rows[0].id;
    warehouseId = warehouse.rows[0].id;
    userId = user.rows[0].id;
    firstMovementId = firstMovement.rows[0].id;
    latestMovementId = latestMovement.rows[0].id;
  });

  it("只能删除最新记录，并把库存回退到上一笔余额", async () => {
    const token = await createSession(userId);
    const request = (id: string) => deleteMovement(
      new Request(`http://localhost/api/movements?id=${id}`, {
        method: "DELETE",
        headers: { cookie: sessionCookie(token) },
      }),
    );

    const oldResponse = await request(firstMovementId);
    expect(oldResponse.status).toBe(409);

    const latestResponse = await request(latestMovementId);
    expect(latestResponse.status).toBe(200);
    const afterLatestDelete = await pool.query<{ quantity: number }>("SELECT quantity FROM inventory WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    expect(afterLatestDelete.rows[0].quantity).toBe(100);

    const firstResponse = await request(firstMovementId);
    expect(firstResponse.status).toBe(200);
    const remaining = await pool.query<{ count: number; quantity: number }>(
      `SELECT (SELECT count(*)::int FROM stock_movements WHERE variant_id = $1) AS count,
              (SELECT quantity FROM inventory WHERE variant_id = $1 AND warehouse_id = $2) AS quantity`,
      [variantId, warehouseId],
    );
    expect(remaining.rows[0]).toEqual({ count: 0, quantity: 0 });
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    if (variantId) await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    if (variantId) await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    if (variantId) await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    if (productId) await pool.query("DELETE FROM products WHERE id = $1", [productId]);
    if (warehouseId) await pool.query("DELETE FROM warehouses WHERE id = $1", [warehouseId]);
    if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.end();
  });
});
