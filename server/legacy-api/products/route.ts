import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { requireAdmin, requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError, readJson } from "@/src/lib/api/http";
import { productInputSchema } from "@/src/lib/api/validation";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const q = new URL(request.url).searchParams.get("q")?.trim() || "";
    const result = await pool.query(
      `SELECT p.id, p.name, p.description, p.is_active, p.created_at,
              c.name AS category_name,
              count(pv.id)::int AS variant_count
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN product_variants pv ON pv.product_id = p.id AND pv.is_active = true
       WHERE p.is_active = true AND ($1 = '' OR p.name ILIKE '%' || $1 || '%')
       GROUP BY p.id, c.name
       ORDER BY p.name`,
      [q],
    );
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin(request);
    const parsed = productInputSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("商品信息不完整");
    const result = await pool.query(
      `INSERT INTO products (name, category_id, description)
       VALUES ($1, $2, $3)
       RETURNING id, name, category_id AS "categoryId", description, is_active AS "isActive"`,
      [parsed.data.name, parsed.data.categoryId || null, parsed.data.description || null],
    );
    return NextResponse.json({ data: result.rows[0] }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
