import { env } from "cloudflare:workers";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "../db/schema";

export function getDb() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return drizzle(env.DB, { schema });
}

export function getRawDb() {
  if (!env.DB) throw new Error("D1 binding DB is unavailable");
  return env.DB;
}

export function getMediaBucket() {
  if (!env.MEDIA) throw new Error("R2 binding MEDIA is unavailable");
  return env.MEDIA;
}

export function getOwnerUserId() {
  return typeof env.OWNER_USER_ID === "string" ? env.OWNER_USER_ID : "";
}
