import { useEffect, useRef, useState } from "react";
import "@waline/client/style";

const serverURL = "https://comments.loadingvibe.com";

export default function PagesComments() {
  const containerRef = useRef(null);
  const [status, setStatus] = useState("loading");

  useEffect(() => {
    let disposed = false;
    let waline;

    async function mountWaline() {
      try {
        const { init } = await import("@waline/client");
        if (disposed || !containerRef.current) return;

        waline = init({
          el: containerRef.current,
          serverURL,
          path: "/",
          lang: "zh-CN",
          login: "enable",
          meta: ["nick", "mail", "link"],
          requiredMeta: ["nick"],
          pageSize: 10,
          wordLimit: 1000,
        });
        setStatus("ready");
      } catch {
        if (!disposed) setStatus("error");
      }
    }

    mountWaline();

    return () => {
      disposed = true;
      waline?.destroy();
    };
  }, []);

  return (
    <div className="comments-panel">
      <div className="comments-panel__label" aria-hidden="true">
        <span>OPEN CONVERSATION</span>
        <small>LOADINGVIBE.COM</small>
      </div>
      {status === "loading" && <p className="comments-panel__status" role="status">正在连接评论服务…</p>}
      {status === "error" && (
        <p className="comments-panel__status comments-panel__status--error" role="alert">
          评论区暂时无法加载，请稍后刷新页面重试。
        </p>
      )}
      <div ref={containerRef} className="comments-panel__waline" />
      <noscript><p className="comments-panel__status">请启用 JavaScript 以查看和发布评论。</p></noscript>
    </div>
  );
}
