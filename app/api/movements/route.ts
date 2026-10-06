import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse } from "@/src/lib/api/http";
import { getMovements } from "@/src/lib/queries/movements";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    const allowedType = type === "IN" || type === "OUT" || type === "ADJUSTMENT" ? type : undefined;
    return NextResponse.json({
      data: await getMovements({
        from: params.get("from") || undefined,
        to: params.get("to") || undefined,
        type: allowedType,
        productId: params.get("productId") || undefined,
        variantId: params.get("variantId") || undefined,
        operatorId: params.get("operatorId") || undefined,
      }),
    });
  } catch (error) {
    return errorResponse(error);
  }
}
