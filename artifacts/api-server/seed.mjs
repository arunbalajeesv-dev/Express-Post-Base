import pg from "pg";
import bcrypt from "bcryptjs";

const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const hash = await bcrypt.hash("manager123", 10);

// Check existing
const check = await client.query(`SELECT user_id FROM users WHERE user_id = 'manager1'`);
if (check.rows.length > 0) {
  console.log("Manager user already exists");
} else {
  await client.query(
    `INSERT INTO users (name, mobile, role, user_id, password) VALUES ($1,$2,$3,$4,$5)`,
    ["Manager", "9999999999", "Manager", "manager1", hash]
  );
  console.log("Manager user created: manager1 / manager123");
}

await client.end();
process.exit(0);
