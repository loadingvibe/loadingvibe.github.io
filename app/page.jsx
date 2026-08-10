import Link from "next/link";

export default function WelcomePage() {
  return (
    <main className="welcome-page">
      <div className="welcome-page__rail" aria-hidden="true" />
      <section className="welcome-card" aria-labelledby="welcome-title">
        <p className="welcome-card__eyebrow">Welcome · 欢迎抵达</p>
        <img
          className="welcome-card__logo"
          src="/assets/brand/yige-notes-logo-v1.png"
          alt="忆歌手记初版标志"
          width="1254"
          height="1254"
        />
        <h1 id="welcome-title">忆歌手记</h1>
        <p className="welcome-card__lead">把生活、工作与学习，写成可以回望的路。</p>
        <Link className="button button--primary button--large" href="/home">
          进入我的空间 <span aria-hidden="true">→</span>
        </Link>
        <div className="welcome-card__topics" aria-label="网站内容">
          <span>生活</span><i /> <span>工作</span><i /> <span>学习</span><i /> <span>留言</span>
        </div>
      </section>
      <p className="welcome-page__footnote">A living archive by Luo Yige · 2026</p>
    </main>
  );
}
