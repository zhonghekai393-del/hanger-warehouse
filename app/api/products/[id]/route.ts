import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { requireAdmin, requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError, readJson } from "@/src/lib/api/http";
import { productInputSchema } from "@/src/lib/api/validation";

type Context = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Context) {
  try {
    await requireUser(request);
    const { id } = await context.params;
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.category_id AS "categoryId", p.is_active AS "isActive",
              c.name AS category_name
       FROM products p LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id],
    );
    if (!result.rowCount) return jsonError("商品不存在", 404, "NOT_FOUND");
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const parsed = productInputSchema.partial().safeParse(await readJson(request));
    if (!parsed.success || !Object.keys(parsed.data).length) return jsonError("没有可更新的商品字段");
    const fields: string[] = [];
    const values: unknown[] = [];
    if (parsed.data.name !== undefined) { fields.push(`name = $${values.length + 1}`); values.push(parsed.data.name); }
    if (parsed.data.categoryId !== undefined) { fields.push(`category_id = $${values.length + 1}`); values.push(parsed.data.categoryId); }
    if (parsed.data.description !== undefined) { fields.push(`description = $${values.length + 1}`); values.push(parsed.data.description); }
    values.push(id);
    const result = await pool.query(
      `UPDATE products SET ${fields.join(", ")}, updated_at = now() WHERE id = $${values.length}
       RETURNING id, name, category_id AS "categoryId", description, is_active AS "isActive"`,
      values,
    );
    if (!result.rowCount) return jsonError("商品不存在", 404, "NOT_FOUND");
    return NextResponse.json({ data: result.rows[0] });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    await requireAdmin(request);
    const { id } = await context.params;
    const result = await pool.query("UPDATE products SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id", [id]);
    if (!result.rowCount) return jsonError("商品不存在", 404, "NOT_FOUND");
    return NextResponse.json({ data: { id, isActive: false } });
  } catch (error) {
    return errorResponse(error);
  }
}
