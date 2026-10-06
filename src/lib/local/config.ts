export const localUser = { username: "本机用户", role: "ADMIN" as const };
export const defaultWarehouse = { id: "warehouse-main", name: "主仓库", code: "MAIN", isActive: true };
export const siteBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function withBasePath(path: string): string {
  return `${siteBasePath}${path}`;
}
