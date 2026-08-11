import { getRequestUser, isOwnerUserId } from "./auth";

const VISITOR_TOKEN_HEADER = "x-visitor-token";

export function getVisitorToken(request) {
  const token = request.headers.get(VISITOR_TOKEN_HEADER)?.trim() ?? "";
  return token.length >= 20 && token.length <= 200 ? token : "";
}

export async function getVisitorHash(request) {
  const token = getVisitorToken(request);
  return token ? sha256(`yige-wall-v2:${token}`) : "";
}

export function isOwnerRequest(request) {
  return isOwnerUserId(getRequestUser(request)?.userId);
}

export async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}
