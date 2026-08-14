import Link from "next/link";
import { notFound } from "next/navigation";
import BlogShell from "../../../components/BlogShell";
import MarkdownContent from "../../../components/MarkdownContent";
import { cleanSegment, getBlogArticle } from "../../../lib/blog";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) return { title: "文章未找到" };
  return { title: article.title, description: article.summary };
}

export default async function BlogArticlePage({ params }) {
  const { slug } = await params;
  const article = getBlogArticle(slug);
  if (!article) notFound();

  return (
    <BlogShell>
      <main className="blog-reader-page">
        <nav className="blog-breadcrumb" aria-label="面包屑">
          <Link href="/blog">Blog</Link>
          {article.directories.map((segment) => <span key={segment}><i>/</i>{cleanSegment(segment)}</span>)}
        </nav>
        <article className="blog-article">
          <header>
            <p className="blog-article__path">{article.directories.join(" / ") || "ESSAY"}</p>
            <h1>{article.title}</h1>
            {article.summary && <p className="blog-article__summary">{article.summary}</p>}
            <div className="blog-article__meta">
              <time dateTime={article.date}>{article.date || "未标记日期"}</time>
              <span>{article.readingMinutes} 分钟阅读</span>
              {article.tags.map((tag) => <em key={tag}>{tag}</em>)}
            </div>
          </header>
          <MarkdownContent content={article.content} />
          <footer className="blog-article__end"><span>END</span><Link href="/blog">← 回到全部文章</Link></footer>
        </article>
      </main>
    </BlogShell>
  );
}
