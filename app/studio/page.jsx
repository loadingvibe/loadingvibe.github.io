import Link from "next/link";
import StudioEditor from "../../components/StudioEditor";
import { chatGPTSignOutPath, requireChatGPTUser } from "../chatgpt-auth";
import { isOwnerUserId } from "../../lib/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "写作台" };

export default async function StudioPage() {
  const user = await requireChatGPTUser("/studio");
  if (!isOwnerUserId(user.userId)) {
    return (
      <main className="studio-access">
        <img src="/assets/brand/you-dian-lai-dian-mark-v1.png" width="1024" height="1024" alt="" />
        <p className="overline">PRIVATE STUDIO</p>
        <h1>这里是作者的写作台。</h1>
        <p>当前账号 {user.email} 可以阅读网站，但不能修改内容。</p>
        <div className="button-row">
          <Link className="button button--primary" href="/">返回首页</Link>
          <a className="button button--ghost" href={chatGPTSignOutPath("/")}>切换账号</a>
        </div>
      </main>
    );
  }
  return <StudioEditor displayName={user.displayName} signOutHref={chatGPTSignOutPath("/")} />;
}
