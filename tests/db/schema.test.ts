import { afterAll, describe, expect, it } from "vitest";

const databaseUrl = process.env.DATABASE_URL;

describe.skipIf(!databaseUrl)("initial PostgreSQL schema", () => {
  it("creates the warehouse tables and uniqueness constraints", async () => {
    const { pool } = await import("@/src/lib/db");
    const tables = await pool.query<{ table_name: string }>(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = ANY($1::text[])`,
      [["users", "products", "product_variants", "warehouses", "inventory", "stock_movements"]],
    );

    expect(tables.rows.map((row) => row.table_name).sort()).toEqual([
      "inventory",
      "product_variants",
      "products",
      "stock_movements",
      "users",
      "warehouses",
    ]);

    const constraints = await pool.query<{ constraint_name: string }>(
      `SELECT constraint_name
       FROM information_schema.table_constraints
       WHERE constraint_schema = 'public'
         AND constraint_name = ANY($1::text[])`,
      [["product_variants_sku_key", "inventory_variant_id_warehouse_id_key"]],
    );

    expect(constraints.rows.map((row) => row.constraint_name).sort()).toEqual([
      "inventory_variant_id_warehouse_id_key",
      "product_variants_sku_key",
    ]);

    const barcodeIndex = await pool.query<{ indexname: string }>(
      `SELECT indexname
       FROM pg_indexes
       WHERE schemaname = 'public'
         AND indexname = 'product_variants_barcode_unique'`,
    );
    expect(barcodeIndex.rowCount).toBe(1);

    await pool.end();
  });
});

afterAll(async () => {
  if (!databaseUrl) return;
  const { pool } = await import("@/src/lib/db");
  await pool.end();
});
