import { getRequestUser, isOwnerUserId } from "../../../lib/auth";

export async function GET(request) {
  const user = getRequestUser(request);
  return Response.json({ signedIn: Boolean(user), isOwner: Boolean(user && isOwnerUserId(user.userId)) });
}
