export function normalizeNote(row) {
  return {
    ...row,
    tags: safeJsonArray(row.tags),
  };
}

export function safeJsonArray(value) {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function makeSlug(value) {
  const normalized = String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .trim()
    .replace(/[^\p{Letter}\p{Number}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return normalized || `note-${Date.now()}`;
}

export function cleanTags(value) {
  const list = Array.isArray(value) ? value : String(value ?? "").split(/[,，]/);
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))].slice(0, 8);
}
