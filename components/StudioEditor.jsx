"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import LogoLockup from "./LogoLockup";
import MarkdownContent from "./MarkdownContent";

const blankNote = {
  title: "",
  slug: "",
  summary: "",
  category: "学习",
  tags: "",
  content: "# 新笔记\n\n从这里开始记录…",
  status: "draft",
};

export default function StudioEditor({ displayName, signOutHref }) {
  const [tab, setTab] = useState("notes");
  const [notes, setNotes] = useState([]);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState(blankNote);
  const [editingSlug, setEditingSlug] = useState(null);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const textareaRef = useRef(null);

  useEffect(() => { loadNotes(); loadMessages(); }, []);

  async function loadNotes() {
    const response = await fetch("/api/notes?scope=all&limit=100");
    if (!response.ok) return;
    const data = await response.json();
    setNotes(data.notes ?? []);
  }

  async function loadMessages() {
    const response = await fetch("/api/messages?scope=all&limit=100");
    if (!response.ok) return;
    const data = await response.json();
    setMessages(data.messages ?? []);
  }

  function selectNote(note) {
    setEditingSlug(note.slug);
    setDraft({ ...note, tags: note.tags?.join(", ") ?? "" });
    setNotice("");
  }

  function createNote() {
    setEditingSlug(null);
    setDraft({ ...blankNote });
    setNotice("");
  }

  async function saveNote() {
    setSaving(true);
    setNotice("");
    const endpoint = editingSlug ? `/api/notes/${encodeURIComponent(editingSlug)}` : "/api/notes";
    const response = await fetch(endpoint, {
      method: editingSlug ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...draft, tags: draft.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) }),
    });
    const data = await response.json().catch(() => ({}));
    setSaving(false);
    if (!response.ok) {
      setNotice(data.error ?? "保存失败");
      return;
    }
    setEditingSlug(data.note.slug);
    setDraft({ ...data.note, tags: data.note.tags.join(", ") });
    setNotice(data.note.status === "published" ? "已保存并公开发布。" : "草稿已保存。");
    loadNotes();
  }

  async function deleteNote() {
    if (!editingSlug || !window.confirm("确定删除这篇笔记吗？")) return;
    const response = await fetch(`/api/notes/${encodeURIComponent(editingSlug)}`, { method: "DELETE" });
    if (!response.ok) return setNotice("删除失败。");
    createNote();
    loadNotes();
  }

  async function uploadFile(file) {
    if (!file) return;
    setUploading(true);
    setNotice("");
    const body = new FormData();
    body.append("file", file);
    const response = await fetch("/api/uploads", { method: "POST", body });
    const data = await response.json().catch(() => ({}));
    setUploading(false);
    if (!response.ok) return setNotice(data.error ?? "上传失败");
    insertMarkdown(`\n\n${data.media.markdown}\n\n`);
    setNotice("附件已上传并插入正文。");
  }

  function insertMarkdown(text) {
    const textarea = textareaRef.current;
    if (!textarea) return setDraft((current) => ({ ...current, content: `${current.content}${text}` }));
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setDraft((current) => ({ ...current, content: `${current.content.slice(0, start)}${text}${current.content.slice(end)}` }));
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function toggleRecording() {
    if (recording) {
      recorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (event) => { if (event.data.size) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        const file = new File([blob], `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`, { type: blob.type });
        await uploadFile(file);
      };
      recorder.start();
      recorderRef.current = recorder;
      setRecording(true);
      setNotice("正在录音，再次点击即停止并上传。");
    } catch {
      setNotice("无法使用麦克风，请检查浏览器权限。");
    }
  }

  function importMarkdown(file) {
    if (!file) return;
    file.text().then((content) => {
      const firstHeading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      setDraft((current) => ({ ...current, title: firstHeading || current.title || file.name.replace(/\.md$/i, ""), content }));
      setNotice("已导入 Markdown 文件。");
    });
  }

  function exportMarkdown() {
    const blob = new Blob([draft.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${draft.slug || draft.title || "note"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function deleteMessage(id) {
    if (!window.confirm("删除这条留言吗？")) return;
    const response = await fetch(`/api/messages/${id}`, { method: "DELETE" });
    if (response.ok) setMessages((current) => current.filter((message) => message.id !== id));
  }

  return (
    <main className="studio">
      <header className="studio__header">
        <LogoLockup compact />
        <nav><button className={tab === "notes" ? "is-active" : ""} onClick={() => setTab("notes")}>写笔记</button><button className={tab === "messages" ? "is-active" : ""} onClick={() => setTab("messages")}>留言管理 <span>{messages.length}</span></button></nav>
        <div className="studio__account"><span>{displayName}</span><Link href="/home">看网站</Link><a href={signOutHref}>退出</a></div>
      </header>

      {tab === "messages" ? (
        <section className="moderation-panel">
          <header><p className="overline">MESSAGE MODERATION</p><h1>留言管理</h1></header>
          <div>{messages.map((message) => <article key={message.id}><span>{message.emoji}</span><div><strong>{message.name}</strong><p>{message.content}</p><time>{message.createdAt}</time></div><button onClick={() => deleteMessage(message.id)}>删除</button></article>)}</div>
        </section>
      ) : (
        <div className="studio__workspace">
          <aside className="studio-library">
            <button className="button button--primary" onClick={createNote}>+  新建笔记</button>
            <p>全部内容 · {notes.length}</p>
            <div>{notes.map((note) => <button key={note.id} className={editingSlug === note.slug ? "is-active" : ""} onClick={() => selectNote(note)}><small>{note.category} · {note.status === "draft" ? "草稿" : "已发布"}</small><strong>{note.title}</strong><span>{note.summary || "暂无摘要"}</span></button>)}</div>
          </aside>
          <section className="studio-editor">
            <div className="studio-editor__meta">
              <input className="studio-editor__title" value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="笔记标题" />
              <div className="field-grid">
                <label><span>链接名</span><input value={draft.slug} onChange={(event) => setDraft({ ...draft, slug: event.target.value })} placeholder="留空可自动生成" /></label>
                <label><span>分类</span><select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}><option>生活</option><option>学习</option><option>工作</option><option>收藏</option><option>随笔</option></select></label>
                <label><span>标签</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="用逗号分隔" /></label>
                <label><span>状态</span><select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}><option value="draft">草稿</option><option value="published">公开发布</option></select></label>
              </div>
              <label><span>摘要</span><textarea rows={2} maxLength="240" value={draft.summary} onChange={(event) => setDraft({ ...draft, summary: event.target.value })} placeholder="用一两句话介绍这篇笔记" /></label>
            </div>
            <div className="editor-toolbar">
              <button onClick={() => insertMarkdown("**加粗文字**")}><b>B</b></button>
              <button onClick={() => insertMarkdown("\n## 二级标题\n")}>H2</button>
              <button onClick={() => insertMarkdown("\n- 列表项\n")}>List</button>
              <label><span>{uploading ? "上传中…" : "图片 / 音频"}</span><input type="file" accept="image/*,audio/*" disabled={uploading} onChange={(event) => uploadFile(event.target.files?.[0])} /></label>
              <button className={recording ? "is-recording" : ""} onClick={toggleRecording}>{recording ? "■ 停止录音" : "● 录音"}</button>
              <label><span>导入 .md</span><input type="file" accept=".md,text/markdown" onChange={(event) => importMarkdown(event.target.files?.[0])} /></label>
              <button onClick={exportMarkdown}>导出 .md</button>
            </div>
            <textarea ref={textareaRef} className="markdown-editor" value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} spellCheck="false" />
            <footer className="studio-editor__actions">
              <span role="status">{notice}</span>
              {editingSlug && <button className="button button--danger" onClick={deleteNote}>删除</button>}
              <button className="button button--primary" disabled={saving} onClick={saveNote}>{saving ? "正在保存…" : draft.status === "published" ? "保存并发布" : "保存草稿"}</button>
            </footer>
          </section>
          <aside className="studio-preview"><p className="studio-preview__label">PREVIEW · 实时预览</p><article><h1>{draft.title || "无标题笔记"}</h1>{draft.summary && <p className="reader-article__summary">{draft.summary}</p>}<MarkdownContent content={draft.content} /></article></aside>
        </div>
      )}
    </main>
  );
}
