import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { parseFrontmatter } from "@astrojs/markdown-remark";
import { createBlogCreationReader } from "./blog-created.mjs";

export const BLOG_EXTENSIONS = new Set([".md", ".markdown", ".txt"]);

export function isBlogSource(sourcePath) {
  const segments = sourcePath.replaceAll("\\", "/").split("/");
  const filename = segments.at(-1) || "";
  return BLOG_EXTENSIONS.has(extname(filename).toLowerCase()) &&
    !/^readme\./iu.test(filename) &&
    !segments.some((part) => part.startsWith("_") || part.startsWith(".") || /\.assets$/iu.test(part));
}

export function listBlogFiles(directory, prefix = "") {
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const sourcePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      if (/^[_.]|\.assets$/iu.test(entry.name)) return [];
      return listBlogFiles(join(directory, entry.name), sourcePath);
    }
    return entry.isFile() && isBlogSource(sourcePath) ? [sourcePath] : [];
  }).sort();
}

function scalar(value, depth = 0) {
  if (depth > 4) return "";
  if (typeof value === "string" || typeof value === "number") return String(value).trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return scalar(value.text ?? value.name ?? value.label ?? value.value, depth + 1);
  }
  return "";
}

function field(data, ...names) {
  for (const name of names) {
    if (data[name] !== undefined && data[name] !== null && data[name] !== "") return data[name];
  }
}

