"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./ArchiveExplorer.css";

const ALL_CATEGORIES = "__all__";
const SORT_OPTIONS = new Set(["newest", "oldest", "title"]);
const SORT_LABELS = {
  newest: "最新优先",
  oldest: "最早优先",
  title: "标题 A–Z",
};
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Shanghai",
  year: "numeric",
});
const categoryCollator = new Intl.Collator("zh-CN", {
  numeric: true,
  sensitivity: "base",
});
const categoryOrder = new Map(["生活", "工作", "笔记", "收藏"].map((category, index) => [category, index]));

function normalizedText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLocaleLowerCase("zh-CN")
    .replace(/\s+/gu, " ")
    .trim();
}

function dateValue(value) {
  if (!value) return 0;
  const timestamp = value instanceof Date ? value.getTime() : Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function categoryFor(post) {
  if (String(post.category || "").trim()) return String(post.category).trim();
  return "未分类";
}

function preparePosts(posts) {
  return (Array.isArray(posts) ? posts : [])
    .filter((post) => post && post.title && post.href)
    .map((post, sourceIndex) => {
      const tags = Array.isArray(post.tags)
        ? [...new Set(post.tags.map((tag) => String(tag).trim()).filter(Boolean))]
        : [];
      const category = categoryFor(post);
      const timestamp = dateValue(post.date);
      const date = timestamp ? new Date(timestamp) : null;
      const searchText = normalizedText([
        post.title,
        post.summary,
        category,
        post.sourcePath,
        post.routePath,
        post.slug,
        post.directory,
        Array.isArray(post.directorySegments) ? post.directorySegments.join("/") : "",
        ...tags,
      ].join(" "));

      return {
        ...post,
        category,
        date,
        searchText,
        sourceIndex,
        tags,
        timestamp,
      };
    })
    .sort((left, right) => right.timestamp - left.timestamp || left.sourceIndex - right.sourceIndex);
}

function formatDate(date) {
  if (!date) return "日期待补";
  return dateFormatter.format(date).replaceAll("/", " · ");
}

function scrollBehavior() {
  if (typeof window === "undefined" || !window.matchMedia) return "smooth";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

function sortPosts(posts, sortMode) {
  return [...posts].sort((left, right) => {
    if (sortMode === "title") {
      return categoryCollator.compare(left.title, right.title) || right.timestamp - left.timestamp;
    }

    if (left.timestamp && !right.timestamp) return -1;
    if (!left.timestamp && right.timestamp) return 1;
    if (sortMode === "oldest") {
      return left.timestamp - right.timestamp || left.sourceIndex - right.sourceIndex;
    }
    return right.timestamp - left.timestamp || left.sourceIndex - right.sourceIndex;
  });
}

function railSelection(posts, limit) {
  const featured = posts.filter((post) => post.featured);
  const recent = posts.filter((post) => !post.featured);
  return [...featured, ...recent].slice(0, limit);
}

/**
 * @typedef {Object} ArchiveExplorerPost
 * @property {string} title
 * @property {string} [catalogNo]
 * @property {string} summary
 * @property {string} category
 * @property {string[]} tags
 * @property {string} href
 * @property {string} [slug]
 * @property {string} [sourcePath]
 * @property {string} [routePath]
 * @property {string | string[]} [directory]
 * @property {string[]} [directorySegments]
 * @property {string | Date} [date]
 * @property {string | Date} [updated]
 * @property {number} [readingMinutes]
 * @property {string} [cover]
 * @property {string} [coverAlt]
 * @property {boolean} [featured]
 */

/**
 * @typedef {Object} ArchiveExplorerProps
 * @property {ArchiveExplorerPost[]} [posts]
 * @property {string} [eyebrow]
 * @property {string} [heading]
 * @property {string} [description]
 * @property {string} [searchPlaceholder]
 * @property {string} [archiveHref]
 * @property {string} [archiveLabel]
 * @property {string} [className]
 * @property {"rail" | "catalog"} [mode]
 * @property {number} [railLimit]
 * @property {number} [pageSize]
 * @property {"newest" | "oldest" | "title"} [initialSort]
 */

/** @param {ArchiveExplorerProps} props */
export default function ArchiveExplorer({
  posts = [],
  eyebrow = "THE LIVING CIRCUIT · SIGNALS",
  heading = "最近收到的信号",
  description = "生活、工作与学习笔记，由 Markdown 持续生成。",
  searchPlaceholder = "搜索标题、摘要、标签或目录……",
  archiveHref = "/blog/",
  archiveLabel = "查看全部档案",
  className = "",
  mode = "rail",
  railLimit = 8,
  pageSize = 12,
  initialSort = "newest",
}) {
  const headingId = useId();
  const searchId = useId();
  const listId = useId();
  const sortId = useId();
  const railRef = useRef(null);
  const searchRef = useRef(null);
  const directoryQueryAppliedRef = useRef(false);
  const isCatalog = mode === "catalog";
  const batchSize = Math.max(1, Math.floor(Number(pageSize) || 12));
  const signalLimit = Math.max(1, Math.floor(Number(railLimit) || 8));
  const defaultSort = SORT_OPTIONS.has(initialSort) ? initialSort : "newest";
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
  const [sortMode, setSortMode] = useState(defaultSort);
  const [visibleCount, setVisibleCount] = useState(batchSize);
  const [scrollState, setScrollState] = useState({ backward: false, forward: false });

  const preparedPosts = useMemo(() => preparePosts(posts), [posts]);
  const categories = useMemo(() => {
    const counts = new Map();
    preparedPosts.forEach((post) => counts.set(post.category, (counts.get(post.category) || 0) + 1));
    return [...counts.entries()].sort(([left], [right]) => {
      const leftOrder = categoryOrder.get(left) ?? Number.POSITIVE_INFINITY;
      const rightOrder = categoryOrder.get(right) ?? Number.POSITIVE_INFINITY;
      return leftOrder - rightOrder || categoryCollator.compare(left, right);
    });
  }, [preparedPosts]);

  const filteredPosts = useMemo(() => {
    const terms = normalizedText(query).split(" ").filter(Boolean);
    return preparedPosts.filter((post) => {
      const matchesCategory = selectedCategory === ALL_CATEGORIES || post.category === selectedCategory;
      const matchesQuery = terms.every((term) => post.searchText.includes(term));
      return matchesCategory && matchesQuery;
    });
  }, [preparedPosts, query, selectedCategory]);

  const orderedPosts = useMemo(
    () => sortPosts(filteredPosts, isCatalog ? sortMode : "newest"),
    [filteredPosts, isCatalog, sortMode],
  );
  const visiblePosts = useMemo(
    () => (isCatalog
      ? orderedPosts.slice(0, visibleCount)
      : railSelection(orderedPosts, signalLimit)),
    [isCatalog, orderedPosts, signalLimit, visibleCount],
  );
  const remainingCount = Math.max(0, orderedPosts.length - visiblePosts.length);

  useEffect(() => {
    if (directoryQueryAppliedRef.current || typeof window === "undefined") return;
    directoryQueryAppliedRef.current = true;

    const directoryQuery = new URLSearchParams(window.location.search).get("directory")?.trim();
    if (!directoryQuery) return;

    const matchedCategory = categories.find(
      ([category]) => normalizedText(category) === normalizedText(directoryQuery),
    );
    if (matchedCategory) setSelectedCategory(matchedCategory[0]);
    else setQuery(directoryQuery);
  }, [categories]);

  useEffect(() => {
    if (selectedCategory !== ALL_CATEGORIES && !categories.some(([category]) => category === selectedCategory)) {
      setSelectedCategory(ALL_CATEGORIES);
    }
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (isCatalog) setVisibleCount(batchSize);
  }, [batchSize, isCatalog, query, selectedCategory, sortMode]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) {
      setScrollState((current) => (
        current.backward || current.forward ? { backward: false, forward: false } : current
      ));
      return undefined;
    }

    const updateScrollState = () => {
      const maximum = Math.max(0, rail.scrollWidth - rail.clientWidth);
      const backward = rail.scrollLeft > 4;
      const forward = maximum - rail.scrollLeft > 4;
      setScrollState((current) => (
        current.backward === backward && current.forward === forward
          ? current
          : { backward, forward }
      ));
    };

    updateScrollState();
    rail.addEventListener("scroll", updateScrollState, { passive: true });
    const resizeObserver = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(updateScrollState);
    resizeObserver?.observe(rail);

    return () => {
      rail.removeEventListener("scroll", updateScrollState);
      resizeObserver?.disconnect();
    };
  }, [isCatalog, visiblePosts.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const frame = requestAnimationFrame(() => rail.scrollTo({ left: 0, behavior: "auto" }));
    return () => cancelAnimationFrame(frame);
  }, [query, selectedCategory, visiblePosts.length]);

  useEffect(() => {
    const handleShortcut = (event) => {
      if (event.key !== "/" || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable='true']")) return;
      event.preventDefault();
      searchRef.current?.focus();
    };

    document.addEventListener("keydown", handleShortcut);
    return () => document.removeEventListener("keydown", handleShortcut);
  }, []);

  const resetFilters = () => {
    setQuery("");
    setSelectedCategory(ALL_CATEGORIES);
    setSortMode(defaultSort);
    setVisibleCount(batchSize);
    searchRef.current?.focus();
  };

  const chooseCategory = (category) => {
    setSelectedCategory(category);
    if (isCatalog) setVisibleCount(batchSize);
  };

  const changeQuery = (value) => {
    setQuery(value);
    if (isCatalog) setVisibleCount(batchSize);
  };

  const changeSort = (value) => {
    setSortMode(SORT_OPTIONS.has(value) ? value : "newest");
    setVisibleCount(batchSize);
  };

  const moveRail = (direction) => {
    const rail = railRef.current;
    if (!rail) return;
    rail.scrollBy({
      behavior: scrollBehavior(),
      left: direction * Math.max(280, rail.clientWidth * 0.82),
    });
  };

  return (
    <section
      className={`archive-explorer archive-explorer--${isCatalog ? "catalog" : "rail"}${className ? ` ${className}` : ""}`}
      aria-labelledby={headingId}
    >
      <span className="archive-explorer__current" aria-hidden="true" />

      <header className="archive-explorer__header">
        <div className="archive-explorer__heading">
          <p>{eyebrow}</p>
          <h2 id={headingId}>{heading}</h2>
        </div>
        <div className="archive-explorer__intro">
          <p>{description}</p>
          {archiveHref && <a href={archiveHref}>{archiveLabel}<span aria-hidden="true"> ↗</span></a>}
        </div>
      </header>

      <div className="archive-explorer__controls">
        <form
          className="archive-explorer__search"
          role="search"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="archive-explorer__sr-only" htmlFor={searchId}>搜索文章</label>
          <span aria-hidden="true" className="archive-explorer__search-icon" />
          <input
            ref={searchRef}
            id={searchId}
            type="search"
            value={query}
            placeholder={searchPlaceholder}
            autoComplete="off"
            aria-keyshortcuts="/"
            onChange={(event) => changeQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                changeQuery("");
              }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </form>

        <div className="archive-explorer__filters" aria-label="按分类筛选文章">
          <button
            type="button"
            className={selectedCategory === ALL_CATEGORIES ? "is-active" : undefined}
            aria-pressed={selectedCategory === ALL_CATEGORIES}
            onClick={() => chooseCategory(ALL_CATEGORIES)}
          >
            全部 <span>{preparedPosts.length}</span>
          </button>
          {categories.map(([category, count]) => (
            <button
              key={category}
              type="button"
              className={selectedCategory === category ? "is-active" : undefined}
              aria-pressed={selectedCategory === category}
              onClick={() => chooseCategory(category)}
            >
              {category} <span>{count}</span>
            </button>
          ))}
        </div>
        {isCatalog && (
          <div className="archive-explorer__sort">
            <label htmlFor={sortId}>排序</label>
            <select id={sortId} value={sortMode} onChange={(event) => changeSort(event.target.value)}>
              <option value="newest">最新优先</option>
              <option value="oldest">最早优先</option>
              <option value="title">标题 A–Z</option>
            </select>
          </div>
        )}
      </div>

      <div className="archive-explorer__status-row">
        <p aria-live="polite" aria-atomic="true">
          <strong>{String(orderedPosts.length).padStart(2, "0")}</strong>
          <span>
            {isCatalog
              ? ` 条结果 · 已显示 ${String(visiblePosts.length).padStart(2, "0")} · ${SORT_LABELS[sortMode]}`
              : ` 条信号 · 展示 ${String(visiblePosts.length).padStart(2, "0")} 条精选 / 最近`}
          </span>
        </p>
        {!isCatalog && (
          <div className="archive-explorer__rail-controls" aria-label="滑动文章列表">
            <button
              type="button"
              aria-label="向前浏览文章"
              disabled={!scrollState.backward}
              onClick={() => moveRail(-1)}
            >
              <span aria-hidden="true">←</span>
            </button>
            <button
              type="button"
              aria-label="向后浏览文章"
              disabled={!scrollState.forward}
              onClick={() => moveRail(1)}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        )}
      </div>

      {orderedPosts.length ? (
        <>
        <ol
          ref={isCatalog ? undefined : railRef}
          id={listId}
          className={isCatalog ? "archive-explorer__catalog" : "archive-explorer__rail"}
          aria-label={isCatalog ? "文章目录结果" : "文章滑动列表"}
        >
          {visiblePosts.map((post, index) => (
            <li key={post.href}>
              <article className="archive-signal-card">
                {post.cover ? (
                  <div className="archive-signal-card__cover">
                    <img
                      src={post.cover}
                      alt={post.coverAlt || ""}
                      loading="lazy"
                      decoding="async"
                    />
                  </div>
                ) : (
                  <div className="archive-signal-card__diagram" aria-hidden="true">
                    <i /><i /><i />
                  </div>
                )}
                <div className="archive-signal-card__body">
                  <div className="archive-signal-card__meta">
                    <span>{post.catalogNo || `F-${String(index + 1).padStart(3, "0")}`}</span>
                    <span>{post.featured ? "精选 · " : ""}{post.category}</span>
                  </div>
                  <h3>{post.title}</h3>
                  {post.summary && <p>{post.summary}</p>}
                  {post.tags.length > 0 && (
                    <ul className="archive-signal-card__tags" aria-label="文章标签">
                      {post.tags.slice(0, 4).map((tag) => <li key={tag}>#{tag}</li>)}
                    </ul>
                  )}
                  <footer>
                    <time dateTime={post.date?.toISOString()}>{formatDate(post.date)}</time>
                    {post.readingMinutes ? <span>{post.readingMinutes} MIN</span> : <span>MD</span>}
                  </footer>
                </div>
                <a className="archive-signal-card__link" href={post.href} aria-label={`阅读《${post.title}》`}>
                  <span>打开正文</span><b aria-hidden="true">↗</b>
                </a>
              </article>
            </li>
          ))}
        </ol>
        {isCatalog && (
          <div className="archive-explorer__pagination">
            <div>
              <span>阅读进度</span>
              <progress aria-label="已显示文章比例" value={visiblePosts.length} max={orderedPosts.length}>
                {visiblePosts.length} / {orderedPosts.length}
              </progress>
            </div>
            <p>已显示 {visiblePosts.length} / {orderedPosts.length} 篇</p>
            <button
              type="button"
              aria-controls={listId}
              disabled={remainingCount === 0}
              onClick={() => setVisibleCount((count) => Math.min(count + batchSize, orderedPosts.length))}
            >
              {remainingCount > 0
                ? <>加载更多 <span>+{Math.min(batchSize, remainingCount)}</span></>
                : "已显示全部"}
            </button>
          </div>
        )}
        </>
      ) : (
        <div className="archive-explorer__empty" role="status">
          <span aria-hidden="true">NO SIGNAL</span>
          <h3>{preparedPosts.length ? "没有找到匹配的文章" : "还没有已发布的文章"}</h3>
          <p>
            {preparedPosts.length
              ? "试试其他关键词，或清除当前目录筛选。"
              : "在 Blog 文件夹中添加 Markdown，网站下次构建时会自动收录。"}
          </p>
          {preparedPosts.length > 0 && <button type="button" onClick={resetFilters}>清除筛选</button>}
        </div>
      )}
    </section>
  );
}
