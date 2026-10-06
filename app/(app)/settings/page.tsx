"use client";

import { useEffect, useState } from "react";
import { getImportSummary, validateLocalSnapshot } from "@/src/lib/local/backup";
import { getLocalRepository } from "@/src/lib/local/repository";
import type { ImportSummary } from "@/src/lib/local/types";

export default function SettingsPage() {
  const [summary, setSummary] = useState<ImportSummary>({ products: 0, variants: 0, inventory: 0, movements: 0 });
  const [lastBackup, setLastBackup] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function loadSummary() {
    const repository = getLocalRepository();
    const [products, variants, inventory, movements] = await Promise.all([repository.listProducts(), repository.listVariants(), repository.listInventory(), repository.listMovements()]);
    setSummary({ products: products.length, variants: variants.length, inventory: inventory.length, movements: movements.length });
  }

  useEffect(() => {
    let active = true;
    const repository = getLocalRepository();
    Promise.all([repository.listProducts(), repository.listVariants(), repository.listInventory(), repository.listMovements()])
      .then(([products, variants, inventory, movements]) => { if (active) setSummary({ products: products.length, variants: variants.length, inventory: inventory.length, movements: movements.length }); })
      .catch((loadError) => { if (active) setError(loadError instanceof Error ? loadError.message : "本地数据读取失败"); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function exportBackup() {
    setError(""); setMessage("");
    try {
      const snapshot = await getLocalRepository().exportSnapshot();
      const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `衣架仓库备份-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setLastBackup(new Date().toLocaleString("zh-CN"));
      setMessage("备份已下载，请妥善保存文件。");
    } catch (backupError) { setError(backupError instanceof Error ? backupError.message : "备份导出失败"); }
  }

  async function importBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setError(""); setMessage("");
    try {
      const snapshot = validateLocalSnapshot(JSON.parse(await file.text()));
      const nextSummary = getImportSummary(snapshot);
      const confirmed = window.confirm(`将导入 ${nextSummary.products} 个系列、${nextSummary.variants} 个型号、${nextSummary.inventory} 条库存和 ${nextSummary.movements} 条流水。导入会替换本机现有数据，是否继续？`);
      if (!confirmed) return;
      await getLocalRepository().importSnapshot(snapshot);
      await loadSummary();
      setMessage("备份导入成功。");
    } catch (importError) { setError(importError instanceof Error ? importError.message : "备份导入失败"); }
  }

  return <div className="page-stack narrow-page"><div className="page-heading"><div><p className="eyebrow">本机设置</p><h1>账户与系统</h1><p>单人本地模式：数据保存在当前设备浏览器中，不需要云服务器。</p></div></div>{error && <p className="form-error" role="alert">{error}</p>}{message && <p className="form-success" role="status">{message}</p>}<section className="content-panel"><div className="section-heading"><h2>本机数据</h2><p>请定期导出备份，清除浏览器数据或更换手机前一定要先备份。</p></div>{loading ? <div className="loading-state">正在读取数据统计...</div> : <div className="account-row"><span>当前数据</span><strong>{summary.products} 个系列 · {summary.variants} 个型号 · {summary.inventory} 条库存 · {summary.movements} 条流水</strong></div>}<div className="account-row"><span>最近备份</span><strong>{lastBackup || "本次打开后尚未导出"}</strong></div><div className="form-actions"><button className="primary-button" type="button" onClick={() => void exportBackup()}>导出备份</button><label className="outline-button">导入备份<input type="file" accept="application/json,.json" onChange={(event) => void importBackup(event)} hidden /></label></div></section><section className="content-panel"><div className="section-heading"><h2>使用说明</h2><p>同一个网址在另一台手机上会创建独立数据，不会自动同步。GitHub 仓库只保存程序，不保存你的库存数据。</p></div></section></div>;
}
