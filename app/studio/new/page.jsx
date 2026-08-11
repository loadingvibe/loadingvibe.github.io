import Link from "next/link";
import DocumentWorkspace from "../../../components/DocumentWorkspace";
import { isOwnerUserId } from "../../../lib/auth";
import { chatGPTSignOutPath, requireChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "新建文档" };

export default async function NewDocumentPage() {
  const user = await requireChatGPTUser("/studio/new");
  if (!isOwnerUserId(user.userId)) {
    return (
      <main className="studio-access" data-author-candidate={user.userId}>
        <img src="/assets/brand/you-dian-lai-dian-mark-v1.png" width="1024" height="1024" alt="" />
        <p className="overline">PRIVATE STUDIO</p>
        <h1>仅站点作者可新建文档。</h1>
        <div className="button-row">
          <Link className="button button--primary" href="/#notes">返回文档</Link>
          <a className="button button--ghost" href={chatGPTSignOutPath("/")}>切换账号</a>
        </div>
      </main>
    );
  }
  return <DocumentWorkspace isNew canEdit isSignedIn />;
}
