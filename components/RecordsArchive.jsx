"use client";

import { useEffect, useMemo, useState } from "react";
import MarkdownContent from "./MarkdownContent";

const categoryOrder = ["全部", "生活", "学习", "工作", "收藏", "随笔"];

export default function RecordsArchive() {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [tag, setTag] = useState("全部");
  const [sort, setSort] = useState("newest");
  const [expanded, setExpanded] = useState(() => new Set());
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/notes?limit=100")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => {
        const nextNotes = data.notes ?? [];
        setNotes(nextNotes);
        setStatus("ready");
        const hash = decodeURIComponent(window.location.hash.replace(/^#note-/, ""));
        if (window.location.hash.startsWith("#note-") && nextNotes.some((note) => note.slug === hash)) {
          setExpanded(new Set([hash]));
          requestAnimationFrame(() => document.getElementById(`note-${hash}`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
        }
      })
      .catch(() => setStatus("error"));
  }, []);

  const categories = useMemo(() => categoryOrder.filter((item) => item === "全部" || notes.some((note) => note.category === item)), [notes]);
  const tags = useMemo(() => ["全部", ...new Set(notes.flatMap((note) => note.tags ?? []))], [notes]);
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = notes.filter((note) => {
      const categoryMatch = category === "全部" || note.category === category;
      const tagMatch = tag === "全部" || note.tags?.includes(tag);
      const text = `${note.title} ${note.summary} ${note.content} ${(note.tags ?? []).join(" ")}`.toLowerCase();
      return categoryMatch && tagMatch && (!keyword || text.includes(keyword));
    });
    return [...result].sort((a, b) => {
      if (sort === "oldest") return dateValue(a.createdAt) - dateValue(b.createdAt);
      if (sort === "title") return a.title.localeCompare(b.title, "zh-CN");
      return dateValue(b.createdAt) - dateValue(a.createdAt);
    });
  }, [notes, query, category, tag, sort]);

  function toggle(slug) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  }

  function expandAll() {
    setExpanded(new Set(filtered.map((note) => note.slug)));
  }

  function collapseAll() {
    setExpanded(new Set());
  }

  async function copyLink(slug) {
    const url = `${window.location.origin}/#note-${encodeURIComponent(slug)}`;
    try {
      await navigator.clipboard.writeText(url);
      window.history.replaceState(null, "", `#note-${encodeURIComponent(slug)}`);
      setNotice("已复制这条记录的链接。");
    } catch {
      setNotice("无法自动复制，可以直接复制浏览器地址。");
    }
  }

  function exportMarkdown(note) {
    const frontMatter = `---\ntitle: ${note.title}\ncategory: ${note.category}\ntags: ${(note.tags ?? []).join(", ")}\ndate: ${note.createdAt}\n---\n\n`;
    const blob = new Blob([frontMatter, note.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${note.slug}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="record-archive">
      <div className="record-archive__summary">
        <div><strong>{String(notes.length).padStart(2, "0")}</strong><span>全部记录</span></div>
        <div><strong>{String(categories.length - 1).padStart(2, "0")}</strong><span>内容分类</span></div>
        <div><strong>{String(tags.length - 1).padStart(2, "0")}</strong><span>可用标签</span></div>
        <p>支持 Markdown、图片、录音、全文搜索、分类标签、折叠阅读与单篇导出。</p>
      </div>

      <div className="record-toolbar">
        <label className="record-search">
          <span aria-hidden="true">⌕</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} type="search" placeholder="搜索标题、正文、摘要或标签…" />
        </label>
        <label className="record-sort"><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">最新记录</option><option value="oldest">最早记录</option><option value="title">按标题</option></select></label>
        <button type="button" onClick={expandAll}>展开全部</button>
        <button type="button" onClick={collapseAll}>收起全部</button>
      </div>

      <div className="record-filters" aria-label="记录分类">
        <span>分类</span>
        {categories.map((item) => <button key={item} type="button" className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item}<i>{item === "全部" ? notes.length : notes.filter((note) => note.category === item).length}</i></button>)}
      </div>
      {tags.length > 1 && (
        <div className="record-filters record-filters--tags" aria-label="记录标签">
          <span>标签</span>
          {tags.map((item) => <button key={item} type="button" className={tag === item ? "is-active" : ""} onClick={() => setTag(item)}>{item === "全部" ? "全部标签" : `#${item}`}</button>)}
        </div>
      )}

      <div className="record-results-bar"><span>{status === "ready" ? `找到 ${filtered.length} 条记录` : "正在整理记录…"}</span><p role="status">{notice}</p></div>

      {status === "error" && <div className="record-empty">记录库暂时无法连接，请稍后再来。</div>}
      {status === "ready" && filtered.length === 0 && <div className="record-empty">没有找到符合当前条件的记录。</div>}

      <div className="record-list">
        {filtered.map((note, index) => {
          const isOpen = expanded.has(note.slug);
          const words = note.content.replace(/[#>*_`\[\]()!-]/g, "").replace(/\s+/g, "").length;
          return (
            <article className={`record-entry${isOpen ? " is-open" : ""}`} id={`note-${note.slug}`} key={note.id}>
              <button className="record-entry__toggle" type="button" aria-expanded={isOpen} aria-controls={`record-content-${note.id}`} onClick={() => toggle(note.slug)}>
                <span className="record-entry__number">{String(index + 1).padStart(2, "0")}</span>
                <span className="record-entry__main">
                  <span className="record-entry__meta">{note.category} · {formatDate(note.createdAt)} · 约 {Math.max(1, Math.ceil(words / 450))} 分钟</span>
                  <strong>{note.title}</strong>
                  <p>{note.summary}</p>
                  <span className="record-entry__tags">{note.tags?.map((item) => <i key={item}>#{item}</i>)}</span>
                </span>
                <span className="record-entry__action"><i aria-hidden="true">+</i><small>{isOpen ? "收起" : "展开"}</small></span>
              </button>
              <div className="record-entry__content" id={`record-content-${note.id}`} hidden={!isOpen}>
                <div className="record-entry__content-tools"><span>{words.toLocaleString("zh-CN")} 字</span><button type="button" onClick={() => copyLink(note.slug)}>复制链接</button><button type="button" onClick={() => exportMarkdown(note)}>导出 Markdown</button></div>
                <MarkdownContent content={note.content} />
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function dateValue(value) {
  return new Date(`${value?.replace?.(" ", "T") ?? value}Z`).getTime() || 0;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
