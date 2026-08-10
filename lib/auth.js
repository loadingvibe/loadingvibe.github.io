import { getOwnerUserId } from "./db";

export function getRequestUser(request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email");
  if (!userId || !email) return null;
  return { userId, email };
}

export function isOwnerUserId(userId) {
  const ownerId = getOwnerUserId();
  return Boolean(ownerId && userId && ownerId === userId);
}

export function requireOwnerRequest(request) {
  const user = getRequestUser(request);
  if (!user) return { error: Response.json({ error: "请先登录" }, { status: 401 }) };
  if (!isOwnerUserId(user.userId)) {
    return { error: Response.json({ error: "仅站点作者可执行此操作" }, { status: 403 }) };
  }
  return { user };
}
