import { getRequestUser, isOwnerUserId } from "../../../lib/auth";

export async function GET(request) {
  const user = getRequestUser(request);
  const status = { signedIn: Boolean(user), isOwner: Boolean(user && isOwnerUserId(user.userId)) };
  if (new URL(request.url).searchParams.get("diagnostic") === "1" && user) {
    return Response.json({ ...status, userId: user.userId, email: user.email });
  }
  return Response.json(status);
}
