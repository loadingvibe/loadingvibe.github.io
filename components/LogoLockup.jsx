import Link from "next/link";

export default function LogoLockup({ href = "/", compact = false }) {
  return (
    <Link className={`logo-lockup${compact ? " logo-lockup--compact" : ""}`} href={href}>
      <img src="/assets/brand/you-dian-lai-dian-mark-v1.png" width="1024" height="1024" alt="" />
      <span>
        <strong>有点来电</strong>
        {!compact && <small>PERSONAL ARCHIVE</small>}
      </span>
    </Link>
  );
}
