import NotesExplorer from "../../components/NotesExplorer";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";

export const metadata = { title: "笔记" };

export default function NotesPage() {
  return (
    <>
      <SiteHeader active="/notes" />
      <main className="inner-page section-shell">
        <header className="inner-page__header">
          <p className="overline">DIGITAL GARDEN</p>
          <h1>笔记与记录</h1>
          <p>按生活、学习、工作与收藏组织，像一座缓慢生长的知识库。</p>
        </header>
        <NotesExplorer />
      </main>
      <SiteFooter />
    </>
  );
}
