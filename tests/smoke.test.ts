import { describe, expect, it } from "vitest";
import { appName } from "@/src/lib/config";

describe("application bootstrap", () => {
  it("exposes the warehouse application name", () => {
    expect(appName).toBe("衣架仓库管理");
  });
});
