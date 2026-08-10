import { desc, eq } from "drizzle-orm";
import { notes } from "../../../db/schema";
import { requireOwnerRequest } from "../../../lib/auth";
import { getDb } from "../../../lib/db";
import { cleanTags, makeSlug, normalizeNote } from "../../../lib/note-utils";

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope");
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit")) || 50, 1), 100);
    if (scope === "all") {
      const auth = requireOwnerRequest(request);
      if (auth.error) return auth.error;
    }
    const db = getDb();
    const rows = scope === "all"
      ? await db.select().from(notes).orderBy(desc(notes.updatedAt), desc(notes.id)).limit(limit)
      : await db.select().from(notes).where(eq(notes.status, "published")).orderBy(desc(notes.createdAt), desc(notes.id)).limit(limit);
    return Response.json({ notes: rows.map(normalizeNote) });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request) {
  const auth = requireOwnerRequest(request);
  if (auth.error) return auth.error;
  try {
    const payload = await request.json();
    const title = String(payload.title ?? "").trim().slice(0, 120);
    const content = String(payload.content ?? "").trim();
    if (!title) return Response.json({ error: "请填写标题" }, { status: 400 });
    if (!content) return Response.json({ error: "请写一些正文" }, { status: 400 });
    const values = {
      slug: makeSlug(payload.slug || title),
      title,
      summary: String(payload.summary ?? "").trim().slice(0, 240),
      content,
      category: String(payload.category ?? "随笔").trim().slice(0, 20) || "随笔",
      tags: JSON.stringify(cleanTags(payload.tags)),
      coverUrl: payload.coverUrl ? String(payload.coverUrl).slice(0, 500) : null,
      status: payload.status === "draft" ? "draft" : "published",
    };
    const [note] = await getDb().insert(notes).values(values).returning();
    return Response.json({ note: normalizeNote(note) }, { status: 201 });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return Response.json({ error: "这个链接名已经被使用" }, { status: 409 });
    return routeError(error);
  }
}

function routeError(error) {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message.includes("no such table")) {
    return Response.json({ error: "笔记库正在初始化，请稍后重试" }, { status: 503 });
  }
  return Response.json({ error: "笔记库暂时不可用" }, { status: 500 });
}
