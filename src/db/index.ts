import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { DDL, MIGRATIONS } from "./schema";

// 本地默认用项目根目录的 local.db；上线时把 DATABASE_URL 换成 Turso 地址即可
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client);

async function setup() {
  // 多个进程同时写同一个 SQLite 文件时，遇到锁先等待最多 5 秒，而不是立刻报错
  if (!process.env.DATABASE_URL?.startsWith("libsql")) await client.execute("PRAGMA busy_timeout = 5000");
  await client.executeMultiple(DDL);
  for (const sql of MIGRATIONS) await client.execute(sql).catch(() => {});
}
const ready = setup();

export async function getDb() {
  await ready;
  return db;
}
