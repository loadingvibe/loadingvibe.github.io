"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const categoryOrder = ["全部", "生活", "学习", "工作", "收藏", "随笔"];

export default function NotesExplorer({ compact = false }) {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [category, setCategory] = useState("全部");
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`/api/notes?limit=${compact ? 6 : 80}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => { setNotes(data.notes ?? []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [compact]);

  const categories = useMemo(() => {
    const present = new Set(notes.map((note) => note.category));
    return categoryOrder.filter((item) => item === "全部" || present.has(item));
  }, [notes]);

  const filtered = useMemo(() => notes.filter((note) => {
    const inCategory = category === "全部" || note.category === category;
    const haystack = `${note.title} ${note.summary} ${note.tags?.join?.(" ") ?? ""}`.toLowerCase();
    return inCategory && haystack.includes(query.trim().toLowerCase());
  }), [notes, category, query]);

  return (
    <div className={`notes-explorer${compact ? " notes-explorer--compact" : ""}`}>
      <aside className="notes-explorer__sidebar" aria-label="笔记分类">
        <div className="notes-explorer__library"><span>个人知识库</span><small>{String(notes.length).padStart(2, "0")} NOTES</small></div>
        {categories.map((item) => (
          <button key={item} type="button" className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>
            <span>{item}</span><b>{item === "全部" ? notes.length : notes.filter((note) => note.category === item).length}</b>
          </button>
        ))}
      </aside>
      <div className="notes-explorer__main">
        {!compact && (
          <label className="notes-search">
            <span className="sr-only">搜索笔记</span>
            <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索标题、摘要或标签…" />
            <span aria-hidden="true">⌕</span>
          </label>
        )}
        {status === "loading" && <div className="loading-state">正在翻开笔记本…</div>}
        {status === "error" && <div className="empty-panel">笔记库暂时没有连接上，请稍后再来。</div>}
        {status === "ready" && filtered.length === 0 && <div className="empty-panel">这个分类还在等待第一篇记录。</div>}
        <div className="note-list">
          {filtered.slice(0, compact ? 4 : undefined).map((note, index) => (
            <Link className="note-row" key={note.id} href={`/notes/${note.slug}`}>
              <span className="note-row__index">{String(index + 1).padStart(2, "0")}</span>
              <span className="note-row__copy">
                <small>{note.category} · {formatDate(note.createdAt)}</small>
                <strong>{note.title}</strong>
                <p>{note.summary}</p>
                <span className="tag-row">{note.tags?.map?.((tag) => <i key={tag}>#{tag}</i>)}</span>
              </span>
              <span className="note-row__arrow" aria-hidden="true">↗</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
