"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import "./ArchiveExplorer.css";

const ALL_CATEGORIES = "__all__";
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

/**
 * @typedef {Object} ArchiveExplorerPost
 * @property {string} title
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
}) {
  const headingId = useId();
  const searchId = useId();
  const railRef = useRef(null);
  const searchRef = useRef(null);
  const directoryQueryAppliedRef = useRef(false);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES);
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
  }, [filteredPosts.length]);

  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return undefined;
    const frame = requestAnimationFrame(() => rail.scrollTo({ left: 0, behavior: "auto" }));
    return () => cancelAnimationFrame(frame);
  }, [query, selectedCategory]);

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
    searchRef.current?.focus();
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
      className={`archive-explorer${className ? ` ${className}` : ""}`}
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
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape" && query) {
                event.preventDefault();
                setQuery("");
              }
            }}
          />
          <kbd aria-hidden="true">/</kbd>
        </form>

        <div className="archive-explorer__filters" aria-label="按目录筛选文章">
          <button
            type="button"
            className={selectedCategory === ALL_CATEGORIES ? "is-active" : undefined}
            aria-pressed={selectedCategory === ALL_CATEGORIES}
            onClick={() => setSelectedCategory(ALL_CATEGORIES)}
          >
            全部 <span>{preparedPosts.length}</span>
          </button>
          {categories.map(([category, count]) => (
            <button
              key={category}
              type="button"
              className={selectedCategory === category ? "is-active" : undefined}
              aria-pressed={selectedCategory === category}
              onClick={() => setSelectedCategory(category)}
            >
              {category} <span>{count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="archive-explorer__status-row">
        <p aria-live="polite" aria-atomic="true">
          <strong>{String(filteredPosts.length).padStart(2, "0")}</strong>
          <span>{query || selectedCategory !== ALL_CATEGORIES ? " 条匹配信号" : " 条信号 · 最新优先"}</span>
        </p>
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
      </div>

      {filteredPosts.length ? (
        <ol ref={railRef} className="archive-explorer__rail" aria-label="文章列表">
          {filteredPosts.map((post, index) => (
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
                    <span>{String(index + 1).padStart(2, "0")}</span>
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
                  <span>读取信号</span><b aria-hidden="true">↗</b>
                </a>
              </article>
            </li>
          ))}
        </ol>
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
