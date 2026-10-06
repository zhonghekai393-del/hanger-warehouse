"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function ProductDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  return (
    <div className="page-stack">
      <Link className="back-link" href="/products/">← 返回商品型号</Link>
      <div className="empty-state">
        <strong>{id ? "商品详情" : "缺少商品系列"}</strong>
        <span>本地数据页面将在初始化后显示详细型号。</span>
      </div>
    </div>
  );
}
