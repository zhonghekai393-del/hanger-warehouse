import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/lib/db";
import type { LocalSnapshot } from "../src/lib/local/types";

type DatabaseDate = string | Date;

export type DatabaseRows = {
  products: Array<{ id: string; name: string; description: string | null; is_active: boolean; created_at: DatabaseDate; updated_at: DatabaseDate }>;
  variants: Array<{ id: string; product_id: string; model: string; sku: string; barcode: string | null; color: string | null; size: string | null; material: string | null; unit: string; pack_size: number; minimum_stock: number; remark: string | null; is_active: boolean; created_at: DatabaseDate; updated_at: DatabaseDate }>;
  warehouses: Array<{ id: string; name: string; code: string; is_active: boolean }>;
  inventory: Array<{ id: string; variant_id: string; warehouse_id: string; quantity: number; updated_at: DatabaseDate }>;
  movements: Array<{ id: string; movement_no: string; variant_id: string; warehouse_id: string; type: "IN" | "OUT" | "ADJUSTMENT" | "INITIAL" | "COUNT"; quantity: number; input_quantity: number; input_unit: string; before_quantity: number; after_quantity: number; operator: string; remark: string | null; created_at: DatabaseDate }>;
};

function iso(value: DatabaseDate): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function mapDatabaseRowsToLocalSnapshot(rows: DatabaseRows): LocalSnapshot {
  return {
    format: "hanger-warehouse-local",
    version: 1,
    exportedAt: new Date().toISOString(),
    products: rows.products.map((row) => ({ id: row.id, name: row.name, description: row.description ?? undefined, isActive: row.is_active, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })),
    variants: rows.variants.map((row) => ({ id: row.id, productId: row.product_id, model: row.model, sku: row.sku, barcode: row.barcode ?? undefined, color: row.color ?? undefined, size: row.size ?? undefined, material: row.material ?? undefined, unit: row.unit, packSize: row.pack_size, minimumStock: row.minimum_stock, remark: row.remark ?? undefined, isActive: row.is_active, createdAt: iso(row.created_at), updatedAt: iso(row.updated_at) })),
    warehouses: rows.warehouses.map((row) => ({ id: row.id, name: row.name, code: row.code, isActive: row.is_active })),
    inventory: rows.inventory.map((row) => ({ id: row.id, variantId: row.variant_id, warehouseId: row.warehouse_id, quantity: row.quantity, updatedAt: iso(row.updated_at) })),
    movements: rows.movements.map((row) => ({ id: row.id, movementNo: row.movement_no, variantId: row.variant_id, warehouseId: row.warehouse_id, type: row.type, quantity: row.quantity, inputQuantity: row.input_quantity, inputUnit: row.input_unit, beforeQuantity: row.before_quantity, afterQuantity: row.after_quantity, operator: row.operator, remark: row.remark ?? undefined, createdAt: iso(row.created_at) })),
    settings: [],
  };
}

export async function exportLocalSnapshot(): Promise<LocalSnapshot> {
  const [products, variants, warehouses, inventory, movements] = await Promise.all([
    pool.query<DatabaseRows["products"][number]>("SELECT id, name, description, is_active, created_at, updated_at FROM products ORDER BY created_at, id"),
    pool.query<DatabaseRows["variants"][number]>("SELECT id, product_id, model, sku, barcode, color, size, material, unit, pack_size, minimum_stock, remark, is_active, created_at, updated_at FROM product_variants ORDER BY created_at, id"),
    pool.query<DatabaseRows["warehouses"][number]>("SELECT id, name, code, is_active FROM warehouses ORDER BY created_at, id"),
    pool.query<DatabaseRows["inventory"][number]>("SELECT id, variant_id, warehouse_id, quantity, updated_at FROM inventory ORDER BY variant_id, warehouse_id"),
    pool.query<DatabaseRows["movements"][number]>("SELECT sm.id, sm.movement_no, sm.variant_id, sm.warehouse_id, sm.type, sm.quantity, sm.input_quantity, sm.input_unit, sm.before_quantity, sm.after_quantity, u.username AS operator, sm.remark, sm.created_at FROM stock_movements sm JOIN users u ON u.id = sm.operator_id ORDER BY sm.created_at, sm.id"),
  ]);
  return mapDatabaseRowsToLocalSnapshot({ products: products.rows, variants: variants.rows, warehouses: warehouses.rows, inventory: inventory.rows, movements: movements.rows });
}

export async function main(outputPath = process.argv[2] ?? "backups/current-local.json"): Promise<void> {
  const snapshot = await exportLocalSnapshot();
  const resolvedPath = path.resolve(outputPath);
  await writeFile(resolvedPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`已导出本地备份：${resolvedPath}`);
  await pool.end();
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFile) await main();
