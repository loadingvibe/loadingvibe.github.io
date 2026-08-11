"use client";

import Link from "next/link";
import {
  IconChevronDown,
  IconDots,
  IconFileDescription,
  IconFileImport,
  IconSearch,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";

const categoryOrder = ["全部", "生活", "学习", "工作", "收藏", "随笔"];

export default function RecordsArchive() {
  const [notes, setNotes] = useState([]);
  const [status, setStatus] = useState("loading");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [sort, setSort] = useState("updated");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    loadNotes();
  }, []);

  async function loadNotes() {
    try {
      let response = await fetch("/api/notes?scope=all&limit=100");
      if (!response.ok) response = await fetch("/api/notes?limit=100");
      if (!response.ok) throw new Error();
      const data = await response.json();
      setNotes(data.notes ?? []);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  const categories = useMemo(
    () => categoryOrder.filter((item) => item === "全部" || notes.some((note) => note.category === item)),
    [notes],
  );

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = notes.filter((note) => {
      const categoryMatches = category === "全部" || note.category === category;
      const searchable = `${note.title} ${note.summary} ${(note.tags ?? []).join(" ")}`.toLowerCase();
      return categoryMatches && (!keyword || searchable.includes(keyword));
    });
    return [...result].sort((first, second) => {
      if (sort === "oldest") return dateValue(first.createdAt) - dateValue(second.createdAt);
      if (sort === "title") return first.title.localeCompare(second.title, "zh-CN");
      return dateValue(second.updatedAt || second.createdAt) - dateValue(first.updatedAt || first.createdAt);
    });
  }, [category, notes, query, sort]);

  async function importMarkdown(file) {
    if (!file) return;
    setImporting(true);
    setNotice("正在导入…");
    try {
      const content = await file.text();
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      const title = heading || file.name.replace(/\.md$/i, "") || "导入的文档";
      const response = await fetch("/api/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title, content, category: "学习", tags: ["导入"], status: "draft" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "导入失败");
      window.location.href = `/notes/${encodeURIComponent(data.note.slug)}`;
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "导入失败");
    } finally {
      setImporting(false);
      if (menuRef.current) menuRef.current.open = false;
    }
  }

  return (
    <div className="documents-hub">
      <div className="documents-hub__topbar">
        <details className="document-create" ref={menuRef}>
          <summary>
            <span className="document-create__icon"><IconFileDescription aria-hidden="true" stroke={1.7} /></span>
            <span><strong>新建文档</strong><small>文档、导入 Markdown</small></span>
            <IconChevronDown className="document-create__chevron" aria-hidden="true" stroke={1.8} />
          </summary>
          <div className="document-create__menu">
            <Link href="/studio/new"><IconFileDescription aria-hidden="true" stroke={1.7} /><span><strong>新建文档</strong><small>支持 Markdown 与实时预览</small></span></Link>
            <label className={importing ? "is-busy" : ""}>
              <IconFileImport aria-hidden="true" stroke={1.7} />
              <span><strong>{importing ? "正在导入…" : "导入 Markdown"}</strong><small>创建为可继续编辑的草稿</small></span>
              <input type="file" accept=".md,text/markdown" disabled={importing} onChange={(event) => importMarkdown(event.target.files?.[0])} />
            </label>
          </div>
        </details>

        <label className="documents-search">
          <IconSearch aria-hidden="true" stroke={1.7} />
          <span className="sr-only">搜索文档</span>
          <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索文档…" />
        </label>
      </div>

      <div className="documents-controls">
        <div className="documents-tabs" aria-label="文档分类">
          {categories.map((item) => (
            <button type="button" key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>
              {item === "全部" ? "全部文档" : item}
            </button>
          ))}
        </div>
        <label className="documents-sort">
          <span>排序</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="updated">最近更新</option>
            <option value="oldest">最早创建</option>
            <option value="title">按标题</option>
          </select>
        </label>
      </div>

      <p className="documents-notice" role="status">{notice}</p>
      {status === "loading" && <div className="documents-state">正在读取文档…</div>}
      {status === "error" && <div className="documents-state">文档库暂时无法连接，请稍后再试。</div>}
      {status === "ready" && filtered.length === 0 && <div className="documents-state">没有找到符合条件的文档。</div>}

      <div className="documents-list" aria-label="文档列表">
        {filtered.map((note) => (
          <Link className="document-row" href={`/notes/${encodeURIComponent(note.slug)}`} key={note.id}>
            <IconFileDescription className="document-row__icon" aria-hidden="true" stroke={1.65} />
            <span className="document-row__title"><strong>{note.title}</strong>{note.status === "draft" && <i>草稿</i>}</span>
            <span className="document-row__path">Roy&nbsp; / &nbsp;{note.category}</span>
            <time dateTime={note.updatedAt || note.createdAt}>{formatDateTime(note.updatedAt || note.createdAt)}</time>
            <IconDots className="document-row__more" aria-hidden="true" stroke={1.8} />
          </Link>
        ))}
      </div>
    </div>
  );
}

function dateValue(value) {
  return new Date(`${value?.replace?.(" ", "T") ?? value}Z`).getTime() || 0;
}

function formatDateTime(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(`${value.replace(" ", "T")}Z`))
    .replace("/", "-");
}
