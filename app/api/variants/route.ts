import { NextResponse } from "next/server";
import { pool, withTransaction } from "@/src/lib/db";
import { requireAdmin, requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError, readJson } from "@/src/lib/api/http";
import { productVariantInputSchema } from "@/src/lib/api/validation";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const params = new URL(request.url).searchParams;
    const q = params.get("q")?.trim() || "";
    const productId = params.get("productId") || "";
    const result = await pool.query(
      `SELECT pv.id, pv.product_id AS "productId", p.name AS product_name, pv.model, pv.sku,
              pv.barcode, pv.color, pv.size, pv.material, pv.unit, pv.pack_size AS "packSize",
              pv.minimum_stock AS "minimumStock", pv.remark,
              COALESCE(SUM(i.quantity), 0)::int AS quantity
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN inventory i ON i.variant_id = pv.id
       WHERE pv.is_active = true
         AND ($1 = '' OR pv.product_id::text = $1)
         AND ($2 = '' OR p.name ILIKE '%' || $2 || '%' OR pv.model ILIKE '%' || $2 || '%'
              OR pv.sku ILIKE '%' || $2 || '%' OR COALESCE(pv.barcode, '') ILIKE '%' || $2 || '%')
       GROUP BY pv.id, p.name
       ORDER BY p.name, pv.model, pv.sku`,
      [productId, q],
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const parsed = productVariantInputSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("型号信息不完整");
    const result = await withTransaction(async (client) => {
      const variant = await client.query(
        `INSERT INTO product_variants
          (product_id, model, sku, barcode, color, size, material, unit, pack_size, minimum_stock, remark)
         VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), $8, $9, $10, NULLIF($11, ''))
         RETURNING id, product_id AS "productId", model, sku, barcode, color, size, material,
                   unit, pack_size AS "packSize", minimum_stock AS "minimumStock", remark`,
        [parsed.data.productId, parsed.data.model, parsed.data.sku, parsed.data.barcode || "", parsed.data.color || "", parsed.data.size || "", parsed.data.material || "", parsed.data.unit, parsed.data.packSize, parsed.data.minimumStock, parsed.data.remark || ""],
      );
      await client.query(
        `INSERT INTO inventory (variant_id, warehouse_id)
         SELECT $1, id FROM warehouses WHERE is_active = true
         ON CONFLICT (variant_id, warehouse_id) DO NOTHING`,
        [variant.rows[0].id],
      );
      return variant.rows[0];
    });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") return jsonError("SKU 或条形码已存在", 409, "DUPLICATE_CODE");
    return errorResponse(error);
  }
}
