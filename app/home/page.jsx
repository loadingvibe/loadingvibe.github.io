import Link from "next/link";
import NotesExplorer from "../../components/NotesExplorer";
import MessageWall from "../../components/MessageWall";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";

export const metadata = { title: "关于我" };

export default function HomePage() {
  return (
    <>
      <SiteHeader active="/home" />
      <main>
        <section className="home-hero section-shell">
          <div className="home-hero__copy">
            <p className="overline">HELLO, I AM LUO YIGE</p>
            <h1>你好，我是罗忆歌。</h1>
            <p className="home-hero__intro">
              一名正在中南大学学习轨道交通信号与控制的学生。
              我关注列车运行控制、嵌入式系统与智能算法，也想保留日常里的阅读、听见和思考。
            </p>
            <div className="button-row">
              <Link className="button button--primary" href="/notes">看我的笔记</Link>
              <Link className="button button--ghost" href="/wall">在留言墙打个招呼</Link>
            </div>
          </div>
          <aside className="profile-card" aria-label="罗忆歌简介">
            <span className="profile-card__index">ABOUT / 01</span>
            <img src="/assets/brand/yige-notes-logo-v1.png" width="1254" height="1254" alt="" />
            <dl>
              <div><dt>当前</dt><dd>中南大学本科在读</dd></div>
              <div><dt>专业</dt><dd>轨道交通信号与控制</dd></div>
              <div><dt>关注</dt><dd>控制算法 · 嵌入式 · AI</dd></div>
              <div><dt>坐标</dt><dd>湖南 · 长沙</dd></div>
            </dl>
          </aside>
        </section>

        <section className="about-section section-shell" aria-labelledby="about-title">
          <div className="section-heading">
            <p className="overline">ABOUT THE AUTHOR</p>
            <h2 id="about-title">一边学习，一边把好奇心落地。</h2>
          </div>
          <div className="about-grid">
            <p className="about-grid__statement">
              我喜欢从真实问题出发，把一个系统的运行方式拆开、建模，再用代码和实验把它重新组装起来。
              这个网站是我展示自己的名片，也是一座会持续生长的个人知识库。
            </p>
            <div className="about-grid__facts">
              <article><strong>1 / 62</strong><span>专业绩点排名</span></article>
              <article><strong>2×</strong><span>连续两年国家奖学金</span></article>
              <article><strong>4+</strong><span>科研与工程项目</span></article>
            </div>
            <div className="about-grid__tracks">
              <article><span>01</span><h3>控制与交通</h3><p>列车追踪控制、模型预测控制、轨道占用检测与定位。</p></article>
              <article><span>02</span><h3>嵌入式实践</h3><p>STM32、姿态解算、卡尔曼滤波与串级 PID 闭环控制。</p></article>
              <article><span>03</span><h3>智能算法</h3><p>Python、PyTorch、计算机视觉与数据驱动的模型优化。</p></article>
            </div>
          </div>
        </section>

        <section className="notes-section section-shell" aria-labelledby="notes-title">
          <div className="section-heading section-heading--split">
            <div><p className="overline">NOTES & ARCHIVE</p><h2 id="notes-title">最近记录</h2></div>
            <Link className="text-link" href="/notes">进入全部笔记 →</Link>
          </div>
          <NotesExplorer compact />
        </section>

        <section className="wall-section section-shell" aria-labelledby="wall-title">
          <div className="section-heading section-heading--split">
            <div><p className="overline">GUESTBOOK</p><h2 id="wall-title">留言墙</h2></div>
            <Link className="text-link" href="/wall">打开完整留言墙 →</Link>
          </div>
          <MessageWall compact />
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
