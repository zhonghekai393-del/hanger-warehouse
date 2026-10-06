"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type User = { username: string; role: "ADMIN" | "OPERATOR" };

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { fetch("/api/auth/me").then((response) => response.json()).then((body) => setUser(body.data)).catch(() => undefined); }, []);
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); router.replace("/login"); }
  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">我的</p><h1>账户与系统</h1><p>当前版本专注库存数量和可追溯流水。</p></div></div><section className="content-panel"><div className="section-heading"><h2>当前账号</h2></div><div className="account-row"><span>账号</span><strong>{user?.username || "加载中"}</strong></div><div className="account-row"><span>角色</span><strong>{user?.role === "ADMIN" ? "管理员" : "仓库操作员"}</strong></div></section><section className="content-panel"><div className="section-heading"><h2>V1 范围</h2><p>扫码、Excel、盘点模式和多仓库将在后续版本评估。</p></div></section><button className="outline-button" onClick={logout}>退出登录</button></div>;
}
