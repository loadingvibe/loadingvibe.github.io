import { redirect } from "next/navigation";

export default async function NoteRedirect({ params }) {
  const { slug } = await params;
  redirect(`/#note-${encodeURIComponent(slug)}`);
}
