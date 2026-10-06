"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function VariantDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");

  return (
    <div className="page-stack">
      <Link className="back-link" href="/inventory/">← 返回库存</Link>
      <div className="empty-state">
        <strong>{id ? "型号详情" : "缺少商品型号"}</strong>
        <span>本地数据页面将在初始化后显示库存和流水。</span>
      </div>
    </div>
  );
}
