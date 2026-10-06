import { NextResponse } from "next/server";
import { requireUser } from "@/src/lib/auth/guard";
import { errorResponse } from "@/src/lib/api/http";
import { getDashboard } from "@/src/lib/queries/dashboard";

export async function GET(request: Request) {
  try {
    await requireUser(request);
    return NextResponse.json({ data: await getDashboard() });
  } catch (error) {
    return errorResponse(error);
  }
}
