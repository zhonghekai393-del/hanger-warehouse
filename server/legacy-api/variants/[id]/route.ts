import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { requireAdmin, requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError, readJson } from "@/src/lib/api/http";
import { productVariantInputSchema } from "@/src/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const result = await pool.query(
      `SELECT pv.id, pv.product_id AS "productId", p.name AS product_name, pv.model, pv.sku,
              pv.barcode, pv.color, pv.size, pv.material, pv.unit,
              pv.pack_size AS "packSize", pv.minimum_stock AS "minimumStock", pv.remark,
              COALESCE(json_agg(json_build_object(
                'warehouseId', i.warehouse_id, 'warehouseName', w.name, 'quantity', i.quantity
              ) ORDER BY w.name) FILTER (WHERE i.id IS NOT NULL), '[]') AS inventory
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN inventory i ON i.variant_id = pv.id
       LEFT JOIN warehouses w ON w.id = i.warehouse_id
       WHERE pv.id = $1
       GROUP BY pv.id, p.name`,
      [id],
    );
    if (!result.rowCount) return jsonError("型号不存在", 404, "NOT_FOUND");
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const parsed = productVariantInputSchema.partial().safeParse(await readJson(request));
    if (!parsed.success || !Object.keys(parsed.data).length) return jsonError("没有可更新的型号字段");
    const fields: string[] = [];
    const values: unknown[] = [];
    const mappings: Array<[keyof typeof parsed.data, string]> = [
      ["productId", "product_id"], ["model", "model"], ["sku", "sku"], ["barcode", "barcode"],
      ["color", "color"], ["size", "size"], ["material", "material"], ["unit", "unit"],
      ["packSize", "pack_size"], ["minimumStock", "minimum_stock"], ["remark", "remark"],
    ];
    for (const [key, column] of mappings) {
      if (parsed.data[key] === undefined) continue;
      fields.push(`${column} = $${values.length + 1}`);
      values.push(parsed.data[key] === "" ? null : parsed.data[key]);
    }
    values.push(id);
    const result = await pool.query(
      `UPDATE product_variants SET ${fields.join(", ")}, updated_at = now()
       WHERE id = $${values.length}
       RETURNING id, product_id AS "productId", model, sku, barcode, color, size, material,
                 unit, pack_size AS "packSize", minimum_stock AS "minimumStock", remark`,
      values,
    );
    if (!result.rowCount) return jsonError("型号不存在", 404, "NOT_FOUND");
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    if (error instanceof Error && "code" in error && (error as { code?: string }).code === "23505") return jsonError("SKU 或条形码已存在", 409, "DUPLICATE_CODE");
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const result = await pool.query("UPDATE product_variants SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id", [id]);
    if (!result.rowCount) return jsonError("型号不存在", 404, "NOT_FOUND");
    return NextResponse.json({ data: { id, isActive: false } });
  } catch (error) {
    return errorResponse(error);
  }
}
