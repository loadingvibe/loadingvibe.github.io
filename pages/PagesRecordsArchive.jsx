import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconCheckbox,
  IconChevronDown,
  IconCode,
  IconDeviceFloppy,
  IconDownload,
  IconEdit,
  IconEye,
  IconFileDescription,
  IconFileImport,
  IconHeading,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconLock,
  IconLockOpen,
  IconPhoto,
  IconPlus,
  IconQuote,
  IconSearch,
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
import { useEffect, useMemo, useRef, useState } from "react";
import MarkdownContent from "../components/MarkdownContent";
import { DEFAULT_NOTE, EMPTY_NOTE } from "./default-note";

const storageKey = "ydld-github-pages-notes-v1";
const categoryOrder = ["全部", "生活", "学习", "工作", "收藏", "随笔"];

export default function PagesRecordsArchive() {
  const [notes, setNotes] = useState([]);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("全部");
  const [sort, setSort] = useState("updated");
  const [notice, setNotice] = useState("");
  const [activeId, setActiveId] = useState("");
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({ ...EMPTY_NOTE, tags: "" });
  const menuRef = useRef(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setNotes(stored === null ? [DEFAULT_NOTE] : JSON.parse(stored));
    } catch {
      setNotes([DEFAULT_NOTE]);
      setNotice("本机记录数据读取失败，已载入初始内容。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(notes));
    } catch {
      setNotice("浏览器存储空间不足，请删除较大的附件后再保存。");
    }
  }, [notes, ready]);

  useEffect(() => {
    if (!ready) return;
    const requested = new URLSearchParams(window.location.search).get("note");
    const match = requested && notes.find((note) => note.slug === requested);
    if (match) openNote(match);
  // Only resolve the initial URL once local notes are ready.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const activeNote = notes.find((note) => note.id === activeId) ?? null;
  const categories = useMemo(
    () => categoryOrder.filter((item) => item === "全部" || notes.some((note) => note.category === item)),
    [notes],
  );
  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return notes
      .filter((note) => {
        const haystack = `${note.title} ${note.summary} ${(note.tags ?? []).join(" ")}`.toLowerCase();
        return (category === "全部" || note.category === category) && (!keyword || haystack.includes(keyword));
      })
      .sort((first, second) => {
        if (sort === "oldest") return new Date(first.createdAt) - new Date(second.createdAt);
        if (sort === "title") return first.title.localeCompare(second.title, "zh-CN");
        return new Date(second.updatedAt || second.createdAt) - new Date(first.updatedAt || first.createdAt);
      });
  }, [category, notes, query, sort]);

  function openNote(note) {
    setActiveId(note.id);
    setDraft(toDraft(note));
    setEditing(false);
    setNotice("");
    const url = new URL(window.location.href);
    url.searchParams.set("note", note.slug);
    url.hash = "notes";
    window.history.replaceState({}, "", url);
  }

  function createNote() {
    setActiveId("");
    setDraft({ ...EMPTY_NOTE, tags: "" });
    setEditing(true);
    setNotice("新文档仅保存在当前浏览器中。");
    if (menuRef.current) menuRef.current.open = false;
  }

  function closeWorkspace() {
    setActiveId("");
    setEditing(false);
    const url = new URL(window.location.href);
    url.searchParams.delete("note");
    url.hash = "notes";
    window.history.replaceState({}, "", url);
  }

  function saveDocument(nextDraft = draft) {
    const title = nextDraft.title.trim() || "无标题文档";
    const now = new Date().toISOString();
    let slug = slugify(nextDraft.slug || title);
    const sameSlug = notes.find((note) => note.slug === slug && note.id !== activeId);
    if (sameSlug) slug = `${slug}-${Date.now().toString(36)}`;
    const saved = {
      ...nextDraft,
      id: activeId || crypto.randomUUID(),
      title,
      slug,
      tags: parseTags(nextDraft.tags),
      createdAt: activeNote?.createdAt || now,
      updatedAt: now,
    };
    setNotes((current) => activeId
      ? current.map((note) => note.id === activeId ? saved : note)
      : [saved, ...current]);
    setActiveId(saved.id);
    setDraft(toDraft(saved));
    setEditing(false);
    setNotice("已保存到当前浏览器。");
    const url = new URL(window.location.href);
    url.searchParams.set("note", saved.slug);
    url.hash = "notes";
    window.history.replaceState({}, "", url);
  }

  function deleteNote(note) {
    if (!window.confirm(`确定删除《${note.title}》吗？此操作只影响当前浏览器。`)) return;
    setNotes((current) => current.filter((item) => item.id !== note.id));
    if (activeId === note.id) closeWorkspace();
    setNotice(`已从当前浏览器删除《${note.title}》。`);
  }

  async function importMarkdown(file) {
    if (!file) return;
    const content = await file.text();
    const title = content.match(/^#\s+(.+)$/m)?.[1]?.trim() || file.name.replace(/\.md$/i, "") || "导入的文档";
    setActiveId("");
    setDraft({ ...EMPTY_NOTE, title, content, tags: "导入" });
    setEditing(true);
    setNotice("Markdown 已载入，确认内容后点击保存。");
    if (menuRef.current) menuRef.current.open = false;
  }

  function toggleFavorite() {
    const next = !draft.favorite;
    const changed = { ...draft, favorite: next };
    setDraft(changed);
    if (!editing && activeNote) saveDocument(changed);
  }

  function exportMarkdown() {
    downloadText(`${slugify(draft.title || "document")}.md`, draft.content, "text/markdown;charset=utf-8");
    setNotice("Markdown 文件已导出。");
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
            <button type="button" onClick={createNote}><IconFileDescription aria-hidden="true" stroke={1.7} /><span><strong>新建文档</strong><small>Markdown 与实时预览</small></span></button>
            <label>
              <IconFileImport aria-hidden="true" stroke={1.7} />
              <span><strong>导入 Markdown</strong><small>从本机载入 .md 文件</small></span>
              <input type="file" accept=".md,text/markdown" onChange={(event) => importMarkdown(event.target.files?.[0])} />
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
          {categories.map((item) => <button type="button" key={item} className={category === item ? "is-active" : ""} onClick={() => setCategory(item)}>{item === "全部" ? "全部文档" : item}</button>)}
        </div>
        <label className="documents-sort"><span>排序</span><select value={sort} onChange={(event) => setSort(event.target.value)}><option value="updated">最近更新</option><option value="oldest">最早创建</option><option value="title">按标题</option></select></label>
      </div>

      <p className="documents-notice" role="status">{notice || "本页数据保存在当前浏览器；GitHub Pages 不会把私人草稿上传到服务器。"}</p>
      {!ready && <div className="documents-state">正在读取本机文档…</div>}
      {ready && filtered.length === 0 && <div className="documents-state">没有找到符合条件的文档。</div>}
      <div className="documents-list" aria-label="文档列表">
        {filtered.map((note) => <div className="document-row" key={note.id}>
          <button className="document-row__open pages-document-row__open" type="button" onClick={() => openNote(note)}>
            <IconFileDescription className="document-row__icon" aria-hidden="true" stroke={1.65} />
            <span className="document-row__title"><strong>{note.title}</strong>{note.status === "draft" && <i>草稿</i>}</span>
            <span className="document-row__tags">{(note.tags?.length ? note.tags : [note.category]).slice(0, 4).map((tag) => <i key={tag}>#{tag}</i>)}</span>
            <time dateTime={note.updatedAt || note.createdAt}>{formatDateTime(note.updatedAt || note.createdAt)}</time>
          </button>
          <button className="document-row__delete" type="button" aria-label={`删除文档：${note.title}`} title="删除文档" onClick={() => deleteNote(note)}><IconTrash aria-hidden="true" stroke={1.8} /></button>
        </div>)}
      </div>

      {(activeNote || editing) && <DocumentOverlay
        note={activeNote}
        draft={draft}
        setDraft={setDraft}
        editing={editing}
        setEditing={setEditing}
        notice={notice}
        setNotice={setNotice}
        onClose={closeWorkspace}
        onSave={saveDocument}
        onDelete={() => activeNote && deleteNote(activeNote)}
        onFavorite={toggleFavorite}
        onExport={exportMarkdown}
      />}
    </div>
  );
}

function DocumentOverlay({ note, draft, setDraft, editing, setEditing, notice, setNotice, onClose, onSave, onDelete, onFavorite, onExport }) {
  const textareaRef = useRef(null);
  const undoRef = useRef([]);
  const redoRef = useRef([]);

  useEffect(() => {
    const escape = (event) => { if (event.key === "Escape" && !editing) onClose(); };
    document.body.classList.add("pages-modal-open");
    window.addEventListener("keydown", escape);
    return () => {
      document.body.classList.remove("pages-modal-open");
      window.removeEventListener("keydown", escape);
    };
  }, [editing, onClose]);

  function update(field, value) { setDraft((current) => ({ ...current, [field]: value })); }
  function setContent(value, remember = true) {
    if (value === draft.content) return;
    if (remember) { undoRef.current = [...undoRef.current.slice(-79), draft.content]; redoRef.current = []; }
    update("content", value);
  }
  function insert(text) {
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? draft.content.length;
    const end = textarea?.selectionEnd ?? start;
    setContent(`${draft.content.slice(0, start)}${text}${draft.content.slice(end)}`);
    requestAnimationFrame(() => { textarea?.focus(); textarea?.setSelectionRange(start + text.length, start + text.length); });
  }
  function wrap(before, after = before, placeholder = "文字") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = draft.content.slice(start, end) || placeholder;
    setContent(`${draft.content.slice(0, start)}${before}${selected}${after}${draft.content.slice(end)}`);
    requestAnimationFrame(() => { textarea.focus(); textarea.setSelectionRange(start + before.length, start + before.length + selected.length); });
  }
  function prefix(prefixText, placeholder = "内容", numbered = false) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const lineStart = draft.content.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    const nextBreak = draft.content.indexOf("\n", end);
    const lineEnd = nextBreak === -1 ? draft.content.length : nextBreak;
    const selected = draft.content.slice(lineStart, lineEnd) || placeholder;
    const replacement = selected.split("\n").map((line, index) => `${numbered ? `${index + 1}. ` : prefixText}${line}`).join("\n");
    setContent(`${draft.content.slice(0, lineStart)}${replacement}${draft.content.slice(lineEnd)}`);
  }
  function undo() {
    const previous = undoRef.current.pop();
    if (previous === undefined) return;
    redoRef.current.push(draft.content);
    setContent(previous, false);
  }
  function redo() {
    const next = redoRef.current.pop();
    if (next === undefined) return;
    undoRef.current.push(draft.content);
    setContent(next, false);
  }
  async function insertAttachment(file) {
    if (!file) return;
    if (file.size > 900_000) { setNotice("GitHub Pages 本地模式下，附件请控制在 900 KB 以内。"); return; }
    const url = await fileToDataUrl(file);
    if (file.type.startsWith("image/")) insert(`\n\n![${file.name}](${url})\n\n`);
    else if (file.type.startsWith("audio/")) insert(`\n\n[🎧 ${file.name}](${url})\n\n`);
    else setNotice("当前仅支持图片或录音文件。");
  }
  async function importMarkdown(file) {
    if (file) setContent(await file.text());
  }

  return <div className="pages-document-overlay" role="dialog" aria-modal="true" aria-label={draft.title || "新文档"}>
    <main className="document-workspace pages-document-workspace">
      <header className="document-workspace__header">
        <div className="document-workspace__identity">
          <button className="document-workspace__back" type="button" onClick={onClose} aria-label="回到记录列表">← <span>记录</span></button>
          <span className="document-workspace__divider" />
          <strong>{draft.title || "无标题文档"}</strong>
          {editing ? <IconLockOpen className="document-workspace__lock is-open" aria-label="编辑已开启" /> : <IconLock className="document-workspace__lock" aria-label="只读" />}
        </div>
        <div className="document-workspace__actions">
          <button className={`document-action-icon${draft.favorite ? " is-favorite" : ""}`} type="button" title={draft.favorite ? "取消收藏" : "收藏"} onClick={onFavorite}>{draft.favorite ? <IconStarFilled aria-hidden="true" /> : <IconStar aria-hidden="true" stroke={1.8} />}</button>
          <button className="document-action-md" type="button" title="导出 Markdown" onClick={onExport}>MD</button>
          {!editing && <button className="is-primary" type="button" onClick={() => setEditing(true)}><IconEdit aria-hidden="true" stroke={1.8} />编辑</button>}
          {editing && <button type="button" onClick={() => note ? (setDraft(toDraft(note)), setEditing(false)) : onClose()}><IconX aria-hidden="true" stroke={1.8} />取消</button>}
          {editing && note && <button className="is-danger" type="button" onClick={onDelete}><IconTrash aria-hidden="true" stroke={1.8} />删除</button>}
          {editing && <button className="is-primary" type="button" onClick={() => onSave()}><IconDeviceFloppy aria-hidden="true" stroke={1.8} />保存</button>}
        </div>
      </header>
      <p className="document-workspace__notice" role="status">{notice || (editing ? "正在编辑；保存后写入当前浏览器。" : "只读模式；点击编辑后才能修改。")}</p>

      {editing ? <div className="document-editor-page">
        <section className="document-editor-page__editor">
          <div className="document-meta-editor">
            <input className="document-title-input" value={draft.title} onChange={(event) => update("title", event.target.value)} placeholder="无标题文档" autoFocus={!note} />
            <div className="document-meta-grid">
              <label><span>分类</span><select value={draft.category} onChange={(event) => update("category", event.target.value)}><option>生活</option><option>学习</option><option>工作</option><option>收藏</option><option>随笔</option></select></label>
              <label><span>状态</span><select value={draft.status} onChange={(event) => update("status", event.target.value)}><option value="draft">草稿</option><option value="published">公开展示</option></select></label>
              <label><span>标签</span><input value={draft.tags} onChange={(event) => update("tags", event.target.value)} placeholder="用逗号分隔" /></label>
              <label><span>链接名</span><input value={draft.slug} onChange={(event) => update("slug", event.target.value)} placeholder="留空自动生成" /></label>
            </div>
            <label className="document-summary-field"><span>摘要</span><textarea rows={2} maxLength={240} value={draft.summary} onChange={(event) => update("summary", event.target.value)} placeholder="一两句话介绍这篇文档" /></label>
          </div>

          <div className="document-editor-toolbar" aria-label="Markdown 编辑工具栏">
            <ToolbarGroup><Tool title="插入段落" onClick={() => insert("\n\n")}><IconPlus /></Tool><Tool title="撤销" onClick={undo}><IconArrowBackUp /></Tool><Tool title="重做" onClick={redo}><IconArrowForwardUp /></Tool></ToolbarGroup>
            <div className="document-toolbar-group document-toolbar-heading"><IconHeading aria-hidden="true" /><select defaultValue="" aria-label="标题级别" onChange={(event) => { if (event.target.value) prefix(`${event.target.value} `, "标题"); event.target.value = ""; }}><option value="">标题</option><option value="#">标题 1</option><option value="##">标题 2</option><option value="###">标题 3</option></select></div>
            <ToolbarGroup><Tool title="加粗" onClick={() => wrap("**", "**", "加粗文字")}><IconBold /></Tool><Tool title="斜体" onClick={() => wrap("*", "*", "斜体文字")}><IconItalic /></Tool><Tool title="删除线" onClick={() => wrap("~~", "~~", "删除线文字")}><IconStrikethrough /></Tool><Tool title="下划线" onClick={() => wrap("<u>", "</u>", "下划线文字")}><IconUnderline /></Tool><Tool title="代码" onClick={() => wrap("`", "`", "代码")}><IconCode /></Tool></ToolbarGroup>
            <ToolbarGroup><Tool title="无序列表" onClick={() => prefix("- ", "列表项")}><IconList /></Tool><Tool title="有序列表" onClick={() => prefix("", "列表项", true)}><IconListNumbers /></Tool><Tool title="任务列表" onClick={() => prefix("- [ ] ", "待办事项")}><IconCheckbox /></Tool><Tool title="引用" onClick={() => prefix("> ", "引用内容")}><IconQuote /></Tool></ToolbarGroup>
            <ToolbarGroup><Tool title="链接" onClick={() => wrap("[", "](https://)", "链接文字")}><IconLink /></Tool><Tool title="分隔线" onClick={() => insert("\n\n---\n\n")}><IconSeparator /></Tool><Tool title="表格" onClick={() => insert("\n\n| 列 1 | 列 2 |\n| --- | --- |\n| 内容 | 内容 |\n\n")}><IconTable /></Tool><Tool title="代码块" onClick={() => insert("\n\n```\n代码\n```\n\n")}><IconCode /></Tool></ToolbarGroup>
            <ToolbarGroup>
              <label title="插入图片或录音"><IconPhoto aria-hidden="true" /><span className="sr-only">插入附件</span><input type="file" accept="image/*,audio/*" onChange={(event) => insertAttachment(event.target.files?.[0])} /></label>
              <label title="导入 Markdown"><IconUpload aria-hidden="true" /><span className="sr-only">导入 Markdown</span><input type="file" accept=".md,text/markdown" onChange={(event) => importMarkdown(event.target.files?.[0])} /></label>
              <Tool title="导出 Markdown" onClick={onExport}><IconDownload /></Tool>
            </ToolbarGroup>
          </div>
          <textarea ref={textareaRef} className="document-markdown-editor" value={draft.content} onChange={(event) => setContent(event.target.value)} spellCheck="false" />
        </section>
        <aside className="document-live-preview"><p><IconEye aria-hidden="true" stroke={1.8} />实时预览</p><article><h1>{draft.title || "无标题文档"}</h1>{draft.summary && <p>{draft.summary}</p>}<MarkdownContent content={draft.content} /></article></aside>
      </div> : <article className="document-reader"><header><p>{draft.category} <span>·</span> {formatDate(draft.updatedAt || draft.createdAt)}</p><h1>{draft.title}</h1>{draft.summary && <div className="document-reader__summary">{draft.summary}</div>}<div className="document-reader__tags">{parseTags(draft.tags).map((tag) => <span key={tag}>#{tag}</span>)}</div></header><MarkdownContent content={draft.content} /></article>}
    </main>
  </div>;
}

function ToolbarGroup({ children }) { return <div className="document-toolbar-group">{children}</div>; }
function Tool({ title, onClick, children }) { return <button type="button" title={title} onClick={onClick}>{children}<span className="sr-only">{title}</span></button>; }
function toDraft(note) { return { ...note, tags: Array.isArray(note.tags) ? note.tags.join(", ") : String(note.tags || "") }; }
function parseTags(value) { return Array.isArray(value) ? value : String(value || "").split(/[,，]/).map((tag) => tag.trim().replace(/^#/, "")).filter(Boolean); }
function slugify(value) { return String(value || "document").trim().toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9\u4e00-\u9fff-]/g, "").replace(/-+/g, "-") || `document-${Date.now().toString(36)}`; }
function formatDateTime(value) { return value ? new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)).replace("/", "-") : ""; }
function formatDate(value) { return value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value)) : ""; }
function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function downloadText(filename, content, type) { const url = URL.createObjectURL(new Blob([content], { type })); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
