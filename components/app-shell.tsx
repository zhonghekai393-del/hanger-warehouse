"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/bottom-nav";
import { localUser } from "@/src/lib/local/config";
import { getLocalRepository } from "@/src/lib/local/repository";

const navItems = [
  ["/dashboard", "首页"],
  ["/inventory", "库存查询"],
  ["/movements", "出入库记录"],
  ["/products", "商品型号"],
] as const;

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getLocalRepository().initialize()
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "本地仓库打开失败"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="app-loading">正在打开仓库...</div>;
  if (error) return <div className="app-loading"><p className="form-error" role="alert">{error}</p><p>请更换支持本地存储的浏览器后重试。</p></div>;

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
        <Link className="text-button side-logout" href="/settings/">本机设置</Link>
      </aside>
      <div className="app-content">
        <header className="top-bar">
          <div><span className="mobile-brand">衣架仓库</span><span className="desktop-only">仓库管理 / {navItems.find(([href]) => pathname.startsWith(href))?.[1] || "操作台"}</span></div>
          <div className="user-chip"><span>{localUser.username}</span><span className="role-label">管理员</span></div>
        </header>
        <main className="main-content">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
