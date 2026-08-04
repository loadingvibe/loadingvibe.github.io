export const metadata = {
  title: "博客推荐 — 八个值得听完的节目",
  description:
    "博客推荐精选八档值得花时间听完的中英文深度播客，覆盖科技、商业、投资与生活。",
  icons: {
    icon: "/assets/favicon.svg",
  },
};

export const viewport = {
  themeColor: "#ffffff",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link
          rel="preload"
          href="/assets/hero/listening-archive-desktop-v1.jpg"
          as="image"
          media="(min-width: 761px)"
          fetchPriority="high"
        />
        <link
          rel="preload"
          href="/assets/hero/listening-archive-mobile-v1.jpg"
          as="image"
          media="(max-width: 760px)"
          fetchPriority="high"
        />
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body data-view-mode="editorial">
        {children}
        <script src="/script.js" defer />
      </body>
    </html>
  );
}
