import { IconBrandGithub, IconMail, IconMapPin } from "@tabler/icons-react";
import AccordionGallery from "../components/AccordionGallery";
import BrandLockup from "../components/BrandLockup";
import GhostTitle from "../components/GhostTitle";
import SideRays from "../components/SideRays";
import StrokeText from "../components/StrokeText";
import PagesMessageWall from "./PagesMessageWall";
import PagesRecordsArchive from "./PagesRecordsArchive";

const ABOUT_GALLERY_ITEMS = [
  { image: "/assets/about/gallery/mist-gorge.jpg", label: "雾峡", alt: "云雾缭绕的峡谷与山间建筑" },
  { image: "/assets/about/gallery/cloud-meadow.jpg", label: "云野", alt: "蓝天白云下的高山草地" },
  { image: "/assets/about/gallery/quiet-corner.jpg", label: "静室", alt: "老建筑内安静的光影与玻璃地面" },
  { image: "/assets/about/gallery/sunset-gorge.jpg", label: "暮色", alt: "峡谷之间被夕阳染亮的云层" },
  { image: "/assets/about/gallery/lake-birds.jpg", label: "鸥影", alt: "湖面上飞过亭子的鸟群" },
  { image: "/assets/about/gallery/moon-peak.jpg", label: "月峰", alt: "白日月亮悬在奇峰之上" },
];

export default function App() {
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
            saturation={1.5}
            blend={0.5}
            falloff={1.6}
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

        <section className="records-section" id="notes" aria-labelledby="records-title">
          <header className="section-intro section-intro--records"><GhostTitle id="records-title" text="记录" /></header>
          <PagesRecordsArchive />
        </section>

        <section className="memory-wall-section" id="wall" aria-labelledby="wall-title">
          <header className="memory-wall-heading">
            <h2 id="wall-title">留言墙</h2>
            <div><p>一句问候、一个建议、一点此刻的感悟，都能在这里变成一张不同的照片。</p></div>
          </header>
          <PagesMessageWall />
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
