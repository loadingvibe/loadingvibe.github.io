import Link from "next/link";
import LogoLockup from "./LogoLockup";

export default function SiteFooter() {
  return (
    <footer className="site-footer">
      <LogoLockup />
      <p>愿每一次记录，都让下一次出发更清晰。</p>
      <div>
        <Link href="/notes">读笔记</Link>
        <Link href="/wall">去留言</Link>
        <span>© 2026 罗忆歌</span>
      </div>
    </footer>
  );
}
