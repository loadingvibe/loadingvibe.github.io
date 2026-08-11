import DocumentWorkspace from "../../../components/DocumentWorkspace";
import { isOwnerUserId } from "../../../lib/auth";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export default async function DocumentPage({ params }) {
  const { slug } = await params;
  const user = await getChatGPTUser();
  return <DocumentWorkspace slug={slug} isSignedIn={Boolean(user)} canEdit={Boolean(user && isOwnerUserId(user.userId))} />;
}
