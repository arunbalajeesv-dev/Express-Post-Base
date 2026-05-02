/**
 * Seed script — delegates to seed.sql via psql.
 * Run: node scripts/seed.mjs
 */
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const dir = dirname(fileURLToPath(import.meta.url));
const sqlFile = join(dir, "seed.sql");

if (!process.env.DATABASE_URL) {
  console.error("ERROR: DATABASE_URL environment variable is not set.");
  process.exit(1);
}

console.log("Running seed.sql via psql…\n");
try {
  execSync(`psql "$DATABASE_URL" -f "${sqlFile}"`, {
    stdio: "inherit",
    env: process.env,
  });
} catch (e) {
  process.exit(1);
}
