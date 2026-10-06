import { pool } from "@/src/lib/db";
import type { MovementType } from "@/src/lib/db-types";

export type MovementFilters = {
  from?: string;
  to?: string;
  type?: Extract<MovementType, "IN" | "OUT" | "ADJUSTMENT">;
  productId?: string;
  variantId?: string;
  operatorId?: string;
};

export async function getMovements(filters: MovementFilters = {}) {
  const conditions = ["1 = 1"];
  const values: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    values.push(value);
    conditions.push(sql.replace("?", `$${values.length}`));
  };
  if (filters.from) add("sm.created_at >= ?::date", filters.from);
  if (filters.to) add("sm.created_at < (?::date + interval '1 day')", filters.to);
  if (filters.type) add("sm.type = ?", filters.type);
  if (filters.productId) add("pv.product_id = ?", filters.productId);
  if (filters.variantId) add("sm.variant_id = ?", filters.variantId);
  if (filters.operatorId) add("sm.operator_id = ?", filters.operatorId);

  const result = await pool.query(
    `SELECT sm.id, sm.movement_no AS "movementNo", sm.type, sm.quantity,
            sm.input_quantity AS "inputQuantity", sm.input_unit AS "inputUnit",
            sm.before_quantity AS "beforeQuantity", sm.after_quantity AS "afterQuantity",
            sm.remark, sm.created_at AS "createdAt", u.username AS operator,
            p.name AS product_name, pv.model, pv.sku
     FROM stock_movements sm
     JOIN product_variants pv ON pv.id = sm.variant_id
     JOIN products p ON p.id = pv.product_id
     JOIN users u ON u.id = sm.operator_id
     WHERE ${conditions.join(" AND ")}
     ORDER BY sm.created_at DESC
     LIMIT 500`,
    values,
  );
  return result.rows;
}
