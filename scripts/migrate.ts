/**
 * Applies the SQL files in supabase/migrations/ to the database, in filename
 * order, using POSTGRES_URL_NON_POOLING from .env.local.
 *
 * This exists so schema changes don't depend on having Supabase dashboard
 * access or a local psql install — the connection string in .env.local is
 * enough.
 *
 * Migrations here are written to be idempotent ("add column if not exists",
 * "create index if not exists"), so re-running this is safe and there's no
 * applied-migrations bookkeeping table. If that ever stops being true, this
 * script needs to start tracking what it has run.
 *
 * Usage:
 *   npm run migrate
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import "./load-env";

import { Client } from "pg";

const MIGRATIONS_DIR = path.join(process.cwd(), "supabase", "migrations");

/**
 * Forces `sslmode=no-verify` on the connection string.
 *
 * Supabase requires TLS but presents a certificate from its own CA, which
 * isn't in Node's default trust store — hence "self-signed certificate in
 * certificate chain". The obvious fix, passing
 * `ssl: { rejectUnauthorized: false }` next to `connectionString`, silently
 * does nothing: pg's ConnectionParameters does
 * `Object.assign({}, config, parse(config.connectionString))`, so whatever
 * sslmode is in the URL overwrites the explicit option. Setting it in the
 * string itself is the path pg actually honours (it maps `no-verify` to
 * `{ rejectUnauthorized: false }`).
 *
 * The traffic is still encrypted; we're skipping certificate-chain
 * verification, which is standard for Supabase's direct connection and is why
 * their own docs hand out `sslmode=require` URLs.
 */
function encryptWithoutVerifying(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    url.searchParams.set("sslmode", "no-verify");
    return url.toString();
  } catch {
    // Not URL-shaped (pg also accepts key=value strings) — append instead.
    const separator = connectionString.includes("?") ? "&" : "?";
    return `${connectionString}${separator}sslmode=no-verify`;
  }
}

async function main(): Promise<void> {
  const connectionString = process.env.POSTGRES_URL_NON_POOLING;
  if (!connectionString) {
    throw new Error(
      "POSTGRES_URL_NON_POOLING is not set in .env.local — it's the direct " +
        "Postgres connection string from Supabase (Project Settings > Database)."
    );
  }

  const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  if (files.length === 0) {
    console.log("No migration files found.");
    return;
  }

  console.log(`Applying ${files.length} migration file(s):\n`);

  const client = new Client({ connectionString: encryptWithoutVerifying(connectionString) });
  await client.connect();

  try {
    for (const file of files) {
      process.stdout.write(`  ${file} ... `);
      const sql = await readFile(path.join(MIGRATIONS_DIR, file), "utf-8");
      await client.query(sql);
      console.log("ok");
    }
  } finally {
    await client.end();
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error("\nMigration failed:");
  console.error(err);
  process.exit(1);
});
