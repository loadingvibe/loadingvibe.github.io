import { desc, eq } from "drizzle-orm";
import { messages } from "../../../db/schema";
import { requireOwnerRequest } from "../../../lib/auth";
import { getDb, getRawDb } from "../../../lib/db";
import { getVisitorHash, isOwnerRequest } from "../../../lib/visitor";

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
    const visitorHash = await getVisitorHash(request);
    const owner = isOwnerRequest(request);
    return Response.json({
      messages: rows.map((row) => presentMessage(row, visitorHash, owner)),
    });
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

    const visitorHash = await getVisitorHash(request);
    if (!visitorHash) return Response.json({ error: "无法确认这张留言的归属，请刷新后重试" }, { status: 400 });
    const imageUrl = await verifyImageUrl(payload.imageUrl, visitorHash);
    if (payload.imageUrl && !imageUrl) return Response.json({ error: "图片凭证已失效，请重新选择" }, { status: 400 });

    const recent = await getRawDb()
      .prepare("SELECT COUNT(*) AS count FROM messages WHERE visitor_hash = ? AND created_at > datetime('now', '-10 minutes')")
      .bind(visitorHash)
      .first();
    if (Number(recent?.count ?? 0) >= 3) {
      return Response.json({ error: "稍微歇一会儿吧，每 10 分钟最多留下 3 条。" }, { status: 429 });
    }

    const values = { id: crypto.randomUUID(), name, content, emoji, imageUrl, status: "visible", visitorHash };
    const [message] = await getDb().insert(messages).values(values).returning();
    return Response.json({ message: presentMessage(message, visitorHash, false) }, { status: 201 });
  } catch {
    return Response.json({ error: "留言没有发出，请稍后重试" }, { status: 500 });
  }
}

function presentMessage(row, visitorHash, owner) {
  const { visitorHash: _privateVisitorHash, ...message } = row;
  const belongsToVisitor = Boolean(visitorHash && row.visitorHash === visitorHash);
  return { ...message, canEdit: belongsToVisitor, canDelete: belongsToVisitor || owner };
}

async function verifyImageUrl(value, visitorHash) {
  if (!value) return null;
  const match = String(value).match(/^\/api\/media\/([0-9a-f-]{36})$/i);
  if (!match) return null;
  const row = await getRawDb()
    .prepare("SELECT id FROM media WHERE id = ? AND visitor_hash = ? AND content_type LIKE 'image/%'")
    .bind(match[1], visitorHash)
    .first();
  return row ? `/api/media/${match[1]}` : null;
}
