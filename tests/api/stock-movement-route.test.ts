import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("stock movement API", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let postMovement: typeof import("@/app/api/stock/movements/route").POST;
  let createSession: typeof import("@/src/lib/auth/session").createSession;
  let sessionCookie: typeof import("@/src/lib/auth/session").sessionCookie;
  let userId: string;
  let variantId: string;
  let warehouseId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ POST: postMovement } = await import("@/app/api/stock/movements/route"));
    ({ createSession, sessionCookie } = await import("@/src/lib/auth/session"));
    const product = await pool.query<{ id: string }>("INSERT INTO products (name) VALUES ($1) RETURNING id", [`API商品-${randomUUID()}`]);
    const variant = await pool.query<{ id: string }>("INSERT INTO product_variants (product_id, model, sku, unit, pack_size) VALUES ($1, 'API型号', $2, '个', 100) RETURNING id", [product.rows[0].id, `API-${randomUUID()}`]);
    const warehouse = await pool.query<{ id: string }>("INSERT INTO warehouses (name, code) VALUES ($1, $2) RETURNING id", [`API仓库-${randomUUID()}`, `A-${randomUUID()}`]);
    const user = await pool.query<{ id: string }>("INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'OPERATOR') RETURNING id", [`api-${randomUUID()}`]);
    userId = user.rows[0].id;
    variantId = variant.rows[0].id;
    warehouseId = warehouse.rows[0].id;
    await pool.query("INSERT INTO inventory (variant_id, warehouse_id, quantity) VALUES ($1, $2, 1000)", [variantId, warehouseId]);
  });

  beforeEach(async () => {
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("UPDATE inventory SET quantity = 1000 WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
  });

  async function request(body: Record<string, unknown>) {
    const token = await createSession(userId);
    return postMovement(new Request("http://localhost/api/stock/movements", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie(token) },
      body: JSON.stringify(body),
    }));
  }

  it("returns the authoritative before/delta/after result", async () => {
    const response = await request({ variantId, warehouseId, type: "IN", inputQuantity: 20, inputUnit: "箱" });
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ data: { beforeQuantity: 1000, delta: 2000, afterQuantity: 3000 } });
  });

  it("returns 409 and does not write when stock is insufficient", async () => {
    await pool.query("UPDATE inventory SET quantity = 250 WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    const response = await request({ variantId, warehouseId, type: "OUT", inputQuantity: 3, inputUnit: "箱" });
    expect(response.status).toBe(409);
    const inventory = await pool.query("SELECT quantity FROM inventory WHERE variant_id = $1 AND warehouse_id = $2", [variantId, warehouseId]);
    expect(inventory.rows[0].quantity).toBe(250);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM stock_movements WHERE variant_id = $1", [variantId]);
    await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    await pool.end();
  });
});
