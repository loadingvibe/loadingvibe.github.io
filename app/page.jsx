import source from "../index.html?raw";

const bodyMarkup =
  source
    .match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .trim() ?? "";

export default function Home() {
  return (
    <div
      dangerouslySetInnerHTML={{ __html: bodyMarkup }}
      suppressHydrationWarning
    />
  );
}
