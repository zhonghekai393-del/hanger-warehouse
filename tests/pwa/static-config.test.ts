import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("static export boundary", () => {
  it("enables static export and trailing-slash pages", async () => {
    const config = await readFile("next.config.ts", "utf8");
    expect(config).toContain('output: "export"');
    expect(config).toContain("trailingSlash: true");
  });

  it("uses static query pages instead of runtime product ID routes", async () => {
    await expect(readFile("app/(app)/products/[id]/page.tsx", "utf8")).rejects.toThrow();
    await expect(readFile("app/(app)/products/variant/[id]/page.tsx", "utf8")).rejects.toThrow();
    await expect(readFile("app/(app)/products/detail/page.tsx", "utf8")).resolves.toContain("useSearchParams");
    await expect(readFile("app/(app)/products/variant/page.tsx", "utf8")).resolves.toContain("useSearchParams");
  });

  it("has an offline cache shell", async () => {
    const serviceWorker = await readFile("public/sw.js", "utf8");
    expect(serviceWorker).toContain("caches.open");
    expect(serviceWorker).toContain("clients.claim");
    expect(serviceWorker).toContain("dashboard");
  });

  it("keeps server API routes outside the static app", async () => {
    const { readdir } = await import("node:fs/promises");
    await expect(readdir("app/api", { recursive: true })).rejects.toThrow();
    const sources = await Promise.all(["components/app-shell.tsx", "components/stock-form.tsx", "app/(app)/movements/page.tsx"].map((path) => readFile(path, "utf8")));
    expect(sources.join("\n")).not.toContain("/api/");
  });
});
