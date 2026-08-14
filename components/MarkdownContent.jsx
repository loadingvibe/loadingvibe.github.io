"use client";

import "katex/dist/katex.min.css";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

export default function MarkdownContent({ content }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeRaw, rehypeSlug, rehypeKatex, rehypeHighlight]}
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
            return (
              <a
                {...props}
                href={href}
                target={external ? "_blank" : props.target}
                rel={external ? "noopener noreferrer" : props.rel}
              >
                {children}
              </a>
            );
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
