import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse } from "@/src/lib/api/http";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim() || "";
    const warehouseId = params.get("warehouseId") || "";
    const result = await pool.query(
      `SELECT pv.id, pv.product_id AS "productId", p.name AS product_name,
              pv.model, pv.sku, pv.barcode, pv.color, pv.size, pv.unit,
              pv.pack_size AS "packSize", pv.minimum_stock AS "minimumStock",
              i.quantity, i.warehouse_id AS "warehouseId", w.name AS warehouse_name
       FROM inventory i
       JOIN product_variants pv ON pv.id = i.variant_id AND pv.is_active = true
       JOIN products p ON p.id = pv.product_id AND p.is_active = true
       JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active = true
       WHERE ($1 = '' OR i.warehouse_id::text = $1)
         AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR pv.model ILIKE '%' || $2 || '%'
              OR pv.sku ILIKE '%' || $2 || '%' OR COALESCE(pv.barcode, '') ILIKE '%' || $2 || '%')
       ORDER BY p.name, pv.model, pv.sku`,
      [warehouseId, q],
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}
