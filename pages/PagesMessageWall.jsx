import { useEffect, useState } from "react";

const moods = [
  ["🌿", "新叶"], ["💡", "灵光"], ["🌞", "晴日"],
  ["🚂", "远方"], ["🌊", "浪潮"], ["🌙", "夜色"],
];
const emptyForm = { name: "", content: "", emoji: "🌿" };
const storageKey = "ydld-github-pages-wall-v1";

export default function PagesMessageWall() {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editForm, setEditForm] = useState(emptyForm);
  const [ready, setReady] = useState(false);
  const previewUrl = useObjectUrl(imageFile);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      setMessages(stored ? JSON.parse(stored) : []);
    } catch {
      setNotice("本机留言读取失败，请清理浏览器存储后重试。");
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      setNotice("浏览器存储空间不足，请使用更小的图片。");
    }
  }, [messages, ready]);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    if (imageFile && imageFile.size > 1_200_000) {
      setNotice("图片请控制在 1.2 MB 以内，避免超出浏览器存储空间。");
      return;
    }
    const imageUrl = imageFile ? await fileToDataUrl(imageFile) : "";
    const message = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      content: form.content.trim(),
      emoji: form.emoji,
      imageUrl,
      createdAt: new Date().toISOString(),
    };
    setMessages((current) => [message, ...current]);
    setForm(emptyForm);
    setImageFile(null);
    setFileInputKey((current) => current + 1);
    setNotice("已经挂上照片墙；这条留言保存在当前浏览器中。");
  }

  function startEditing(message) {
    setEditingId(message.id);
    setEditForm({ name: message.name, content: message.content, emoji: message.emoji });
  }

  function saveEdit(id) {
    if (!editForm.name.trim() || !editForm.content.trim()) return;
    setMessages((current) => current.map((message) => message.id === id
      ? { ...message, name: editForm.name.trim(), content: editForm.content.trim(), emoji: editForm.emoji }
      : message));
    setEditingId("");
    setNotice("留言已在当前浏览器中更新。");
  }

  function removeMessage(id) {
    if (!window.confirm("确定从留言墙上取下这张照片吗？")) return;
    setMessages((current) => current.filter((message) => message.id !== id));
    if (editingId === id) setEditingId("");
    setNotice("留言已从当前浏览器删除。");
  }

  return <div className="memory-wall">
    <form className="memory-postcard" onSubmit={submit}>
      <div className="memory-postcard__top"><span>NEW EXPOSURE</span><small>NO. {String(messages.length + 1).padStart(3, "0")}</small></div>
      <div className={`memory-postcard__frame${previewUrl ? " has-image" : ""}`}>
        {previewUrl ? <img src={previewUrl} alt="待插入图片预览" /> : <span>{form.emoji}</span>}
        <p>{previewUrl ? "YOUR MOMENT" : moods.find(([emoji]) => emoji === form.emoji)?.[1]}</p>
      </div>
      <h3>把此刻写在照片背后。</h3>
      <label><span>署名</span><input maxLength="20" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="名字或昵称" required /></label>
      <label><span>此刻的话</span><textarea maxLength="280" rows={4} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="问候、建议，或者今天想要留下的一句话…" required /></label>
      <label className="memory-postcard__upload">
        <span aria-hidden="true">＋</span><strong>{imageFile ? "更换图片" : "插入图片"}</strong><small>{imageFile ? imageFile.name : "可选 · 1.2 MB 以内"}</small>
        <input key={fileInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
      </label>
      <fieldset className="memory-postcard__moods"><legend>选一种光影</legend>{moods.map(([emoji, label]) => <button key={emoji} type="button" className={form.emoji === emoji ? "is-active" : ""} onClick={() => setForm({ ...form, emoji })}><span>{emoji}</span><small>{label}</small></button>)}</fieldset>
      <button className="memory-postcard__submit" type="submit">挂上照片墙<span aria-hidden="true">↗</span></button>
      <p className="memory-postcard__notice" role="status">{notice || "GitHub Pages 本地模式：你只能在当前浏览器看到和管理自己的留言。"}</p>
    </form>

    <div className="photo-wall" aria-live="polite">
      {messages.length === 0 && <div className="photo-wall__empty"><span>◌</span><p>墙上还没有照片。<br />你可以留下第一张。</p></div>}
      {messages.map((message, index) => {
        const isEditing = editingId === message.id;
        return <article className={`photo-message photo-message--${index % 6}`} key={message.id}>
          <span className="photo-message__clip" aria-hidden="true" />
          <div className={`photo-message__image${message.imageUrl ? " has-image" : ""}`}>
            {message.imageUrl ? <img src={message.imageUrl} alt={`来自 ${message.name} 的留言图片`} loading="lazy" /> : <span>{message.emoji}</span>}
            <i>EXPOSURE {String(messages.length - index).padStart(3, "0")}</i>
          </div>
          {isEditing ? <div className="photo-message__editor">
            <input maxLength="20" aria-label="署名" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
            <textarea maxLength="280" rows={4} aria-label="留言内容" value={editForm.content} onChange={(event) => setEditForm({ ...editForm, content: event.target.value })} />
            <div className="photo-message__edit-moods">{moods.map(([emoji, label]) => <button key={emoji} type="button" className={editForm.emoji === emoji ? "is-active" : ""} title={label} onClick={() => setEditForm({ ...editForm, emoji })}>{emoji}</button>)}</div>
            <div className="photo-message__edit-actions"><button type="button" onClick={() => setEditingId("")}>取消</button><button type="button" onClick={() => saveEdit(message.id)}>保存</button></div>
          </div> : <blockquote>{message.content}</blockquote>}
          <footer><div><strong>{message.name}</strong><time>{formatDate(message.createdAt)}</time></div><div className="photo-message__actions"><button type="button" onClick={() => startEditing(message)}>编辑</button><button type="button" onClick={() => removeMessage(message.id)}>删除</button></div></footer>
        </article>;
      })}
    </div>
  </div>;
}

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) { setUrl(""); return undefined; }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url;
}

function fileToDataUrl(file) { return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(reader.error); reader.readAsDataURL(file); }); }
function formatDate(value) { return value ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(value)) : ""; }
