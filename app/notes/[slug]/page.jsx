import NoteReader from "../../../components/NoteReader";
import SiteFooter from "../../../components/SiteFooter";
import SiteHeader from "../../../components/SiteHeader";

export default async function NotePage({ params }) {
  const { slug } = await params;
  return (
    <>
      <SiteHeader active="/notes" />
      <NoteReader slug={slug} />
      <SiteFooter />
    </>
  );
}
