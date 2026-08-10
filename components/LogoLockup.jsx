import Link from "next/link";

export default function LogoLockup({ href = "/home", compact = false }) {
  return (
    <Link className={`logo-lockup${compact ? " logo-lockup--compact" : ""}`} href={href}>
      <img src="/assets/brand/yige-notes-logo-v1.png" width="1254" height="1254" alt="" />
      <span>
        <strong>忆歌手记</strong>
        {!compact && <small>YIGE NOTES</small>}
      </span>
    </Link>
  );
}
