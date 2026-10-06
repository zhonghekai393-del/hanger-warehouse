"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function HomePage() {
  const router = useRouter();
  useEffect(() => router.replace("/dashboard/"), [router]);
  return <div className="app-loading">正在打开仓库...</div>;
}
