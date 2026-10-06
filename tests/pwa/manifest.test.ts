import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("PWA manifest", () => {
  it("contains installable warehouse app metadata", async () => {
    const manifest = JSON.parse(await readFile("app/manifest.webmanifest", "utf8"));
    expect(manifest.name).toBe("衣架仓库管理");
    expect(manifest.start_url).toBe("/dashboard");
    expect(manifest.display).toBe("standalone");
    expect(manifest.icons).toEqual(expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]));
  });
});
