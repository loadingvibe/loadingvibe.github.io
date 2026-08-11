import { media } from "../../../db/schema";
import { getDb, getMediaBucket, getRawDb } from "../../../lib/db";
import { getVisitorHash } from "../../../lib/visitor";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"]);

export async function POST(request) {
  try {
    const visitorHash = await getVisitorHash(request);
    if (!visitorHash) return Response.json({ error: "无法确认图片归属，请刷新后重试" }, { status: 400 });
    const recent = await getRawDb()
      .prepare("SELECT COUNT(*) AS count FROM media WHERE visitor_hash = ? AND created_at > datetime('now', '-1 hour')")
      .bind(visitorHash)
      .first();
    if (Number(recent?.count ?? 0) >= 6) {
      return Response.json({ error: "每小时最多上传 6 张图片，请稍后再来" }, { status: 429 });
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "请选择图片" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "图片大小需在 5 MB 以内" }, { status: 400 });
    }
    if (!ALLOWED_TYPES.has(file.type)) {
      return Response.json({ error: "支持 JPG、PNG、WebP、GIF 或 AVIF 图片" }, { status: 415 });
    }

    const id = crypto.randomUUID();
    const cleanName = file.name.replace(/[\r\n"/\\]/g, "-").slice(0, 120) || "message-image";
    const objectKey = `message-uploads/${new Date().toISOString().slice(0, 10)}/${id}`;
    await getMediaBucket().put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { filename: cleanName },
    });
    await getDb().insert(media).values({
      id,
      objectKey,
      filename: cleanName,
      contentType: file.type,
      size: file.size,
      visitorHash,
    });
    return Response.json({ media: { id, url: `/api/media/${id}` } }, { status: 201 });
  } catch {
    return Response.json({ error: "图片上传失败，请稍后重试" }, { status: 500 });
  }
}
