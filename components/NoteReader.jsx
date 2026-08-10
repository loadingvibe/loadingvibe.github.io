"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import MarkdownContent from "./MarkdownContent";

export default function NoteReader({ slug }) {
  const [note, setNote] = useState(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    fetch(`/api/notes/${encodeURIComponent(slug)}`)
      .then((response) => response.ok ? response.json() : Promise.reject(response.status))
      .then((data) => { setNote(data.note); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, [slug]);

  if (status === "loading") return <main className="reader-page section-shell"><div className="loading-state">正在打开这篇笔记…</div></main>;
  if (status === "error" || !note) return (
    <main className="reader-page section-shell"><div className="empty-panel"><h1>这篇笔记暂时看不到。</h1><Link className="text-link" href="/notes">返回笔记库 →</Link></div></main>
  );

  return (
    <main className="reader-page section-shell">
      <Link className="reader-page__back" href="/notes">← 返回笔记库</Link>
      <article className="reader-article">
        <header>
          <p className="overline">{note.category} · {formatDate(note.createdAt)}</p>
          <h1>{note.title}</h1>
          <p className="reader-article__summary">{note.summary}</p>
          <div className="tag-row">{note.tags?.map?.((tag) => <i key={tag}>#{tag}</i>)}</div>
        </header>
        <MarkdownContent content={note.content} />
      </article>
    </main>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
