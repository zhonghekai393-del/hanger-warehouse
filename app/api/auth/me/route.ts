import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse } from "@/src/lib/api/http";

export async function GET(request: Request) {
  try {
    return NextResponse.json({ data: await requireUser(request) });
  } catch (error) {
    return errorResponse(error);
  }
}
