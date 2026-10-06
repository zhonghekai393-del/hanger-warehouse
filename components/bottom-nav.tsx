"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  ["/dashboard", "首页"],
  ["/inventory", "库存"],
  ["/stock/in", "出入库"],
  ["/products", "商品"],
  ["/settings", "我的"],
] as const;

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {items.map(([href, label]) => (
        <Link className={pathname.startsWith(href) ? "nav-link active" : "nav-link"} href={href} key={href}>
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
