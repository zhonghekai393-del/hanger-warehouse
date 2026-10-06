import { pool } from "@/src/lib/db";

export type DashboardMetrics = {
  skuCount: number;
  totalQuantity: number;
  todayIn: number;
  todayOut: number;
  lowCount: number;
  outCount: number;
};

export async function getDashboard(): Promise<DashboardMetrics> {
  const result = await pool.query<DashboardMetrics>(
    `SELECT
       (SELECT count(*)::int FROM product_variants WHERE is_active = true) AS "skuCount",
       (SELECT COALESCE(sum(i.quantity), 0)::int
        FROM inventory i
        JOIN product_variants pv ON pv.id = i.variant_id AND pv.is_active = true
        JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active = true) AS "totalQuantity",
       (SELECT COALESCE(sum(sm.quantity), 0)::int
        FROM stock_movements sm
        JOIN product_variants pv ON pv.id = sm.variant_id AND pv.is_active = true
        JOIN warehouses w ON w.id = sm.warehouse_id AND w.is_active = true
        WHERE sm.type = 'IN'
          AND sm.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai') AS "todayIn",
       (SELECT COALESCE(-sum(sm.quantity), 0)::int
        FROM stock_movements sm
        JOIN product_variants pv ON pv.id = sm.variant_id AND pv.is_active = true
        JOIN warehouses w ON w.id = sm.warehouse_id AND w.is_active = true
        WHERE sm.type = 'OUT'
          AND sm.created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai') AT TIME ZONE 'Asia/Shanghai') AS "todayOut",
       (SELECT count(*)::int
        FROM inventory i
        JOIN product_variants pv ON pv.id = i.variant_id AND pv.is_active = true
        JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active = true
        WHERE i.quantity > 0 AND i.quantity <= pv.minimum_stock) AS "lowCount",
       (SELECT count(*)::int
        FROM inventory i
        JOIN product_variants pv ON pv.id = i.variant_id AND pv.is_active = true
        JOIN warehouses w ON w.id = i.warehouse_id AND w.is_active = true
        WHERE i.quantity = 0) AS "outCount"`,
  );
  return result.rows[0];
}
