import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "@/src/lib/auth/password";

describe("password hashing", () => {
  it("verifies only the password used to create a scrypt hash", async () => {
    const encoded = await hashPassword("仓库密码-123");
    expect(encoded).toMatch(/^scrypt\$/);
    await expect(verifyPassword("仓库密码-123", encoded)).resolves.toBe(true);
    await expect(verifyPassword("wrong-password", encoded)).resolves.toBe(false);
  });
});
