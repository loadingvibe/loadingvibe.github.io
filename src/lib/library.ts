export const LIBRARY_VOLUMES = [
  {
    key: "about",
    navLabel: "简介",
    number: "01",
    title: "PROFILE",
    subtitle: "ABOUT ROY",
    href: "/about/",
    tone: "stone",
  },
  {
    key: "blog",
    navLabel: "博客",
    number: "02",
    title: "JOURNAL",
    subtitle: "NOTES & ESSAYS",
    href: "/blog/",
    tone: "graphite",
  },
  {
    key: "marginalia",
    navLabel: "评论",
    number: "03",
    title: "MARGINALIA",
    subtitle: "OPEN CONVERSATION",
    href: "/marginalia/",
    tone: "blue",
  },
] as const;

export type LibraryVolume = (typeof LIBRARY_VOLUMES)[number];
export type LibraryVolumeKey = LibraryVolume["key"];

export function libraryVolumeFor(key: LibraryVolumeKey | "cover") {
  return LIBRARY_VOLUMES.find((volume) => volume.key === key);
}
