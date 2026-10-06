import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("商品删除接口", () => {
  let pool: typeof import("@/src/lib/db").pool;
  let deleteProduct: typeof import("@/app/api/products/[id]/route").DELETE;
  let deleteVariant: typeof import("@/app/api/variants/[id]/route").DELETE;
  let createSession: typeof import("@/src/lib/auth/session").createSession;
  let sessionCookie: typeof import("@/src/lib/auth/session").sessionCookie;
  let userId: string;
  let productId: string;
  let variantId: string;

  beforeAll(async () => {
    ({ pool } = await import("@/src/lib/db"));
    ({ DELETE: deleteProduct } = await import("@/app/api/products/[id]/route"));
    ({ DELETE: deleteVariant } = await import("@/app/api/variants/[id]/route"));
    ({ createSession, sessionCookie } = await import("@/src/lib/auth/session"));

    const product = await pool.query<{ id: string }>(
      "INSERT INTO products (name) VALUES ($1) RETURNING id",
      [`删除接口测试-${randomUUID()}`],
    );
    const variant = await pool.query<{ id: string }>(
      "INSERT INTO product_variants (product_id, model, sku, unit, pack_size) VALUES ($1, '测试型号', $2, '个', 100) RETURNING id",
      [product.rows[0].id, `DELETE-${randomUUID()}`],
    );
    const user = await pool.query<{ id: string }>(
      "INSERT INTO users (username, password_hash, role) VALUES ($1, 'test', 'ADMIN') RETURNING id",
      [`delete-${randomUUID()}`],
    );
    productId = product.rows[0].id;
    variantId = variant.rows[0].id;
    userId = user.rows[0].id;
  });

  it("删除商品系列时会隐藏系列及其型号，但保留历史数据", async () => {
    const token = await createSession(userId);
    const response = await deleteProduct(
      new Request(`http://localhost/api/products/${productId}`, {
        method: "DELETE",
        headers: { cookie: sessionCookie(token) },
      }),
      { params: Promise.resolve({ id: productId }) },
    );

    expect(response.status).toBe(200);
    const records = await pool.query<{ product_active: boolean; variant_active: boolean }>(
      `SELECT p.is_active AS product_active, pv.is_active AS variant_active
       FROM products p JOIN product_variants pv ON pv.product_id = p.id
       WHERE p.id = $1 AND pv.id = $2`,
      [productId, variantId],
    );
    expect(records.rows[0]).toEqual({ product_active: false, variant_active: false });
  });

  it("型号删除按钮对应的接口可以单独停用型号", async () => {
    const product = await pool.query<{ id: string }>(
      "INSERT INTO products (name) VALUES ($1) RETURNING id",
      [`单独型号删除测试-${randomUUID()}`],
    );
    const variant = await pool.query<{ id: string }>(
      "INSERT INTO product_variants (product_id, model, sku, unit, pack_size) VALUES ($1, '测试型号', $2, '个', 100) RETURNING id",
      [product.rows[0].id, `DELETE-VARIANT-${randomUUID()}`],
    );
    const token = await createSession(userId);
    const response = await deleteVariant(
      new Request(`http://localhost/api/variants/${variant.rows[0].id}`, {
        method: "DELETE",
        headers: { cookie: sessionCookie(token) },
      }),
      { params: Promise.resolve({ id: variant.rows[0].id }) },
    );

    expect(response.status).toBe(200);
    const record = await pool.query<{ is_active: boolean }>("SELECT is_active FROM product_variants WHERE id = $1", [variant.rows[0].id]);
    expect(record.rows[0].is_active).toBe(false);
    await pool.query("DELETE FROM product_variants WHERE id = $1", [variant.rows[0].id]);
    await pool.query("DELETE FROM products WHERE id = $1", [product.rows[0].id]);
  });

  afterAll(async () => {
    if (!pool) return;
    await pool.query("DELETE FROM sessions WHERE user_id = $1", [userId]);
    if (variantId) await pool.query("DELETE FROM inventory WHERE variant_id = $1", [variantId]);
    if (variantId) await pool.query("DELETE FROM product_variants WHERE id = $1", [variantId]);
    if (productId) await pool.query("DELETE FROM products WHERE id = $1", [productId]);
    if (userId) await pool.query("DELETE FROM users WHERE id = $1", [userId]);
    await pool.end();
  });
});
