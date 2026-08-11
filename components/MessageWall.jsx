"use client";

import { useEffect, useState } from "react";

const moods = [
  ["🌿", "新叶"], ["💡", "灵光"], ["🌞", "晴日"],
  ["🚂", "远方"], ["🌊", "浪潮"], ["🌙", "夜色"],
];
const emptyForm = { name: "", content: "", emoji: "🌿", website: "" };
const tokenKey = "ydld-wall-visitor-token-v2";

export default function MessageWall() {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [visitorToken, setVisitorToken] = useState("");
  const [imageFile, setImageFile] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [state, setState] = useState("idle");
  const [notice, setNotice] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [busyId, setBusyId] = useState(null);
  const previewUrl = useObjectUrl(imageFile);

  useEffect(() => {
    let token = window.localStorage.getItem(tokenKey) ?? "";
    if (token.length < 20) {
      token = crypto.randomUUID();
      window.localStorage.setItem(tokenKey, token);
    }
    setVisitorToken(token);
    fetch("/api/messages?limit=100", { headers: visitorHeaders(token) })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setMessages((data.messages ?? []).filter(Boolean)))
      .catch(() => setMessages([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!visitorToken || !form.name.trim() || !form.content.trim()) return;
    setState("sending");
    setNotice("");
    try {
      const imageUrl = imageFile ? await uploadImage(imageFile, visitorToken) : null;
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "content-type": "application/json", ...visitorHeaders(visitorToken) },
        body: JSON.stringify({ ...form, imageUrl }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error ?? "这张照片没有挂上去，请稍后再试。");
      if (data.message) setMessages((current) => [data.message, ...current]);
      setForm(emptyForm);
      setImageFile(null);
      setFileInputKey((current) => current + 1);
      setState("sent");
      setNotice("已经挂上照片墙了，谢谢你经过这里。");
    } catch (error) {
      setState("idle");
      setNotice(error.message ?? "这张照片没有挂上去，请稍后再试。");
    }
  }

  function startEditing(message) {
    setEditingId(message.id);
    setEditForm({ name: message.name, content: message.content, emoji: message.emoji, website: "" });
  }

  async function saveEdit(messageId) {
    if (!editForm.name.trim() || !editForm.content.trim()) return;
    setBusyId(messageId);
    const response = await fetch(`/api/messages/${messageId}`, {
      method: "PUT",
      headers: { "content-type": "application/json", ...visitorHeaders(visitorToken) },
      body: JSON.stringify(editForm),
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      window.alert(data.error ?? "修改没有保存，请稍后重试。");
      return;
    }
    setMessages((current) => current.map((message) => message.id === messageId ? data.message : message));
    setEditingId(null);
  }

  async function removeMessage(messageId) {
    if (!window.confirm("确定从留言墙上取下这张照片吗？")) return;
    setBusyId(messageId);
    const response = await fetch(`/api/messages/${messageId}`, {
      method: "DELETE",
      headers: visitorHeaders(visitorToken),
    });
    const data = await response.json().catch(() => ({}));
    setBusyId(null);
    if (!response.ok) {
      window.alert(data.error ?? "删除失败，请稍后重试。");
      return;
    }
    setMessages((current) => current.filter((message) => message.id !== messageId));
    if (editingId === messageId) setEditingId(null);
  }

  return (
    <div className="memory-wall">
      <form className="memory-postcard" onSubmit={submit}>
        <div className="memory-postcard__top"><span>NEW EXPOSURE</span><small>NO. {String(messages.length + 1).padStart(3, "0")}</small></div>
        <div className={`memory-postcard__frame${previewUrl ? " has-image" : ""}`}>
          {previewUrl ? <img src={previewUrl} alt="待上传图片预览" /> : <span>{form.emoji}</span>}
          <p>{previewUrl ? "YOUR MOMENT" : moods.find(([emoji]) => emoji === form.emoji)?.[1]}</p>
        </div>
        <h3>把此刻写在照片背后。</h3>
        <label><span>署名</span><input maxLength="20" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="名字或昵称" required /></label>
        <label><span>此刻的话</span><textarea maxLength="280" rows={4} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="问候、建议，或者今天想要留下的一句话…" required /></label>
        <input className="form-trap" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} aria-hidden="true" />
        <label className="memory-postcard__upload">
          <span aria-hidden="true">＋</span>
          <strong>{imageFile ? "更换图片" : "插入图片"}</strong>
          <small>{imageFile ? imageFile.name : "可选 · 5 MB 以内"}</small>
          <input key={fileInputKey} type="file" accept="image/jpeg,image/png,image/webp,image/gif,image/avif" onChange={(event) => setImageFile(event.target.files?.[0] ?? null)} />
        </label>
        <fieldset className="memory-postcard__moods"><legend>选一种光影</legend>{moods.map(([emoji, label]) => <button key={emoji} type="button" className={form.emoji === emoji ? "is-active" : ""} onClick={() => setForm({ ...form, emoji })}><span>{emoji}</span><small>{label}</small></button>)}</fieldset>
        <button className="memory-postcard__submit" disabled={state === "sending" || !visitorToken} type="submit">{state === "sending" ? "正在显影…" : "挂上照片墙"}<span aria-hidden="true">↗</span></button>
        {notice && <p className="memory-postcard__notice" role="status">{notice}</p>}
      </form>

      <div className="photo-wall" aria-live="polite">
        {messages.length === 0 && <div className="photo-wall__empty"><span>◌</span><p>墙上还没有照片。<br />你可以留下第一张。</p></div>}
        {messages.map((message, index) => {
          const isEditing = editingId === message.id;
          return (
            <article className={`photo-message photo-message--${index % 6}`} key={message.id}>
              <span className="photo-message__clip" aria-hidden="true" />
              <div className={`photo-message__image${message.imageUrl ? " has-image" : ""}`}>
                {message.imageUrl ? <img src={message.imageUrl} alt={`来自 ${message.name} 的留言图片`} loading="lazy" /> : <span>{message.emoji}</span>}
                <i>EXPOSURE {String(messages.length - index).padStart(3, "0")}</i>
              </div>
              {isEditing ? (
                <div className="photo-message__editor">
                  <input maxLength="20" aria-label="署名" value={editForm.name} onChange={(event) => setEditForm({ ...editForm, name: event.target.value })} />
                  <textarea maxLength="280" rows={4} aria-label="留言内容" value={editForm.content} onChange={(event) => setEditForm({ ...editForm, content: event.target.value })} />
                  <div className="photo-message__edit-moods">{moods.map(([emoji, label]) => <button key={emoji} type="button" className={editForm.emoji === emoji ? "is-active" : ""} title={label} onClick={() => setEditForm({ ...editForm, emoji })}>{emoji}</button>)}</div>
                  <div className="photo-message__edit-actions"><button type="button" onClick={() => setEditingId(null)}>取消</button><button type="button" disabled={busyId === message.id} onClick={() => saveEdit(message.id)}>保存</button></div>
                </div>
              ) : (
                <blockquote>{message.content}</blockquote>
              )}
              <footer>
                <div><strong>{message.name}</strong><time>{formatDate(message.createdAt)}</time></div>
                {(message.canEdit || message.canDelete) && <div className="photo-message__actions">
                  {message.canEdit && <button type="button" onClick={() => startEditing(message)}>编辑</button>}
                  {message.canDelete && <button type="button" disabled={busyId === message.id} onClick={() => removeMessage(message.id)}>删除</button>}
                </div>}
              </footer>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function visitorHeaders(token) {
  return token ? { "x-visitor-token": token } : {};
}

async function uploadImage(file, visitorToken) {
  const body = new FormData();
  body.append("file", file);
  const response = await fetch("/api/message-uploads", { method: "POST", headers: visitorHeaders(visitorToken), body });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "图片上传失败，请稍后重试。");
  return data.media?.url ?? null;
}

function useObjectUrl(file) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    if (!file) {
      setUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(file);
    setUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [file]);
  return url;
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
