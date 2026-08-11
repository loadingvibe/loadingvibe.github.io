"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft,
  IconBold,
  IconCode,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconEye,
  IconHeading,
  IconList,
  IconMicrophone,
  IconPhoto,
  IconTrash,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import LogoLockup from "./LogoLockup";
import MarkdownContent from "./MarkdownContent";

const BLANK_DOCUMENT = {
  title: "",
  slug: "",
  summary: "",
  category: "学习",
  tags: "",
  content: "# 新文档\n\n从这里开始记录…",
  status: "draft",
};

export default function DocumentWorkspace({ slug = "", canEdit = false, isNew = false }) {
  const router = useRouter();
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState({ ...BLANK_DOCUMENT });
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState("");
  const textareaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    if (isNew || !slug) return;
    setLoading(true);
    fetch(`/api/notes/${encodeURIComponent(slug)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then((data) => {
        setNote(data.note);
        setCurrentSlug(data.note.slug);
        setDraft(toDraft(data.note));
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
        setNotice("这篇文档暂时无法打开。");
      });
  }, [isNew, slug]);

  function update(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function beginEditing() {
    if (!canEdit) return;
    setDraft(toDraft(note));
    setEditing(true);
    setNotice("");
  }

  function cancelEditing() {
    if (isNew) {
      router.push("/#notes");
      return;
    }
    setDraft(toDraft(note));
    setEditing(false);
    setNotice("");
  }

  async function saveDocument() {
    setSaving(true);
    setNotice("");
    try {
      const endpoint = isNew || !currentSlug ? "/api/notes" : `/api/notes/${encodeURIComponent(currentSlug)}`;
      const response = await fetch(endpoint, {
        method: isNew || !currentSlug ? "POST" : "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...draft,
          tags: draft.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "保存失败");
      setNote(data.note);
      setCurrentSlug(data.note.slug);
      setDraft(toDraft(data.note));
      setEditing(false);
      setNotice(data.note.status === "published" ? "已保存并公开发布。" : "草稿已保存。");
      router.replace(`/notes/${encodeURIComponent(data.note.slug)}`);
      router.refresh();
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDocument() {
    if (!currentSlug || !window.confirm("确定删除这篇文档吗？此操作无法撤销。")) return;
    setNotice("正在删除…");
    const response = await fetch(`/api/notes/${encodeURIComponent(currentSlug)}`, { method: "DELETE" });
    if (!response.ok) {
      setNotice("删除失败，请稍后重试。");
      return;
    }
    router.push("/#notes");
    router.refresh();
  }

  function insertMarkdown(text) {
    const textarea = textareaRef.current;
    if (!textarea) {
      update("content", `${draft.content}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    update("content", `${draft.content.slice(0, start)}${text}${draft.content.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    });
  }

  async function uploadFile(file) {
    if (!file) return;
    setUploading(true);
    setNotice("");
    try {
      const body = new FormData();
      body.append("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "上传失败");
      insertMarkdown(`\n\n${data.media.markdown}\n\n`);
      setNotice("附件已上传并插入正文。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "上传失败");
    } finally {
      setUploading(false);
    }
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
        await uploadFile(new File([blob], `recording-${Date.now()}.webm`, { type: blob.type }));
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
      const heading = content.match(/^#\s+(.+)$/m)?.[1]?.trim();
      setDraft((current) => ({ ...current, title: heading || current.title || file.name.replace(/\.md$/i, ""), content }));
      setNotice("已导入 Markdown 文件。");
    });
  }

  function exportMarkdown() {
    const source = editing ? draft : toDraft(note);
    const blob = new Blob([source.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${source.slug || source.title || "document"}.md`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  if (loading) return <main className="document-workspace"><div className="document-workspace__state">正在打开文档…</div></main>;
  if (!isNew && !note) return (
    <main className="document-workspace"><div className="document-workspace__state"><p>{notice}</p><Link href="/#notes">返回文档列表</Link></div></main>
  );

  const shown = editing ? draft : toDraft(note);
  return (
    <main className="document-workspace">
      <header className="document-workspace__header">
        <LogoLockup href="/#notes" compact />
        <Link className="document-workspace__back" href="/#notes"><IconArrowLeft aria-hidden="true" stroke={1.8} />文档</Link>
        <div className="document-workspace__actions">
          {!editing && canEdit && <button type="button" onClick={beginEditing}><IconEdit aria-hidden="true" stroke={1.8} />编辑</button>}
          {editing && <button type="button" onClick={cancelEditing}><IconX aria-hidden="true" stroke={1.8} />取消</button>}
          {editing && currentSlug && <button className="is-danger" type="button" onClick={deleteDocument}><IconTrash aria-hidden="true" stroke={1.8} />删除</button>}
          {editing && <button className="is-primary" type="button" disabled={saving} onClick={saveDocument}><IconDeviceFloppy aria-hidden="true" stroke={1.8} />{saving ? "保存中…" : "保存"}</button>}
          {!editing && <button type="button" onClick={exportMarkdown}><IconDownload aria-hidden="true" stroke={1.8} />导出</button>}
        </div>
      </header>

      <p className="document-workspace__notice" role="status">{notice}</p>

      {editing ? (
        <div className="document-editor-page">
          <section className="document-editor-page__editor">
            <div className="document-meta-editor">
              <input className="document-title-input" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="无标题文档" autoFocus={isNew} />
              <div className="document-meta-grid">
                <label><span>分类</span><select value={draft.category} onChange={(event) => update("category", event.target.value)}><option>生活</option><option>学习</option><option>工作</option><option>收藏</option><option>随笔</option></select></label>
                <label><span>状态</span><select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="draft">草稿</option><option value="published">公开发布</option></select></label>
                <label><span>标签</span><input value={draft.tags} onChange={(event) => update("tags", event.target.value)} placeholder="用逗号分隔" /></label>
                <label><span>链接名</span><input value={draft.slug} onChange={(event) => update("slug", event.target.value)} placeholder="留空自动生成" /></label>
              </div>
              <label className="document-summary-field"><span>摘要</span><textarea rows={2} maxLength={240} value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="一两句话介绍这篇文档" /></label>
            </div>

            <div className="document-editor-toolbar">
              <button type="button" title="加粗" onClick={() => insertMarkdown("**加粗文字**")}><IconBold aria-hidden="true" stroke={1.8} /></button>
              <button type="button" title="二级标题" onClick={() => insertMarkdown("\n## 二级标题\n")}><IconHeading aria-hidden="true" stroke={1.8} /></button>
              <button type="button" title="列表" onClick={() => insertMarkdown("\n- 列表项\n")}><IconList aria-hidden="true" stroke={1.8} /></button>
              <button type="button" title="代码块" onClick={() => insertMarkdown("\n```\n代码\n```\n")}><IconCode aria-hidden="true" stroke={1.8} /></button>
              <label title="上传图片或音频"><IconPhoto aria-hidden="true" stroke={1.8} /><span>{uploading ? "上传中" : "附件"}</span><input type="file" accept="image/*,audio/*" disabled={uploading} onChange={(event) => uploadFile(event.target.files?.[0])} /></label>
              <button className={recording ? "is-recording" : ""} type="button" onClick={toggleRecording}><IconMicrophone aria-hidden="true" stroke={1.8} />{recording ? "停止" : "录音"}</button>
              <label title="导入 Markdown"><IconUpload aria-hidden="true" stroke={1.8} /><span>导入</span><input type="file" accept=".md,text/markdown" onChange={(event) => importMarkdown(event.target.files?.[0])} /></label>
              <button type="button" onClick={exportMarkdown}><IconDownload aria-hidden="true" stroke={1.8} />导出</button>
            </div>
            <textarea ref={textareaRef} className="document-markdown-editor" value={draft.content} onChange={(event) => update("content", event.target.value)} spellCheck="false" />
          </section>

          <aside className="document-live-preview">
            <p><IconEye aria-hidden="true" stroke={1.8} />实时预览</p>
            <article><h1>{draft.title || "无标题文档"}</h1>{draft.summary && <p className="reader-article__summary">{draft.summary}</p>}<MarkdownContent content={draft.content} /></article>
          </aside>
        </div>
      ) : (
        <article className="document-reader">
          <header>
            <p>{shown.category} <span>·</span> {formatDate(shown.updatedAt || shown.createdAt)}</p>
            <h1>{shown.title}</h1>
            {shown.summary && <div className="document-reader__summary">{shown.summary}</div>}
            <div className="document-reader__tags">{shown.tags.split(/[,，]/).filter(Boolean).map((tag) => <span key={tag}>#{tag.trim()}</span>)}</div>
          </header>
          <MarkdownContent content={shown.content} />
        </article>
      )}
    </main>
  );
}

function toDraft(note) {
  if (!note) return { ...BLANK_DOCUMENT };
  return { ...note, tags: Array.isArray(note.tags) ? note.tags.join(", ") : String(note.tags || "") };
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false })
    .format(new Date(`${value.replace(" ", "T")}Z`));
}
