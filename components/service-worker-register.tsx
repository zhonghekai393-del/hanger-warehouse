"use client";

import { useEffect } from "react";
import { siteBasePath } from "@/src/lib/local/config";

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register(`${siteBasePath}/sw.js`);
  }, []);
  return null;
}
