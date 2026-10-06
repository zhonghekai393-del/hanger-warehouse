import { promisify } from "node:util";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { pool } from "../src/lib/db";

const scrypt = promisify(scryptCallback);

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
}

async function upsertUser(username: string, password: string, role: "ADMIN" | "OPERATOR") {
  await pool.query(
    `INSERT INTO users (username, password_hash, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (username) DO UPDATE
     SET password_hash = EXCLUDED.password_hash,
         role = EXCLUDED.role,
         is_active = true,
         updated_at = now()`,
    [username, await hashPassword(password), role],
  );
}

async function seed() {
  const adminUsername = process.env.ADMIN_USERNAME;
  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminUsername || !adminPassword || adminPassword === "change-this-before-seeding") {
    throw new Error("ADMIN_USERNAME and a non-default ADMIN_PASSWORD are required");
  }

  const operatorUsername = process.env.OPERATOR_USERNAME;
  const operatorPassword = process.env.OPERATOR_PASSWORD;
  if ((operatorUsername && !operatorPassword) || (!operatorUsername && operatorPassword)) {
    throw new Error("OPERATOR_USERNAME and OPERATOR_PASSWORD must be provided together");
  }

  await upsertUser(adminUsername, adminPassword, "ADMIN");
  if (operatorUsername && operatorPassword) await upsertUser(operatorUsername, operatorPassword, "OPERATOR");

  await pool.query(
    "INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING",
    ["衣架"],
  );
  await pool.query(
    `INSERT INTO warehouses (name, code)
     VALUES ($1, $2)
     ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, is_active = true, updated_at = now()`,
    ["主仓库", "MAIN"],
  );

  console.log("Seed complete");
}

try {
  await seed();
} finally {
  await pool.end();
}
