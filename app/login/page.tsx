"use client";

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-block login-brand"><span className="brand-mark">衣</span><div><strong>衣架仓库</strong><span>库存与出入库管理</span></div></div>
        <div className="section-heading"><p className="eyebrow">单人本地模式</p><h1>打开仓库操作台</h1><p>数据保存在当前设备的浏览器中，不需要账号或云服务器。</p></div>
        <Link className="primary-button full-width" href="/dashboard/">进入仓库</Link>
      </section>
    </main>
  );
}
