import "./globals.css";
import { headers } from "next/headers";

const title = "忆歌手记 · 罗忆歌的个人空间";
const description = "罗忆歌的个人空间，记录生活、工作与学习，收藏值得回看的思考。";

export async function generateMetadata() {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "loading-vibe-019f7844.fedorczykmarilynn269.chatgpt.site";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  const base = `${protocol}://${host}`;
  return {
    metadataBase: new URL(base),
    title: { default: title, template: `%s · 忆歌手记` },
    description,
    icons: { icon: "/assets/brand/yige-notes-logo-v1.png" },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "zh_CN",
      images: [{ url: `${base}/og.png`, width: 1731, height: 909, alt: "忆歌手记：把生活、工作与学习，写成可回望的路。" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${base}/og.png`] },
  };
}

export const viewport = {
  themeColor: "#f4f0e8",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
