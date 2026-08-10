import Link from "next/link";
import LogoLockup from "./LogoLockup";

const links = [
  ["/home", "关于我"],
  ["/notes", "笔记"],
  ["/wall", "留言墙"],
];

export default function SiteHeader({ active = "" }) {
  return (
    <header className="site-header">
      <LogoLockup compact />
      <nav aria-label="主导航">
        {links.map(([href, label]) => (
          <Link key={href} className={active === href ? "is-active" : ""} href={href}>
            {label}
          </Link>
        ))}
      </nav>
      <Link className="studio-link" href="/studio">
        写作台 <span aria-hidden="true">↗</span>
      </Link>
    </header>
  );
}
