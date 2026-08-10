import MessageWall from "../../components/MessageWall";
import SiteFooter from "../../components/SiteFooter";
import SiteHeader from "../../components/SiteHeader";

export const metadata = { title: "留言墙" };

export default function WallPage() {
  return (
    <>
      <SiteHeader active="/wall" />
      <main className="inner-page section-shell">
        <header className="inner-page__header inner-page__header--wall">
          <p className="overline">LEAVE A TRACE</p>
          <h1>留下一句话吧。</h1>
          <p>问候、想法、建议，或者你今天经过这里时的心情，都可以留在这面墙上。</p>
        </header>
        <MessageWall />
      </main>
      <SiteFooter />
    </>
  );
}
