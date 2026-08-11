import { IconBrandGithub, IconMail, IconMapPin } from "@tabler/icons-react";
import BrandLockup from "../components/BrandLockup";
import MessageWall from "../components/MessageWall";
import RecordsArchive from "../components/RecordsArchive";
import SideRays from "../components/SideRays";
import StrokeText from "../components/StrokeText";

export default function OnePageSite() {
  return (
    <>
      <header className="one-page-header">
        <BrandLockup compact />
        <nav aria-label="本页导航">
          <a href="#about">关于</a>
          <a href="#notes">记录</a>
          <a href="#wall">留言墙</a>
        </nav>
      </header>

      <main className="one-page-main">
        <section className="opening-section" id="intro" aria-labelledby="opening-title">
          <SideRays
            className="opening-rays"
            speed={2.5}
            rayColor1="#ffb21c"
            rayColor2="#82d3ff"
            intensity={2.25}
            spread={2}
            origin="top-right"
            tilt={0}
            saturation={1.5}
            blend={0.5}
            falloff={1.6}
            opacity={1}
          />
          <div className="opening-section__content">
            <p className="opening-section__eyebrow">A LIVING ARCHIVE · 2026</p>
            <div className="opening-section__feature">
              <img className="opening-feature__mark" src="/assets/brand/you-dian-lai-dian-mark-v1.png" width="1024" height="1024" alt="" />
              <p className="opening-feature__name" aria-label="有点来电"><i>有点</i><strong>来电</strong></p>
              <h1 id="opening-title">
                <span className="opening-title__line opening-title__line--lead">让日常，</span>
                <span className="opening-title__line opening-title__line--accent">充满灵感！</span>
              </h1>
            </div>
            <p className="opening-section__intro">
              <span>欢迎观看我的网站，这里有我的生活分享、</span>
              <span>学习笔记、技巧总结，分享给你…………</span>
            </p>
          </div>
          <div className="opening-section__stroke">
            <StrokeText
              text="Show Myself to You"
              strokeColor="#ffb21c"
              fillColor="#f4f8f6"
              strokeWidth={1.8}
              drawDuration={1.5}
              fillDelay={0.12}
              loopDelay={5}
              stagger={0.03}
              trigger="loop"
              fillMode="wipe"
              fontSize={110}
              fontWeight={740}
              letterSpacing={-5}
            />
          </div>
        </section>

        <section className="minimal-resume" id="about" aria-labelledby="about-title">
          <header className="about-profile__heading">
            <h2 id="about-title">关于我<span>（-ing）</span></h2>
          </header>
          <div className="about-profile">
            <aside className="about-profile__identity" aria-label="Roy 的个人信息">
              <figure className="about-profile__portrait">
                <img src="/assets/about/roy-profile.jpg" width="1800" height="1350" alt="Roy 的个人照片" />
              </figure>
              <p className="about-profile__eyebrow">HELLO, I AM</p>
              <h3>Roy</h3>
              <nav className="about-contact" aria-label="联系方式">
                <a href="mailto:8212230801@csu.edu.cn" aria-label="发送邮件给 Roy" title="8212230801@csu.edu.cn"><IconMail aria-hidden="true" stroke={1.7} /></a>
                <a href="https://maps.google.com/?q=Changsha,Hunan" target="_blank" rel="noreferrer" aria-label="Roy 所在地：湖南长沙" title="湖南 · 长沙"><IconMapPin aria-hidden="true" stroke={1.7} /></a>
                <a href="https://github.com/loadingvibe" target="_blank" rel="noreferrer" aria-label="访问 Roy 的 GitHub" title="GitHub · loadingvibe"><IconBrandGithub aria-hidden="true" stroke={1.7} /></a>
              </nav>
              <section className="about-profile__research" aria-labelledby="research-title">
                <p id="research-title">RESEARCH INTERESTS</p>
                <ul>
                  <li>自动驾驶</li>
                  <li>嵌入式</li>
                </ul>
              </section>
            </aside>

            <article className="about-profile__story">
              <p className="about-profile__eyebrow">A SHORT INTRODUCTION</p>
              <h3>About</h3>
              <p className="about-profile__statement">我是一名普通的大四学生。</p>
            </article>
          </div>
        </section>

        <section className="records-section" id="notes" aria-labelledby="records-title">
          <header className="section-intro section-intro--light">
            <p><span>03</span> NOTES & RECORDS</p>
            <h2 id="records-title">所有记录，<br />先收起来。</h2>
            <div>
              <p>用结构化分类保存日记、学习笔记、工作复盘与收藏。需要时再通过搜索、标签与折叠条目展开细读。</p>
              <a href="/studio">进入写作台 <span aria-hidden="true">↗</span></a>
            </div>
          </header>
          <RecordsArchive />
        </section>

        <section className="memory-wall-section" id="wall" aria-labelledby="wall-title">
          <header className="section-intro">
            <p><span>04</span> MESSAGE WALL</p>
            <h2 id="wall-title">我们都是<br />短暂经过的光。</h2>
            <div><p>有些话不必长篇大论。一句问候、一个建议、一点此刻的感悟，都能在这面墙上变成一张不同的照片。</p></div>
          </header>
          <MessageWall />
        </section>
      </main>

      <footer className="one-page-footer">
        <BrandLockup compact />
        <p>记录是为了回望，也是为了再次出发。</p>
        <a href="#intro">回到顶部 ↑</a>
      </footer>
    </>
  );
}
