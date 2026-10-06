"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { DashboardMetrics } from "@/src/lib/local/types";

export default function DashboardPage() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    getLocalRepository().getDashboardMetrics().then(setMetrics).catch((loadError) => setError(loadError instanceof Error ? loadError.message : "暂时无法加载看板"));
  }, []);
  const values = metrics || { skuCount: 0, totalQuantity: 0, todayIn: 0, todayOut: 0, lowCount: 0, outCount: 0 };
  return <div className="page-stack">
    <div className="page-heading"><div><p className="eyebrow">仓库总览</p><h1>今天，仓库怎么样？</h1><p>先看库存状态，再开始处理出入库。</p></div><Link className="outline-button desktop-only" href="/movements">查看全部流水</Link></div>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="metric-grid" aria-label="库存指标">
      <div className="metric-block primary-metric"><span>当前库存总量</span><strong>{values.totalQuantity.toLocaleString()}</strong><small>个</small></div>
      <div className="metric-block"><span>货号数量</span><strong>{values.skuCount}</strong></div>
      <div className="metric-block"><span>今日入库</span><strong className="positive-text">+{values.todayIn.toLocaleString()}</strong></div>
      <div className="metric-block"><span>今日出库</span><strong className="negative-text">-{values.todayOut.toLocaleString()}</strong></div>
      <div className="metric-block warning-metric"><span>库存不足</span><strong>{values.lowCount}</strong></div>
      <div className="metric-block danger-metric"><span>缺货型号</span><strong>{values.outCount}</strong></div>
    </section>
    <section className="quick-actions"><div className="section-heading"><p className="eyebrow">快速操作</p><h2>需要处理什么？</h2></div><div className="action-grid"><Link className="action-button action-in" href="/stock/in"><span>＋</span><strong>入库</strong><small>收货、补货、初始化</small></Link><Link className="action-button action-out" href="/stock/out"><span>−</span><strong>出库</strong><small>门店发货、领用</small></Link></div></section>
    <section className="dashboard-links"><Link href="/inventory">查询全部库存 <span>→</span></Link><Link href="/products">管理商品型号 <span>→</span></Link><Link href="/movements">查看出入库记录 <span>→</span></Link></section>
  </div>;
}
