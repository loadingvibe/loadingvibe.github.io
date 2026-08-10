"use client";

import { useEffect, useState } from "react";

const emojiOptions = ["🌿", "💡", "🌞", "🚂", "🌊", "🌙"];

export default function MessageWall({ compact = false }) {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({ name: "", content: "", emoji: "🌿", website: "" });
  const [state, setState] = useState("idle");
  const [notice, setNotice] = useState("");

  useEffect(() => { loadMessages(); }, []);

  function loadMessages() {
    fetch(`/api/messages?limit=${compact ? 8 : 80}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setMessages(data.messages ?? []))
      .catch(() => setMessages([]));
  }

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    setState("sending");
    setNotice("");
    const response = await fetch("/api/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("idle");
      setNotice(data.error ?? "留言没有发出，请稍后重试。");
      return;
    }
    setMessages((current) => [data.message, ...current]);
    setForm({ name: "", content: "", emoji: "🌿", website: "" });
    setState("sent");
    setNotice("收到了，谢谢你留下这句话。");
  }

  return (
    <div className={`message-wall${compact ? " message-wall--compact" : ""}`}>
      <form className="message-form" onSubmit={submit}>
        <div className="message-form__heading"><span>WRITE A NOTE</span><strong>这里没有标准答案。</strong></div>
        <label><span>怎么称呼你</span><input maxLength="20" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="一个名字或昵称" required /></label>
        <label><span>想说什么</span><textarea maxLength="280" rows={compact ? 4 : 6} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="写下你的问候、想法或建议…" required /></label>
        <input className="form-trap" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} aria-hidden="true" />
        <div className="message-form__footer">
          <div className="emoji-picker" aria-label="选择留言符号">{emojiOptions.map((emoji) => <button key={emoji} type="button" className={form.emoji === emoji ? "is-active" : ""} onClick={() => setForm({ ...form, emoji })}>{emoji}</button>)}</div>
          <button className="button button--primary" disabled={state === "sending"} type="submit">{state === "sending" ? "正在送达…" : "留在墙上"}</button>
        </div>
        {notice && <p className="form-notice" role="status">{notice}</p>}
      </form>
      <div className="message-grid" aria-live="polite">
        {messages.length === 0 && <div className="empty-panel">留言墙还很安静，等你留下第一句话。</div>}
        {messages.slice(0, compact ? 5 : undefined).map((message, index) => (
          <article className={`message-card message-card--${index % 4}`} key={message.id}>
            <span className="message-card__emoji">{message.emoji}</span>
            <p>{message.content}</p>
            <footer><strong>{message.name}</strong><time>{formatDate(message.createdAt)}</time></footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
