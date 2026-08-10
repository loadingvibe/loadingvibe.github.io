import { media } from "../../../db/schema";
import { requireOwnerRequest } from "../../../lib/auth";
import { getDb, getMediaBucket } from "../../../lib/db";

const MAX_FILE_SIZE = 15 * 1024 * 1024;

export async function POST(request) {
  const auth = requireOwnerRequest(request);
  if (auth.error) return auth.error;
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) return Response.json({ error: "请选择文件" }, { status: 400 });
    if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
      return Response.json({ error: "单个文件需小于 15MB" }, { status: 400 });
    }
    if (!file.type.startsWith("image/") && !file.type.startsWith("audio/")) {
      return Response.json({ error: "目前支持图片和录音文件" }, { status: 415 });
    }
    const id = crypto.randomUUID();
    const cleanName = file.name.replace(/[\r\n"/\\]/g, "-").slice(0, 120) || "attachment";
    const objectKey = `uploads/${new Date().toISOString().slice(0, 10)}/${id}`;
    await getMediaBucket().put(objectKey, file.stream(), {
      httpMetadata: { contentType: file.type },
      customMetadata: { filename: cleanName },
    });
    await getDb().insert(media).values({ id, objectKey, filename: cleanName, contentType: file.type, size: file.size });
    const url = `/api/media/${id}`;
    const markdown = file.type.startsWith("image/") ? `![${cleanName}](${url})` : `[🎧 ${cleanName}](${url})`;
    return Response.json({ media: { id, url, filename: cleanName, contentType: file.type, markdown } }, { status: 201 });
  } catch {
    return Response.json({ error: "上传失败，请稍后重试" }, { status: 500 });
  }
}
