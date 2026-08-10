import { getMediaBucket, getRawDb } from "../../../../lib/db";

export async function GET(_request, { params }) {
  const { id } = await params;
  const row = await getRawDb()
    .prepare("SELECT object_key, filename, content_type FROM media WHERE id = ?")
    .bind(id)
    .first();
  if (!row) return new Response("Not found", { status: 404 });
  const object = await getMediaBucket().get(row.object_key);
  if (!object) return new Response("Not found", { status: 404 });
  const headers = new Headers();
  headers.set("content-type", row.content_type);
  headers.set("content-disposition", `inline; filename*=UTF-8''${encodeURIComponent(row.filename)}`);
  headers.set("cache-control", "public, max-age=31536000, immutable");
  if (object.httpEtag) headers.set("etag", object.httpEtag);
  return new Response(object.body, { headers });
}
