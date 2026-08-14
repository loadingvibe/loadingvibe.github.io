"use client";

import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export default function MarkdownContent({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeKatex]}
        components={{
          a({ href = "", children, ...props }) {
            const label = String(children ?? "");
            if (label.trim().startsWith("🎧")) {
              return (
                <span className="audio-embed">
                  <span>{label.replace(/^🎧\s*/, "")}</span>
                  <audio controls preload="metadata" src={href} />
                </span>
              );
            }
            const external = /^https?:\/\//.test(href);
            return <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} {...props}>{children}</a>;
          },
          img({ alt = "", ...props }) {
            return <img loading="lazy" alt={alt} {...props} />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
