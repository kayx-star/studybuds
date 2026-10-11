import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { DDL, MIGRATIONS } from "./schema";

// Defaults to local.db in the project root; point DATABASE_URL at Turso in production
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client);

async function setup() {
  // When several processes write the same SQLite file, wait up to 5 s on a lock instead of failing immediately
  if (!process.env.DATABASE_URL?.startsWith("libsql")) await client.execute("PRAGMA busy_timeout = 5000");
  await client.executeMultiple(DDL);
  for (const sql of MIGRATIONS) await client.execute(sql).catch(() => {});
}
const ready = setup();

export async function getDb() {
  await ready;
  return db;
}
