import { eq } from "drizzle-orm";
import { messages } from "../../../../db/schema";
import { getDb, getMediaBucket, getRawDb } from "../../../../lib/db";
import { getVisitorHash, isOwnerRequest } from "../../../../lib/visitor";

const allowedEmoji = new Set(["🌿", "💡", "🌞", "🚂", "🌊", "🌙"]);

export async function PUT(request, { params }) {
  try {
    const { id } = await params;
    const visitorHash = await getVisitorHash(request);
    const existing = await getMessage(id);
    if (!existing) return Response.json({ error: "这条留言已经不在墙上了" }, { status: 404 });
    if (!visitorHash || existing.visitor_hash !== visitorHash) {
      return Response.json({ error: "只能编辑自己留下的留言" }, { status: 403 });
    }

    const payload = await request.json();
    const name = String(payload.name ?? "").trim().slice(0, 20);
    const content = String(payload.content ?? "").trim().slice(0, 280);
    const emoji = allowedEmoji.has(payload.emoji) ? payload.emoji : existing.emoji;
    if (!name || !content) return Response.json({ error: "请填写称呼和留言" }, { status: 400 });

    const [message] = await getDb()
      .update(messages)
      .set({ name, content, emoji })
      .where(eq(messages.id, id))
      .returning();
    const { visitorHash: _privateVisitorHash, ...safeMessage } = message;
    return Response.json({ message: { ...safeMessage, canEdit: true, canDelete: true } });
  } catch {
    return Response.json({ error: "修改没有保存，请稍后重试" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { id } = await params;
    const visitorHash = await getVisitorHash(request);
    const existing = await getMessage(id);
    if (!existing) return Response.json({ ok: true });
    if (!isOwnerRequest(request) && (!visitorHash || existing.visitor_hash !== visitorHash)) {
      return Response.json({ error: "只能删除自己留下的留言" }, { status: 403 });
    }
    await getDb().delete(messages).where(eq(messages.id, id));
    await removeMessageImage(existing.image_url).catch(() => {});
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "删除失败，请稍后重试" }, { status: 500 });
  }
}

async function getMessage(id) {
  return getRawDb()
    .prepare("SELECT id, name, content, emoji, image_url, visitor_hash FROM messages WHERE id = ?")
    .bind(id)
    .first();
}

async function removeMessageImage(imageUrl) {
  const match = String(imageUrl ?? "").match(/^\/api\/media\/([0-9a-f-]{36})$/i);
  if (!match) return;
  const media = await getRawDb()
    .prepare("SELECT object_key FROM media WHERE id = ? AND visitor_hash IS NOT NULL")
    .bind(match[1])
    .first();
  if (!media) return;
  await getMediaBucket().delete(media.object_key);
  await getRawDb().prepare("DELETE FROM media WHERE id = ?").bind(match[1]).run();
}
