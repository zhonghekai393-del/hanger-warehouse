import { getSessionUser, type SessionUser } from "@/src/lib/auth/session";

export class AuthError extends Error {
  constructor(public readonly status: 401 | 403, message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getSessionUser(request);
  if (!user) throw new AuthError(401, "请先登录");
  return user;
}

export async function requireAdmin(request: Request): Promise<SessionUser> {
  const user = await requireUser(request);
  if (user.role !== "ADMIN") throw new AuthError(403, "没有管理员权限");
  return user;
}
