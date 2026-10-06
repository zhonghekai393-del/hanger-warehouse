"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username, password }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "登录失败");
      router.replace("/dashboard");
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "登录失败");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-panel">
        <div className="brand-block login-brand"><span className="brand-mark">衣</span><div><strong>衣架仓库</strong><span>库存与出入库管理</span></div></div>
        <div className="section-heading"><p className="eyebrow">欢迎回来</p><h1>登录操作台</h1><p>用账号进入仓库工作区。</p></div>
        <form className="stack-form" onSubmit={submit}>
          <label>账号<input autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="请输入账号" required /></label>
          <label>密码<input autoComplete="current-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="请输入密码" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button full-width" disabled={submitting} type="submit">{submitting ? "登录中..." : "登录"}</button>
        </form>
      </section>
    </main>
  );
}
