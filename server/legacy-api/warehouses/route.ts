import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse } from "@/src/lib/api/http";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const result = await pool.query("SELECT id, name, code FROM warehouses WHERE is_active = true ORDER BY name");
    return NextResponse.json({ data: result.rows });
  } catch (error) {
    return errorResponse(error);
  }
}
