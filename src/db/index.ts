import "server-only";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { DDL } from "./schema";

// 本地默认用项目根目录的 local.db；上线时把 DATABASE_URL 换成 Turso 地址即可
const client = createClient({
  url: process.env.DATABASE_URL ?? "file:local.db",
  authToken: process.env.DATABASE_AUTH_TOKEN,
});

const db = drizzle(client);
const ready = client.executeMultiple(DDL);

export async function getDb() {
  await ready;
  return db;
}
