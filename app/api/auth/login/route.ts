import { NextResponse } from "next/server";
import { pool } from "@/src/lib/db";
import { createSession, sessionCookie } from "@/src/lib/auth/session";
import { verifyPassword } from "@/src/lib/auth/password";
import { loginSchema } from "@/src/lib/api/validation";
import { errorResponse, jsonError, readJson } from "@/src/lib/api/http";

export async function POST(request: Request) {
  try {
    const parsed = loginSchema.safeParse(await readJson(request));
    if (!parsed.success) return jsonError("请输入账号和密码");
    const result = await pool.query<{ id: string; username: string; role: "ADMIN" | "OPERATOR"; password_hash: string }>(
      "SELECT id, username, role, password_hash FROM users WHERE username = $1 AND is_active = true",
      [parsed.data.username],
    );
    const user = result.rows[0];
    if (!user || !(await verifyPassword(parsed.data.password, user.password_hash))) return jsonError("账号或密码错误", 401, "INVALID_CREDENTIALS");
    const token = await createSession(user.id);
    const response = NextResponse.json({ data: { id: user.id, username: user.username, role: user.role } });
    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch (error) {
    return errorResponse(error);
  }
}
