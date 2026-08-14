import "./globals.css";
import "katex/dist/katex.min.css";
import { headers } from "next/headers";

const title = "有点来电 · 罗忆歌的个人网站";
const description = "罗忆歌的单页个人网站，介绍自己，记录生活、工作与学习，也收下每一位访客的留言。";

export async function generateMetadata() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "loading-vibe-019f7844.fedorczykmarilynn269.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  return {
    metadataBase: new URL(base),
    title: { default: title, template: `%s · 有点来电` },
    description,
    icons: { icon: "/assets/brand/you-dian-lai-dian-mark-v1.png" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [{ url: `${base}/og-you-dian-lai-dian-v1.png`, width: 1200, height: 630, alt: "有点来电：罗忆歌的个人记录站。" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${base}/og-you-dian-lai-dian-v1.png`] },
  };
}

export const viewport = {
  themeColor: "#f7f7f4",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
