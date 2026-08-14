import Link from "next/link";
import BlogShell from "../../components/BlogShell";
import BlogTree from "../../components/BlogTree";
import { getBlogArticles, getBlogTree } from "../../lib/blog";

export const metadata = {
  title: "博客",
  description: "罗忆歌的博客，记录学习、技术与生活中的长思考。",
};

export default function BlogIndexPage() {
  const articles = getBlogArticles();
  const tree = getBlogTree(articles);
  const folders = new Set(articles.flatMap((article) => article.directories)).size;

  return (
    <BlogShell>
      <main className="blog-index">
        <section className="blog-hero">
          <div>
            <p className="blog-kicker">WRITING / THINKING / BUILDING</p>
            <h1>博客<span>。</span></h1>
          </div>
          <div className="blog-hero__intro">
            <p>把学习过程、技术实践和生活观察，整理成可以被反复翻阅的文字。</p>
            <dl><div><dt>ARTICLES</dt><dd>{String(articles.length).padStart(2, "0")}</dd></div><div><dt>FOLDERS</dt><dd>{String(folders).padStart(2, "0")}</dd></div></dl>
          </div>
        </section>

        <div className="blog-library">
          <aside>
            <p className="blog-section-label">INDEX / 目录</p>
            <BlogTree tree={tree} />
          </aside>
          <section className="blog-list" aria-labelledby="latest-writing">
            <header><p className="blog-section-label">LATEST WRITING</p><h2 id="latest-writing">全部文章</h2></header>
            {articles.length === 0 ? (
              <div className="blog-empty"><span>01</span><h3>第一页正在等你落笔。</h3><p>在 Blog 文件夹中新建 Markdown 文件，它就会出现在这里。</p></div>
            ) : articles.map((article, index) => (
              <article className="blog-card" key={article.path}>
                <Link href={article.href} aria-label={`阅读${article.title}`} />
                <span className="blog-card__number">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <p className="blog-card__path">{article.directories.join(" / ") || "UNCATEGORIZED"}</p>
                  <h3>{article.title}</h3>
                  <p className="blog-card__summary">{article.summary}</p>
                  <div className="blog-card__tags">{article.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
                <footer><time dateTime={article.date}>{article.date || "未标记日期"}</time><span>{article.readingMinutes} MIN READ</span><b aria-hidden="true">↗</b></footer>
              </article>
            ))}
          </section>
        </div>
      </main>
    </BlogShell>
  );
}
