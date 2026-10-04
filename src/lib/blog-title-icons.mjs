/** @typedef {{ id: string, label: string, src: string }} BlogTitleIcon */
/**
 * @typedef {Object} BlogTitleIconPost
 * @property {string} sourcePath
 * @property {Date} [createdAt]
 * @property {Date} [date]
 * @property {{ data?: { draft?: boolean } }} [entry]
 */

// Match the reference library from left to right, then from top to bottom.
/** @type {readonly Readonly<BlogTitleIcon>[]} */
export const BLOG_TITLE_ICONS = Object.freeze([
  ["minimal-lamp", "极简台灯"],
  ["record-player", "唱片机"],
  ["teacup", "茶杯"],
  ["potted-plant", "盆栽"],
  ["picture-frame", "画框"],
  ["window", "窗户"],
  ["small-sofa", "小沙发"],
  ["cat", "小猫猫"],
  ["leaf-lamp", "叶子台灯"],
  ["bookshelf", "书架"],
  ["radio", "收音机"],
  ["hanging-plant", "吊篮盆栽"],
  ["storage-shelf", "置物架"],
  ["sofa-set", "沙发组合"],
].map(([id, label], index) => Object.freeze({
  id,
  label,
  src: `/assets/blog/title-icons/${String(index + 1).padStart(2, "0")}-${id}.svg`,
})));

const sourceOrder = new Intl.Collator("zh-CN", { numeric: true, sensitivity: "base" });

/** @param {BlogTitleIconPost} post */
function createdTimestamp(post) {
  const timestamp = (post.createdAt ?? post.date)?.getTime();
  return typeof timestamp === "number" && Number.isFinite(timestamp) ? timestamp : 0;
}

/**
 * Assign across the whole blog, oldest first, so a newly created article gets
 * the next icon without changing older articles. Preview-only drafts follow
 * published articles and cannot change their icons.
 * @param {Iterable<BlogTitleIconPost>} posts
 * @returns {Map<string, Readonly<BlogTitleIcon>>}
 */
export function assignBlogTitleIcons(posts) {
  const orderedPosts = [...posts].sort((left, right) => {
    const draftDifference = Number(Boolean(left.entry?.data?.draft))
      - Number(Boolean(right.entry?.data?.draft));
    const createdDifference = createdTimestamp(left) - createdTimestamp(right);
    const pathDifference = sourceOrder.compare(left.sourcePath, right.sourcePath);
    // The collator considers some different paths equal, including case variants.
    const exactPathDifference = left.sourcePath < right.sourcePath ? -1
      : left.sourcePath > right.sourcePath ? 1 : 0;
    return draftDifference || createdDifference || pathDifference || exactPathDifference;
  });

  return new Map(orderedPosts.map((post, index) => [
    post.sourcePath,
    BLOG_TITLE_ICONS[index % BLOG_TITLE_ICONS.length],
  ]));
}
