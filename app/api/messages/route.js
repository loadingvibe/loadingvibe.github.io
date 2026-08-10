import { desc, eq } from "drizzle-orm";
import { messages } from "../../../db/schema";
import { requireOwnerRequest } from "../../../lib/auth";
import { getDb, getRawDb } from "../../../lib/db";

const allowedEmoji = new Set(["🌿", "💡", "🌞", "🚂", "🌊", "🌙"]);

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    if (scope === "all") {
      const auth = requireOwnerRequest(request);
      if (auth.error) return auth.error;
    }
    const rows = scope === "all"
      ? await getDb().select().from(messages).orderBy(desc(messages.createdAt)).limit(limit)
      : await getDb().select().from(messages).where(eq(messages.status, "visible")).orderBy(desc(messages.createdAt)).limit(limit);
    return Response.json({ messages: rows });
  } catch {
    return Response.json({ error: "留言墙暂时不可用" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const payload = await request.json();
    if (payload.website) return Response.json({ ok: true, message: null }, { status: 201 });
    const name = String(payload.name ?? "").trim().slice(0, 20);
    const content = String(payload.content ?? "").trim().slice(0, 280);
    const emoji = allowedEmoji.has(payload.emoji) ? payload.emoji : "🌿";
    if (!name || !content) return Response.json({ error: "请填写称呼和留言" }, { status: 400 });

    const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0] || "anonymous";
    const visitorHash = await sha256(`yige-wall-v1:${ip}`);
    const recent = await getRawDb()
      .prepare("SELECT COUNT(*) AS count FROM messages WHERE visitor_hash = ? AND created_at > datetime('now', '-10 minutes')")
      .bind(visitorHash)
      .first();
    if (Number(recent?.count ?? 0) >= 3) {
      return Response.json({ error: "稍微歇一会儿吧，每 10 分钟最多留下 3 条。" }, { status: 429 });
    }

    const values = { id: crypto.randomUUID(), name, content, emoji, status: "visible", visitorHash };
    const [message] = await getDb().insert(messages).values(values).returning();
    return Response.json({ message }, { status: 201 });
  } catch {
    return Response.json({ error: "留言没有发出，请稍后重试" }, { status: 500 });
  }
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
