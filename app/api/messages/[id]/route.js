import { eq } from "drizzle-orm";
import { messages } from "../../../../db/schema";
import { requireOwnerRequest } from "../../../../lib/auth";
import { getDb } from "../../../../lib/db";

export async function DELETE(request, { params }) {
  const auth = requireOwnerRequest(request);
  if (auth.error) return auth.error;
  const { id } = await params;
  await getDb().delete(messages).where(eq(messages.id, id));
  return Response.json({ ok: true });
}
