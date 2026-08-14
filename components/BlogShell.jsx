import Link from "next/link";
import BrandLockup from "./BrandLockup";

export default function BlogShell({ children }) {
  return (
    <div className="blog-site">
      <header className="blog-header">
        <BrandLockup compact href="/#intro" />
        <nav aria-label="博客导航">
          <Link href="/#about">关于</Link>
          <Link href="/#notes">记录</Link>
          <Link className="is-active" href="/blog">博客</Link>
          <Link href="/#wall">留言</Link>
        </nav>
        <Link className="blog-header__home" href="/">返回主页 <span aria-hidden="true">↗</span></Link>
      </header>
      {children}
      <footer className="blog-footer">
        <BrandLockup compact href="/#intro" />
        <p>把深思考写成慢内容。</p>
        <Link href="/blog">回到博客首页 ↑</Link>
      </footer>
    </div>
  );
}
