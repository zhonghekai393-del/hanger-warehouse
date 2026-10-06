import { NextResponse } from "next/server";
import { clearSessionCookie, deleteSession } from "@/src/lib/auth/session";
import { errorResponse } from "@/src/lib/api/http";

export async function POST(request: Request) {
  try {
    await deleteSession(request);
    const response = NextResponse.json({ data: { ok: true } });
    response.headers.set("Set-Cookie", clearSessionCookie());
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
