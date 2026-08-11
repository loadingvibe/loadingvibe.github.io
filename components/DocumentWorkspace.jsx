"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconArrowLeft,
  IconBold,
  IconCheckbox,
  IconCode,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconEye,
  IconHeading,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconLock,
  IconLockOpen,
  IconMicrophone,
  IconPhoto,
  IconPlus,
  IconQuote,
  IconSeparator,
  IconStar,
  IconStarFilled,
  IconStrikethrough,
  IconTable,
  IconTrash,
  IconUnderline,
  IconUpload,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import MarkdownContent from "./MarkdownContent";

const BLANK_DOCUMENT = {
  title: "",
  slug: "",
  summary: "",
  category: "学习",
  tags: "",
  content: "# 新文档\n\n从这里开始记录…",
  status: "draft",
  favorite: false,
};

export default function DocumentWorkspace({ slug = "", canEdit = false, isSignedIn = false, isNew = false }) {
  const router = useRouter();
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState({ ...BLANK_DOCUMENT });
  const [currentSlug, setCurrentSlug] = useState(slug);
  const [loading, setLoading] = useState(!isNew);
  const [editing, setEditing] = useState(isNew);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState(false);
  const [notice, setNotice] = useState("");
  const textareaRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const undoRef = useRef([]);
  const redoRef = useRef([]);

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
        undoRef.current = [];
        redoRef.current = [];
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

  function setContent(value, remember = true) {
    if (value === draft.content) return;
    if (remember) {
      undoRef.current = [...undoRef.current.slice(-79), draft.content];
      redoRef.current = [];
    }
    update("content", value);
  }

  function beginEditing() {
    if (!canEdit) {
      if (!isSignedIn) {
        window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname)}`;
      } else {
        setNotice("仅站点作者可以编辑这篇文档。");
      }
      return;
    }
    setDraft(toDraft(note));
    undoRef.current = [];
    redoRef.current = [];
    setEditing(true);
    setNotice("");
  }

  function cancelEditing() {
    if (isNew) {
      router.push("/#notes");
      return;
    }
    setDraft(toDraft(note));
    undoRef.current = [];
    redoRef.current = [];
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
      undoRef.current = [];
      redoRef.current = [];
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

  async function toggleFavorite() {
    if (!canEdit) {
      if (!isSignedIn) {
        window.location.href = `/signin-with-chatgpt?return_to=${encodeURIComponent(window.location.pathname)}`;
      } else {
        setNotice("仅站点作者可以收藏文档。");
      }
      return;
    }
    const nextFavorite = !Boolean(editing ? draft.favorite : note?.favorite);
    if (editing || !currentSlug) {
      update("favorite", nextFavorite);
      setNotice(nextFavorite ? "已标记收藏，保存文档后生效。" : "已取消收藏，保存文档后生效。");
      return;
    }
    setSavingFavorite(true);
    setNotice("");
    try {
      const payload = toDraft(note);
      const response = await fetch(`/api/notes/${encodeURIComponent(currentSlug)}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...payload, favorite: nextFavorite }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "收藏状态保存失败");
      setNote(data.note);
      setDraft(toDraft(data.note));
      setNotice(nextFavorite ? "已收藏。" : "已取消收藏。");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "收藏状态保存失败");
    } finally {
      setSavingFavorite(false);
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
      setContent(`${draft.content}${text}`);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    setContent(`${draft.content.slice(0, start)}${text}${draft.content.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function wrapSelection(before, after = before, placeholder = "文字") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.content.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    setContent(`${draft.content.slice(0, start)}${replacement}${draft.content.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selected.length);
    });
  }

  function prefixSelection(prefix, placeholder = "内容", numbered = false) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = draft.content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = draft.content.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? draft.content.length : nextBreak;
    const selected = draft.content.slice(lineStart, lineEnd) || placeholder;
    const replacement = selected.split("\n").map((line, index) => `${numbered ? `${index + 1}. ` : prefix}${line}`).join("\n");
    setContent(`${draft.content.slice(0, lineStart)}${replacement}${draft.content.slice(lineEnd)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(lineStart, lineStart + replacement.length);
    });
  }

  function undoContent() {
    const previous = undoRef.current.pop();
    if (previous === undefined) return;
    redoRef.current.push(draft.content);
    setContent(previous, false);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function redoContent() {
    const next = redoRef.current.pop();
    if (next === undefined) return;
    undoRef.current.push(draft.content);
    setContent(next, false);
    requestAnimationFrame(() => textareaRef.current?.focus());
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
      setContent(content);
      setDraft((current) => ({ ...current, title: heading || current.title || file.name.replace(/\.md$/i, "") }));
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
  const currentTitle = (editing ? draft.title : note?.title)?.trim() || "无标题文档";
  const isFavorite = Boolean(editing ? draft.favorite : note?.favorite);
  return (
    <main className="document-workspace">
      <header className="document-workspace__header">
        <div className="document-workspace__identity">
          <strong title={currentTitle}>{currentTitle}</strong>
          {editing
            ? <IconLockOpen className="document-workspace__lock is-open" aria-label="编辑模式" stroke={1.8} />
            : <IconLock className="document-workspace__lock" aria-label="只读模式" stroke={1.8} />}
          <span className="document-workspace__divider" aria-hidden="true" />
          <Link className="document-workspace__back" href="/#notes"><IconArrowLeft aria-hidden="true" stroke={1.9} /><span>返回记录</span></Link>
        </div>
        <div className="document-workspace__actions">
          <button className={`document-action-icon${isFavorite ? " is-favorite" : ""}`} type="button" disabled={savingFavorite} aria-pressed={isFavorite} title={isFavorite ? "取消收藏" : "收藏"} onClick={toggleFavorite}>
            {isFavorite ? <IconStarFilled aria-hidden="true" /> : <IconStar aria-hidden="true" stroke={1.8} />}
            <span className="sr-only">{isFavorite ? "取消收藏" : "收藏"}</span>
          </button>
          <button className="document-action-md" type="button" title="导出为 Markdown" onClick={exportMarkdown}>MD</button>
          {!editing && <button className="is-primary" type="button" onClick={beginEditing}><IconEdit aria-hidden="true" stroke={1.8} />编辑</button>}
          {editing && <button type="button" onClick={cancelEditing}><IconX aria-hidden="true" stroke={1.8} />取消</button>}
          {editing && currentSlug && <button className="is-danger" type="button" onClick={deleteDocument}><IconTrash aria-hidden="true" stroke={1.8} />删除</button>}
          {editing && <button className="is-primary" type="button" disabled={saving} onClick={saveDocument}><IconDeviceFloppy aria-hidden="true" stroke={1.8} />{saving ? "保存中…" : "保存"}</button>}
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
              <div className="document-toolbar-group">
                <button type="button" title="插入段落" onClick={() => insertMarkdown("\n\n")}><IconPlus aria-hidden="true" stroke={1.9} /><span className="sr-only">插入段落</span></button>
                <button type="button" title="撤销" onClick={undoContent}><IconArrowBackUp aria-hidden="true" stroke={1.8} /><span className="sr-only">撤销</span></button>
                <button type="button" title="重做" onClick={redoContent}><IconArrowForwardUp aria-hidden="true" stroke={1.8} /><span className="sr-only">重做</span></button>
              </div>

              <div className="document-toolbar-group document-toolbar-heading">
                <IconHeading aria-hidden="true" stroke={1.8} />
                <select defaultValue="" aria-label="标题级别" onChange={(event) => {
                  if (event.target.value) prefixSelection(`${event.target.value} `, "标题");
                  event.target.value = "";
                }}>
                  <option value="">标题</option>
                  <option value="#">标题 1</option>
                  <option value="##">标题 2</option>
                  <option value="###">标题 3</option>
                </select>
              </div>

              <div className="document-toolbar-group">
                <button type="button" title="加粗" onClick={() => wrapSelection("**", "**", "加粗文字")}><IconBold aria-hidden="true" stroke={1.9} /><span className="sr-only">加粗</span></button>
                <button type="button" title="斜体" onClick={() => wrapSelection("*", "*", "斜体文字")}><IconItalic aria-hidden="true" stroke={1.9} /><span className="sr-only">斜体</span></button>
                <button type="button" title="删除线" onClick={() => wrapSelection("~~", "~~", "删除线文字")}><IconStrikethrough aria-hidden="true" stroke={1.9} /><span className="sr-only">删除线</span></button>
                <button type="button" title="下划线" onClick={() => wrapSelection("<u>", "</u>", "下划线文字")}><IconUnderline aria-hidden="true" stroke={1.9} /><span className="sr-only">下划线</span></button>
                <button type="button" title="行内代码" onClick={() => wrapSelection("`", "`", "代码")}><IconCode aria-hidden="true" stroke={1.9} /><span className="sr-only">行内代码</span></button>
              </div>

              <div className="document-toolbar-group">
                <button type="button" title="无序列表" onClick={() => prefixSelection("- ", "列表项")}><IconList aria-hidden="true" stroke={1.8} /><span className="sr-only">无序列表</span></button>
                <button type="button" title="有序列表" onClick={() => prefixSelection("", "列表项", true)}><IconListNumbers aria-hidden="true" stroke={1.8} /><span className="sr-only">有序列表</span></button>
                <button type="button" title="任务列表" onClick={() => prefixSelection("- [ ] ", "待办事项")}><IconCheckbox aria-hidden="true" stroke={1.8} /><span className="sr-only">任务列表</span></button>
                <button type="button" title="引用" onClick={() => prefixSelection("> ", "引用内容")}><IconQuote aria-hidden="true" stroke={1.8} /><span className="sr-only">引用</span></button>
              </div>

              <div className="document-toolbar-group">
                <button type="button" title="链接" onClick={() => wrapSelection("[", "](https://)", "链接文字")}><IconLink aria-hidden="true" stroke={1.8} /><span className="sr-only">链接</span></button>
                <button type="button" title="分隔线" onClick={() => insertMarkdown("\n\n---\n\n")}><IconSeparator aria-hidden="true" stroke={1.8} /><span className="sr-only">分隔线</span></button>
                <button type="button" title="表格" onClick={() => insertMarkdown("\n\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n\n")}><IconTable aria-hidden="true" stroke={1.8} /><span className="sr-only">表格</span></button>
                <button type="button" title="代码块" onClick={() => insertMarkdown("\n\n```\n代码\n```\n\n")}><IconCode aria-hidden="true" stroke={1.8} /><span className="sr-only">代码块</span></button>
              </div>

              <div className="document-toolbar-group">
                <label title="上传图片或音频"><IconPhoto aria-hidden="true" stroke={1.8} /><span className="sr-only">{uploading ? "上传中" : "上传附件"}</span><input type="file" accept="image/*,audio/*" disabled={uploading} onChange={(event) => uploadFile(event.target.files?.[0])} /></label>
                <button className={recording ? "is-recording" : ""} type="button" title={recording ? "停止录音" : "录音"} onClick={toggleRecording}><IconMicrophone aria-hidden="true" stroke={1.8} /><span className="sr-only">{recording ? "停止录音" : "录音"}</span></button>
                <label title="导入 Markdown"><IconUpload aria-hidden="true" stroke={1.8} /><span className="sr-only">导入 Markdown</span><input type="file" accept=".md,text/markdown" onChange={(event) => importMarkdown(event.target.files?.[0])} /></label>
                <button type="button" title="导出 Markdown" onClick={exportMarkdown}><IconDownload aria-hidden="true" stroke={1.8} /><span className="sr-only">导出 Markdown</span></button>
              </div>
            </div>
            <textarea ref={textareaRef} className="document-markdown-editor" value={draft.content} onChange={(event) => setContent(event.target.value)} spellCheck="false" />
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
