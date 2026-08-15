import {
  IconBook2,
  IconBrandGithub,
  IconMail,
  IconMapPin,
  IconMessageCircle,
  IconUser,
} from "@tabler/icons-react";
import { useEffect, useState } from "react";
import AccordionGallery from "../components/AccordionGallery";
import ArchiveExplorer from "../components/ArchiveExplorer";
import BrandLockup from "../components/BrandLockup";
import SideRays from "../components/SideRays";
import StrokeText from "../components/StrokeText";
import PagesComments from "./PagesComments";

const ABOUT_GALLERY_ITEMS = [
  { image: "/assets/about/optimized/mist-gorge-960.avif", label: "雾峡", alt: "云雾缭绕的峡谷与山间建筑" },
  { image: "/assets/about/optimized/cloud-meadow-960.avif", label: "云野", alt: "蓝天白云下的高山草地" },
  { image: "/assets/about/optimized/quiet-corner-960.avif", label: "静室", alt: "老建筑内安静的光影与玻璃地面" },
  { image: "/assets/about/optimized/sunset-gorge-960.avif", label: "暮色", alt: "峡谷之间被夕阳染亮的云层" },
  { image: "/assets/about/optimized/lake-birds-960.avif", label: "鸥影", alt: "湖面上飞过亭子的鸟群" },
  { image: "/assets/about/optimized/moon-peak-960.avif", label: "月峰", alt: "白日月亮悬在奇峰之上" },
];

const PRIMARY_NAV_ITEMS = [
  { key: "about", label: "关于", href: "/#about", Icon: IconUser },
  { key: "blog", label: "博客", href: "/blog/", Icon: IconBook2 },
  { key: "comments", label: "评论", href: "/#comments", Icon: IconMessageCircle },
];

/**
 * @typedef {"about" | "blog" | "comments"} PrimaryNavKey
 */

/** @param {{ activeItem: PrimaryNavKey | null, className: string, label: string }} props */
function PrimaryNavigation({ activeItem, className, label }) {
  return (
    <nav className={className} aria-label={label}>
      {PRIMARY_NAV_ITEMS.map(({ key, label: itemLabel, href, Icon }) => (
        <a
          key={key}
          href={href}
          aria-current={activeItem === key ? "location" : undefined}
        >
          <Icon aria-hidden="true" stroke={1.8} />
          <span>{itemLabel}</span>
        </a>
      ))}
    </nav>
  );
}

/**
 * @typedef {Object} ArchivePost
 * @property {string} title
 * @property {string} summary
 * @property {string} category
 * @property {string[]} tags
 * @property {string} href
 * @property {string} sourcePath
 * @property {string} routePath
 * @property {number} readingMinutes
 * @property {string | undefined} date
 * @property {string | undefined} updated
 * @property {string | undefined} cover
 * @property {boolean} featured
 */

/** @param {{ posts?: ArchivePost[] }} props */
export default function App({ posts = [] }) {
  const latestPost = posts[0];
  const [activeNav, setActiveNav] = useState(/** @type {PrimaryNavKey | null} */ (null));

  useEffect(() => {
    const sections = [
      { key: /** @type {PrimaryNavKey} */ ("about"), element: document.querySelector("#about") },
      { key: /** @type {PrimaryNavKey} */ ("blog"), element: document.querySelector("#archive") },
      { key: /** @type {PrimaryNavKey} */ ("comments"), element: document.querySelector("#comments") },
    ].filter((item) => item.element instanceof HTMLElement);
    let frame = 0;

    const updateActiveItem = () => {
      frame = 0;
      const readingLine = window.scrollY + window.innerHeight * 0.42;
      let nextItem = /** @type {PrimaryNavKey | null} */ (null);

      for (const section of sections) {
        if (section.element.offsetTop <= readingLine) nextItem = section.key;
      }

      setActiveNav((current) => (current === nextItem ? current : nextItem));
    };

    const scheduleUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(updateActiveItem);
    };

    updateActiveItem();
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", scheduleUpdate);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <header className="one-page-header">
        <BrandLockup compact />
        <PrimaryNavigation
          activeItem={activeNav}
          className="site-primary-nav site-primary-nav--desktop"
          label="主导航"
        />
      </header>

      <PrimaryNavigation
        activeItem={activeNav}
        className="mobile-tab-bar"
        label="移动端主导航"
      />

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
            saturation={1.5}
            blend={0.5}
            falloff={1.6}
          />
          <div className="opening-section__content">
            <p className="opening-section__eyebrow">THE LIVING CIRCUIT · 2026</p>
            <div className="opening-section__feature">
              <img className="opening-feature__mark" src="/assets/brand/you-dian-lai-dian-mark-v1.png" width="1024" height="1024" alt="" />
              <p className="opening-feature__name" aria-label="有点来电"><i>有点</i><strong>来电</strong></p>
              <h1 id="opening-title">
                <span className="opening-title__line opening-title__line--lead">让日常，</span>
                <span className="opening-title__line opening-title__line--accent">充满灵感！</span>
              </h1>
            </div>
            <p className="opening-section__intro">
              <span>我是 Roy，正在学习自动驾驶与嵌入式。</span>
              <span>这里保存我从代码、道路与日常里接收到的信号。</span>
            </p>
            <div className="opening-section__actions" aria-label="快速入口">
              <a href="#archive">浏览首页博客 <span aria-hidden="true">↓</span></a>
              {latestPost && <a href={latestPost.href}>最近一篇 <span aria-hidden="true">↗</span></a>}
            </div>
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
                <img src="/assets/about/optimized/roy-profile-960.avif" width="720" height="960" alt="Roy 的个人照片" />
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
                <ul><li>自动驾驶</li><li>嵌入式</li></ul>
              </section>
            </aside>

            <article className="about-profile__story">
              <p className="about-profile__eyebrow">A SHORT INTRODUCTION</p>
              <h3>About</h3>
              <p className="about-profile__statement">我是一名普通的大四学生。</p>
              <div className="about-profile__gallery">
                <AccordionGallery
                  items={ABOUT_GALLERY_ITEMS}
                  defaultIndex={5}
                  accentColor="#ffb21c"
                  overlayColor="#101612"
                  height={380}
                  gap={8}
                  radius={14}
                  expandRatio={0.54}
                  duration={0.72}
                  ease="power3.out"
                  parallax={0.65}
                  tilt={6}
                />
              </div>
            </article>
          </div>
        </section>

        <section className="archive-section" id="archive" aria-label="Roy 的博客">
          <ArchiveExplorer
            posts={posts}
            eyebrow="03 / SIGNALS · 博客"
            heading="滑动，读取我的记录"
            description="生活、工作、学习与收藏都来自同一个 Markdown 档案。你可以搜索、按分类筛选，再进入文章的完整阅读页。"
            archiveHref="/blog/"
            archiveLabel="打开博客目录"
          />
        </section>

        <section className="comments-section" id="comments" aria-labelledby="comments-title">
          <header className="comments-heading">
            <div>
              <p className="comments-heading__eyebrow">04 / ECHO · 评论</p>
              <h2 id="comments-title">回声</h2>
            </div>
            <div className="comments-heading__intro">
              <p>欢迎留下问候、建议或此刻的想法。这里是全站留言簿，也是一次信号的回流。</p>
            </div>
          </header>
          <PagesComments />
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
