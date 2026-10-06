import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const localPages = [
  "components/stock-form.tsx",
  "app/(app)/movements/page.tsx",
  "app/(app)/stock/in/page.tsx",
  "app/(app)/stock/out/page.tsx",
  "app/(app)/stock/adjust/page.tsx",
];

describe("local stock page boundary", () => {
  it("does not use the removed API for stock operations", async () => {
    const sources = await Promise.all(localPages.map((path) => readFile(path, "utf8")));
    expect(sources[0]).toContain("getLocalRepository");
    expect(sources.join("\n")).not.toContain("/api/");
  });
});
