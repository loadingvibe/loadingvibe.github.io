export const metadata = {
  title: "有点来电 — 值得听的，正在来电",
  description:
    "有点来电精选八档值得花时间听完的中英文深度播客，覆盖科技、商业、投资与生活。",
  icons: {
    icon: "/assets/brand/you-dian-lai-dian-mark-v1.png",
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
