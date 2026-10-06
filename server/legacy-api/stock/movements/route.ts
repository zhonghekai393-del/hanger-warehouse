import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse, jsonError, readJson } from "@/src/lib/api/http";
import { movementRequestSchema } from "@/src/lib/api/validation";
import { applyStockMovement } from "@/src/lib/inventory/service";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request);
    const parsed = movementRequestSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("库存操作数据不完整");
    const result = await applyStockMovement({ ...parsed.data, operatorId: user.id });
    return NextResponse.json({ data: result }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}
