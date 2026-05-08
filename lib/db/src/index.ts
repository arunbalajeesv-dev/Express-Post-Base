import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import { setDefaultResultOrder } from "dns";
import * as schema from "./schema";

// Render free tier has no IPv6 outbound — force IPv4 DNS resolution
setDefaultResultOrder("ipv4first");

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});
export const db = drizzle(pool, { schema });

export * from "./schema";
