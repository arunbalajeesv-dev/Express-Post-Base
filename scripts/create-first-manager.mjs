/**
 * One-time script to create the first manager account.
 * Run: node --env-file=../artifacts/api-server/.env scripts/create-first-manager.mjs
 */
import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;

const userId   = "manager01";
const name     = "Manager";
const mobile   = "9999999999";
const role     = "manager";
const password = "Manager@123";

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL not set.");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });

try {
  await client.connect();

  const exists = await client.query(
    "SELECT id FROM users WHERE user_id = $1",
    [userId],
  );

  if (exists.rows.length > 0) {
    console.log(`User "${userId}" already exists — nothing to do.`);
    process.exit(0);
  }

  const hashed = await bcrypt.hash(password, 10);

  await client.query(
    "INSERT INTO users (user_id, name, mobile, role, password) VALUES ($1, $2, $3, $4, $5)",
    [userId, name, mobile, role, hashed],
  );

  console.log("✓ Manager account created successfully!");
  console.log(`  User ID : ${userId}`);
  console.log(`  Password: ${password}`);
  console.log(`  Role    : ${role}`);
} catch (err) {
  console.error("Failed:", err.message);
  process.exit(1);
} finally {
  await client.end();
}
