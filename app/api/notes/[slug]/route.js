import { and, eq, sql } from "drizzle-orm";
import { notes } from "../../../../db/schema";
import { getRequestUser, isOwnerUserId, requireOwnerRequest } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";
import { cleanTags, makeSlug, normalizeNote } from "../../../../lib/note-utils";

export async function GET(request, { params }) {
  try {
    const { slug } = await params;
    const user = getRequestUser(request);
    const owner = user && isOwnerUserId(user.userId);
    const [note] = await getDb()
      .select()
      .from(notes)
      .where(owner ? eq(notes.slug, slug) : and(eq(notes.slug, slug), eq(notes.status, "published")))
      .limit(1);
    if (!note) return Response.json({ error: "笔记不存在" }, { status: 404 });
    return Response.json({ note: normalizeNote(note) });
  } catch {
    return Response.json({ error: "无法打开这篇笔记" }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const auth = requireOwnerRequest(request);
  if (auth.error) return auth.error;
  try {
    const { slug } = await params;
    const payload = await request.json();
    const title = String(payload.title ?? "").trim().slice(0, 120);
    const content = String(payload.content ?? "").trim();
    if (!title || !content) return Response.json({ error: "标题和正文不能为空" }, { status: 400 });
    const [note] = await getDb()
      .update(notes)
      .set({
        slug: makeSlug(payload.slug || title),
        title,
        summary: String(payload.summary ?? "").trim().slice(0, 240),
        content,
        category: String(payload.category ?? "随笔").trim().slice(0, 20) || "随笔",
        tags: JSON.stringify(cleanTags(payload.tags)),
        coverUrl: payload.coverUrl ? String(payload.coverUrl).slice(0, 500) : null,
        status: payload.status === "draft" ? "draft" : "published",
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(eq(notes.slug, slug))
      .returning();
    if (!note) return Response.json({ error: "笔记不存在" }, { status: 404 });
    return Response.json({ note: normalizeNote(note) });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return Response.json({ error: "这个链接名已经被使用" }, { status: 409 });
    return Response.json({ error: "保存失败" }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  const auth = requireOwnerRequest(request);
  if (auth.error) return auth.error;
  const { slug } = await params;
  await getDb().delete(notes).where(eq(notes.slug, slug));
  return Response.json({ ok: true });
}
