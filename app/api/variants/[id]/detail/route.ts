import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError } from "@/src/lib/api/http";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const result = await pool.query(
      `SELECT pv.id, pv.model, pv.sku, pv.barcode, pv.color, pv.size, pv.material,
              pv.unit, pv.pack_size AS "packSize", pv.minimum_stock AS "minimumStock",
              p.id AS "productId", p.name AS product_name,
              COALESCE(SUM(i.quantity), 0)::int AS quantity,
              max(i.warehouse_id::text) AS "warehouseId"
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN inventory i ON i.variant_id = pv.id
       WHERE pv.id = $1 AND pv.is_active = true
       GROUP BY pv.id, p.id, p.name`,
      [id],
    );
    if (!result.rowCount) return jsonError("型号不存在", 404, "NOT_FOUND");
    const movements = await pool.query(
      `SELECT sm.id, sm.movement_no AS "movementNo", sm.type, sm.quantity,
              sm.before_quantity AS "beforeQuantity", sm.after_quantity AS "afterQuantity",
              sm.input_quantity AS "inputQuantity", sm.input_unit AS "inputUnit",
              sm.remark, sm.created_at AS "createdAt", u.username AS operator
       FROM stock_movements sm JOIN users u ON u.id = sm.operator_id
       WHERE sm.variant_id = $1 ORDER BY sm.created_at DESC LIMIT 20`,
      [id],
    );
    return NextResponse.json({ data: { ...result.rows[0], movements: movements.rows } });
  } catch (error) {
    return errorResponse(error);
  }
}
