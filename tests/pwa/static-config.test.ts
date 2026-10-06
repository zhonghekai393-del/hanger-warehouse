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
});
