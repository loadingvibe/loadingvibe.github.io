import Link from "next/link";

function Folder({ node, depth = 0 }) {
  const folders = [...node.folders.values()].sort((a, b) => a.name.localeCompare(b.name, "zh-CN"));
  return (
    <div className="blog-tree__branch" style={{ "--depth": depth }}>
      {depth > 0 && <p><span aria-hidden="true">└</span> {node.name}</p>}
      {folders.map((folder) => <Folder key={folder.path} node={folder} depth={depth + 1} />)}
      {node.articles.map((article) => (
        <Link key={article.path} href={article.href}>
          <span aria-hidden="true">—</span>{article.title}
        </Link>
      ))}
    </div>
  );
}

export default function BlogTree({ tree }) {
  return <nav className="blog-tree" aria-label="文章目录"><Folder node={tree} /></nav>;
}
