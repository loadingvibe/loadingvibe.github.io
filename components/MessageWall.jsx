"use client";

import { useEffect, useState } from "react";

const moods = [
  ["🌿", "新叶"], ["💡", "灵光"], ["🌞", "晴日"],
  ["🚂", "远方"], ["🌊", "浪潮"], ["🌙", "夜色"],
];

export default function MessageWall() {
  const [messages, setMessages] = useState([]);
  const [form, setForm] = useState({ name: "", content: "", emoji: "🌿", website: "" });
  const [state, setState] = useState("idle");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/messages?limit=80")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((data) => setMessages((data.messages ?? []).filter(Boolean)))
      .catch(() => setMessages([]));
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!form.name.trim() || !form.content.trim()) return;
    setState("sending");
    setNotice("");
    const response = await fetch("/api/messages", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      setState("idle");
      setNotice(data.error ?? "这张照片没有挂上去，请稍后再试。");
      return;
    }
    if (data.message) setMessages((current) => [data.message, ...current]);
    setForm({ name: "", content: "", emoji: "🌿", website: "" });
    setState("sent");
    setNotice("已经挂上照片墙了，谢谢你经过这里。");
  }

  return (
    <div className="memory-wall">
      <form className="memory-postcard" onSubmit={submit}>
        <div className="memory-postcard__top"><span>NEW EXPOSURE</span><small>NO. {String(messages.length + 1).padStart(3, "0")}</small></div>
        <div className="memory-postcard__frame"><span>{form.emoji}</span><p>{moods.find(([emoji]) => emoji === form.emoji)?.[1]}</p></div>
        <h3>把此刻写在照片背后。</h3>
        <label><span>署名</span><input maxLength="20" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="名字或昵称" required /></label>
        <label><span>此刻的话</span><textarea maxLength="280" rows={5} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="问候、建议，或者今天想要留下的一句话…" required /></label>
        <input className="form-trap" tabIndex="-1" autoComplete="off" value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} aria-hidden="true" />
        <fieldset className="memory-postcard__moods"><legend>选一种光影</legend>{moods.map(([emoji, label]) => <button key={emoji} type="button" className={form.emoji === emoji ? "is-active" : ""} onClick={() => setForm({ ...form, emoji })}><span>{emoji}</span><small>{label}</small></button>)}</fieldset>
        <button className="memory-postcard__submit" disabled={state === "sending"} type="submit">{state === "sending" ? "正在显影…" : "挂上照片墙"}<span aria-hidden="true">↗</span></button>
        {notice && <p className="memory-postcard__notice" role="status">{notice}</p>}
      </form>

      <div className="photo-wall" aria-live="polite">
        <div className="photo-wall__line" aria-hidden="true" />
        {messages.length === 0 && <div className="photo-wall__empty"><span>◌</span><p>墙上还没有照片。<br />你可以留下第一张。</p></div>}
        {messages.map((message, index) => (
          <article className={`photo-message photo-message--${index % 6}`} key={message.id}>
            <span className="photo-message__clip" aria-hidden="true" />
            <div className="photo-message__image"><span>{message.emoji}</span><i>EXPOSURE {String(messages.length - index).padStart(3, "0")}</i></div>
            <blockquote>{message.content}</blockquote>
            <footer><strong>{message.name}</strong><time>{formatDate(message.createdAt)}</time></footer>
          </article>
        ))}
      </div>
    </div>
  );
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(`${value.replace(" ", "T")}Z`));
}