export function normalizeBlogRoute(value) {
  let route = scalar(value);
  try { route = decodeURIComponent(route); } catch { /* An unfinished percent escape is a filename character. */ }
  return route.normalize("NFC").toLowerCase().replaceAll("\\", "/")
    .replace(/^\/?blog\//iu, "").replace(/\.(?:md|markdown|txt)$/iu, "")
    .split("/").map((part) => part.trim().replace(/[\s?#%\u0000-\u001f\u007f]+/gu, "-")
      .replace(/[:*"<>|]/gu, "-").replace(/^-+|-+$/gu, ""))
    .filter((part) => part && part !== "." && part !== "..").join("/");
}

export function encodeBlogRoute(route) {
  return route.split("/").map(encodeURIComponent).join("/");
}

function list(value) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[,，;；\n|]/u) : [value];
  return [...new Set(values.map((value) => scalar(value)).filter(Boolean))];
}

function boolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (value === 1 || /^(?:true|yes|on|1|是|开启|草稿)$/iu.test(scalar(value))) return true;
  if (value === 0 || /^(?:false|no|off|0|否|关闭|发布|published)$/iu.test(scalar(value))) return false;
  return fallback;
}

function date(value) {
  if (value === undefined || value === null || value === "") return undefined;
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value : undefined;
  let candidate;
  if (typeof value === "number") candidate = new Date(value < 1e11 ? value * 1000 : value);
  else {
    const text = scalar(value).replace(/年|月/gu, "-").replace(/日/gu, "").replace(/^(\d{4})[/.](\d{1,2})[/.](\d{1,2})/u, "$1-$2-$3");
    const calendar = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:$|T|\s)/u.exec(text);
    if (calendar) {
      const checked = new Date(Date.UTC(Number(calendar[1]), Number(calendar[2]) - 1, Number(calendar[3])));
      if (checked.getUTCFullYear() !== Number(calendar[1]) || checked.getUTCMonth() + 1 !== Number(calendar[2]) || checked.getUTCDate() !== Number(calendar[3])) return undefined;
    }
    const match = /^(\d{4})-(\d{1,2})-(\d{1,2})$/u.exec(text);
    if (match) {
      candidate = new Date(`${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}T00:00:00+08:00`);
      if (Number.isFinite(candidate.getTime())) {
        const local = new Date(candidate.getTime() + 8 * 3600000);
        if (local.getUTCFullYear() !== Number(match[1]) || local.getUTCMonth() + 1 !== Number(match[2]) || local.getUTCDate() !== Number(match[3])) return undefined;
      }
    } else candidate = new Date(text);
  }
  return Number.isFinite(candidate.getTime()) ? candidate : undefined;
}

export function plainBlogText(body) {
  return body.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/gu, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/gu, " ").replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/<[^>]+>/gu, " ").replace(/[#>*_`~\[\]$|]/gu, " ").replace(/\s+/gu, " ").trim();
}

function recoverFields(raw) {
  const data = {};
  const blocks = raw.match(/^[^\s#][^\n]*(?:\n[\t ]+[^\n]*)*/gmu) || [];
  for (const block of blocks) {
    try { Object.assign(data, parseFrontmatter(`---\n${block}\n---`).frontmatter); }
    catch {
      const match = /^([^:=]+)\s*[:=]\s*(.*)$/u.exec(block.split("\n")[0]);
      if (match) data[match[1].trim()] = match[2].trim().replace(/^["']|["']$/gu, "");
    }
  }
  return data;
}

export function readBlogDocument(contents, sourcePath, options = {}) {
  const text = contents.replace(/^\uFEFF/u, "").replace(/\r\n?/gu, "\n");
  let body = text;
  let raw = {};
  const warnings = [];
  let incomplete = false;
  const opening = /^\s*(---|\+\+\+)[\t ]*\n/u.exec(text);
  if (opening) {
    const rest = text.slice(opening[0].length);
    const closing = new RegExp(`^${opening[1] === "+++" ? "\\+\\+\\+" : "---"}[\\t ]*$`, "mu").exec(rest);
    if (closing) {
      const metadata = rest.slice(0, closing.index);
      const looksLikeMetadata = opening[1] === "+++" || !metadata.trim() ||
        /^[\t ]*(?:[\p{L}_][^\n:=]*|["'][^"'\n]+["'])\s*:/mu.test(metadata) || /^\s*\{/u.test(metadata);
      if (looksLikeMetadata) {
        body = rest.slice(closing.index + closing[0].length).replace(/^\n/u, "");
        try {
          raw = parseFrontmatter(`${opening[1]}\n${metadata}\n${opening[1]}`).frontmatter;
          if (!raw || Array.isArray(raw) || typeof raw !== "object") raw = {};
          // Preserve bare YAML calendar dates before the parser can roll an invalid day forward.
          for (const match of metadata.matchAll(/^(date|日期|created|createdAt|创建时间|pubDate|published|发布时间|updated|更新日期|updatedAt|modified|lastmod):[\t ]*(\d{4}-\d{1,2}-\d{1,2}(?:[T ][^\n#]+)?)[\t ]*(?:#.*)?$/gmu)) {
            if (raw[match[1]] instanceof Date) raw[match[1]] = match[2].trim();
          }
        } catch {
          raw = recoverFields(metadata);
          incomplete = true;
          warnings.push("文章信息尚未写完整，已恢复可识别字段；本地可预览，修正后才会发布。");
        }
      }
    } else if (/^[\p{L}_][^\n:=]*\s*[:=]/mu.test(rest)) {
      raw = recoverFields(rest);
      incomplete = true;
      warnings.push("文章信息缺少结束分隔线，本地可预览，补上分隔线后才会发布。");
    }
  }

  const path = sourcePath.replace(/^Blog\//u, "").replaceAll("\\", "/");
  const textWithoutCode = body.replace(/(`{3,}|~{3,})[^\n]*\n[\s\S]*?\1/gu, "");
  const heading = textWithoutCode.match(/^ {0,3}#{1,6}\s+(.+?)(?:\s+#+)?\s*$/mu)?.[1] ||
    textWithoutCode.match(/^([^\n]+)\n(?:={3,}|-{3,})\s*$/mu)?.[1];
  const title = scalar(field(raw, "title", "标题", "name")) || (heading && plainBlogText(heading)) || basename(path, extname(path));
  const dateInput = field(raw, "date", "日期", "pubDate", "published", "发布时间", "created", "createdAt", "创建时间");
  const createdInput = field(raw, "created", "createdAt", "创建时间");
  const updatedInput = field(raw, "updated", "更新日期", "updatedAt", "modified", "lastmod");
  const published = date(dateInput) || date(path.match(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/u)?.[0]);
  const createdAt = date(createdInput) || published || date(typeof options.createdAt === "function" ? options.createdAt() : options.createdAt);
  // Plain notes can display their creation date. Malformed author dates keep their warning.
  const created = published || (!dateInput ? createdAt : undefined);
  const updated = date(updatedInput);
  if (dateInput && !date(dateInput)) warnings.push("日期未能识别，暂不显示日期。建议写为 YYYY-MM-DD。");
  if (createdInput && createdInput !== dateInput && !date(createdInput)) warnings.push("创建时间未能识别，已使用可用日期排序。建议写为 YYYY-MM-DD 或 ISO 时间。");
  if (updatedInput && !updated) warnings.push("更新日期未能识别，暂不显示更新日期。");
  const draftInput = field(raw, "draft", "草稿");
  const status = scalar(field(raw, "status", "状态"));
  const categoryValue = field(raw, "category", "分类", "categories");
  const data = {
    title,
    slug: normalizeBlogRoute(field(raw, "slug", "网址", "url", "permalink")) || normalizeBlogRoute(path) || "note",
    catalogNo: scalar(field(raw, "catalogNo", "编号", "catalog", "id")),
    summary: scalar(field(raw, "summary", "摘要", "description", "excerpt")) || plainBlogText(body).slice(0, 180) || `${title}的笔记。`,
    category: list(categoryValue)[0] || (path.startsWith("朋友圈/") ? "生活" : path.startsWith("收藏/") ? "收藏" : "笔记"),
    tags: list(field(raw, "tags", "标签", "keywords")),
    aliases: list(field(raw, "aliases", "alias", "别名")).map(normalizeBlogRoute).filter(Boolean),
    draft: incomplete || boolean(draftInput, draftInput !== undefined) || /^(?:draft|private|草稿|私密)$/iu.test(status),
    featured: boolean(field(raw, "featured", "精选", "推荐")),
    ...(created ? { date: created } : {}),
    ...(createdAt ? { createdAt } : {}),
    ...(updated ? { updated } : {}),
    ...(scalar(field(raw, "cover", "封面", "image")) ? { cover: scalar(field(raw, "cover", "封面", "image")) } : {}),
    authorWarnings: warnings,
  };
  return { data, body, warnings };
}

function hash(value) { return createHash("sha256").update(value).digest("hex").slice(0, 10); }

/** Resolve claims in source-path order, independent of file system or loader timing. No source is dropped. */
export function resolveBlogEntries(entries) {
  const sorted = [...entries].sort((a, b) => a.filePath < b.filePath ? -1 : a.filePath > b.filePath ? 1 : 0);
  const reservedRoutes = new Set(sorted.map((entry) => entry.data.slug));
  const reservedNumbers = new Set(sorted.map((entry) => entry.data.catalogNo).filter(Boolean));
  const routes = new Set();
  const numbers = new Set();
  const resolved = sorted.map((entry) => {
    const data = { ...entry.data, aliases: [...entry.data.aliases], authorWarnings: [...entry.data.authorWarnings] };
    if (routes.has(data.slug)) {
      const desired = data.slug;
      let fallback = normalizeBlogRoute(entry.filePath.replace(/^Blog\//u, ""));
      if (!fallback || reservedRoutes.has(fallback) || routes.has(fallback)) fallback = `${desired}-${hash(entry.id)}`;
      while (routes.has(fallback) || reservedRoutes.has(fallback)) fallback += `-${hash(fallback)}`;
      data.slug = fallback;
      data.authorWarnings.push(`slug「${desired}」重复，本篇使用 /blog/${fallback}/。可填写独立 slug 固定地址。`);
    }
    routes.add(data.slug);
    if (!data.catalogNo || numbers.has(data.catalogNo)) {
      if (data.catalogNo) data.authorWarnings.push(`编号「${data.catalogNo}」重复，已为本篇生成独立编号。`);
      let generated = `F-${Number.parseInt(hash(entry.id), 16)}`;
      while (numbers.has(generated) || reservedNumbers.has(generated)) generated += "0";
      data.catalogNo = generated;
    }
    numbers.add(data.catalogNo);
    return { ...entry, data };
  });
  // Canonical URLs always take priority over redirects, including a new article that claims an old alias.
  for (const entry of resolved) {
    entry.data.aliases = entry.data.aliases.filter((alias) => {
      if (alias === entry.data.slug) return false;
      if (routes.has(alias)) {
        entry.data.authorWarnings.push(`旧地址「${alias}」已被其他文章使用，已跳过此跳转。`);
        return false;
      }
      routes.add(alias);
      return true;
    });
  }
  return resolved;
}

export function readBlogSources(blogRoot) {
  const readCreation = createBlogCreationReader(blogRoot);
  return resolveBlogEntries(listBlogFiles(blogRoot).map((sourcePath) => {
    const filePath = join(blogRoot, sourcePath);
    const document = readBlogDocument(readFileSync(filePath, "utf8"), sourcePath, { createdAt: () => readCreation(filePath) });
    return { id: sourcePath, filePath: `Blog/${sourcePath}`, ...document };
  }));
}
