import BrandLockup from "../components/BrandLockup";
import MessageWall from "../components/MessageWall";
import RecordsArchive from "../components/RecordsArchive";

const directory = [
  ["01", "开场", "这个网站是什么", "#intro"],
  ["02", "关于", "五条信息认识我", "#about"],
  ["03", "记录", "生活、工作与学习", "#notes"],
  ["04", "留言", "在照片墙上留下一刻", "#wall"],
];

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
        <a className="one-page-header__studio" href="/studio">写作台 <span aria-hidden="true">↗</span></a>
      </header>

      <main className="one-page-main">
        <section className="opening-section" id="intro" aria-labelledby="opening-title">
          <div className="opening-section__glow" aria-hidden="true" />
          <div className="opening-section__content">
            <p className="opening-section__eyebrow">WELCOME TO MY PERSONAL ARCHIVE · 2026</p>
            <BrandLockup hero />
            <h1 id="opening-title">记下所见，<br /><span>也继续向前。</span></h1>
            <p className="opening-section__intro">
              你好，这里是罗忆歌的个人网站。我在这里介绍自己，
              记录生活里的光、学习中的问题，以及工作与实践中慢慢成形的答案。
            </p>
            <a className="opening-section__start" href="#about">开始往下看 <span aria-hidden="true">↓</span></a>
          </div>
          <aside className="opening-directory" aria-label="页面目录">
            <div className="opening-directory__head"><span>DIRECTORY</span><small>SCROLL TO EXPLORE</small></div>
            {directory.map(([number, title, description, href]) => (
              <a key={number} href={href}>
                <span>{number}</span><strong>{title}</strong><p>{description}</p><i aria-hidden="true">↘</i>
              </a>
            ))}
          </aside>
          <p className="opening-section__scroll">SCROLL <i aria-hidden="true" /></p>
        </section>

        <section className="minimal-resume" id="about" aria-labelledby="about-title">
          <header className="section-intro">
            <p><span>02</span> ABOUT ME</p>
            <h2 id="about-title">五条信息，<br />简单认识我。</h2>
          </header>
          <div className="minimal-resume__name">
            <p>NAME / 姓名</p>
            <h3>罗忆歌</h3>
            <span>LUO YIGE</span>
          </div>
          <dl className="minimal-resume__facts">
            <div><dt>01 · 年龄</dt><dd>21 岁</dd><small>2005.04</small></div>
            <div><dt>02 · 学校</dt><dd>中南大学</dd><small>Central South University</small></div>
            <div><dt>03 · 所在</dt><dd>湖南·长沙</dd><small>Changsha, Hunan</small></div>
            <div><dt>04 · 籍贯</dt><dd>湖南·湘潭</dd><small>Xiangtan, Hunan</small></div>
            <div className="minimal-resume__contact"><dt>05 · 联系</dt><dd><a href="mailto:8212230801@csu.edu.cn">8212230801@csu.edu.cn</a></dd><small>EMAIL ME ↗</small></div>
          </dl>
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
