export default function BrandLockup({ compact = false, hero = false, href = "#intro" }) {
  return (
    <a className={`ydld-lockup${compact ? " ydld-lockup--compact" : ""}${hero ? " ydld-lockup--hero" : ""}`} href={href} aria-label="有点来电，回到网站首页">
      <img src="/assets/brand/you-dian-lai-dian-mark-v1.png" width="1024" height="1024" alt="" />
      <span><i>有点</i><strong>来电</strong></span>
    </a>
  );
}
