"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";

type User = { username: string; role: "ADMIN" | "OPERATOR" };

const navItems = [
  ["/dashboard", "首页"],
  ["/inventory", "库存查询"],
  ["/movements", "出入库记录"],
  ["/products", "商品型号"],
] as const;

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then(async (response) => {
        if (!response.ok) throw new Error("unauthorized");
        const body = await response.json();
        setUser(body.data);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setLoading(false));
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  if (loading || !user) return <div className="app-loading">正在打开仓库...</div>;

  return (
    <div className="app-frame">
      <aside className="side-nav">
        <div className="brand-block">
          <span className="brand-mark">衣</span>
          <div><strong>衣架仓库</strong><span>库存操作台</span></div>
        </div>
        <nav aria-label="侧边导航">
          {navItems.map(([href, label]) => <Link className={pathname.startsWith(href) ? "side-link active" : "side-link"} href={href} key={href}>{label}</Link>)}
        </nav>
        <button className="text-button side-logout" onClick={logout}>退出登录</button>
      </aside>
      <div className="app-content">
        <header className="top-bar">
          <div><span className="mobile-brand">衣架仓库</span><span className="desktop-only">仓库管理 / {navItems.find(([href]) => pathname.startsWith(href))?.[1] || "操作台"}</span></div>
          <div className="user-chip"><span>{user.username}</span><span className="role-label">{user.role === "ADMIN" ? "管理员" : "操作员"}</span></div>
        </header>
        <main className="main-content">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
