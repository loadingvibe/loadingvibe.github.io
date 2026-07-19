export const metadata = {
  title: "Loading Vibe — 值得听完的长谈",
  description:
    "Loading Vibe 精选值得花时间听完的中英文深度播客，覆盖科技、商业、投资与生活。",
  icons: {
    icon: "/assets/favicon.svg",
  },
};

export const viewport = {
  themeColor: "#11110f",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="stylesheet" href="/styles.css" />
      </head>
      <body data-view-mode="editorial">
        {children}
        <script src="/script.js" defer />
      </body>
    </html>
  );
}
