import { appName } from "@/src/lib/config";

export default function HomePage() {
  return (
    <main className="page-shell">
      <section className="intro-panel">
        <p className="eyebrow">仓库操作台</p>
        <h1>{appName}</h1>
        <p>请登录后开始管理衣架型号、库存和出入库流水。</p>
      </section>
    </main>
  );
}
