import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("product variant API", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let postVariant: typeof import("@/app/api/variants/route").POST;
  let createSession: typeof import("@/src/lib/auth/session").createSession;
  let sessionCookie: typeof import("@/src/lib/auth/session").sessionCookie;
  let userId: string;
  let productId: string;
  let variantId: string;
  let extraWarehouseId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ POST: postVariant } = await import("@/app/api/variants/route"));
    ({ createSession, sessionCookie } = await import("@/src/lib/auth/session"));
    const product = await pool.query<{ id: string }>("INSERT INTO products (name) VALUES ($1) RETURNING id", [`型号接口测试-${randomUUID()}`]);
    const user = await pool.query<{ id: string }>("INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'ADMIN') RETURNING id", [`variant-${randomUUID()}`]);
    const warehouse = await pool.query<{ id: string }>("INSERT INTO warehouses (name, code) VALUES ($1, $2) RETURNING id", [`额外仓库-${randomUUID()}`, `EXTRA-${randomUUID()}`]);
    productId = product.rows[0].id;
    userId = user.rows[0].id;
    extraWarehouseId = warehouse.rows[0].id;
  });

  it("creates a V1 balance row only in the main warehouse", async () => {
    const token = await createSession(userId);
    const response = await postVariant(new Request("http://localhost/api/variants", {
      method: "POST",
      headers: { "content-type": "application/json", cookie: sessionCookie(token) },
      body: JSON.stringify({ productId, model: "A01", sku: `V1-${randomUUID()}`, unit: "个", packSize: 100, minimumStock: 0 }),
    }));
    expect(response.status).toBe(201);
    variantId = (await response.json()).data.id;

    const balances = await pool.query<{ code: string; quantity: number }>(
      "SELECT w.code, i.quantity FROM inventory i JOIN warehouses w ON w.id = i.warehouse_id WHERE i.variant_id = $1 ORDER BY w.code",
      [variantId],
    );
    expect(balances.rows).toEqual([{ code: "MAIN", quantity: 0 }]);
  });

  afterAll(async () => {
    if (!pool) return;
    if (variantId) await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    if (variantId) await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    if (productId) await pool.query("DELETE FROM products WHERE id = $1", [productId]);
    if (userId) {
      await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
      await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    }
    if (extraWarehouseId) await pool.query("DELETE FROM warehouses WHERE id = $1", [extraWarehouseId]);
    await pool.end();
  });
});
