/** Enhance the server-rendered outline; native details and anchors work without JS. */
let cleanUpOutline: (() => void) | undefined;

function initializeArticleOutline() {
  cleanUpOutline?.();
  cleanUpOutline = undefined;

  const outlines = [...document.querySelectorAll<HTMLElement>("[data-article-outline]")];
  if (!outlines.length) return;

  const controller = new AbortController();
  const { signal } = controller;
  const links = outlines.flatMap((outline) => [...outline.querySelectorAll<HTMLAnchorElement>("[data-outline-link]")]);
  const branches = outlines.flatMap((outline) => [...outline.querySelectorAll<HTMLDetailsElement>("details[data-outline-branch]")]);
  const trees = outlines.flatMap((outline) => [...outline.querySelectorAll<HTMLElement>("[data-outline-tree], .article-outline__empty")]);
  const visibilityButtons = outlines.flatMap((outline) => [...outline.querySelectorAll<HTMLButtonElement>("[data-outline-visibility]")]);
  const collapseButtons = outlines.flatMap((outline) => [...outline.querySelectorAll<HTMLButtonElement>("[data-outline-collapse-all]")]);
  const linksBySlug = new Map<string, HTMLAnchorElement[]>();
  const branchesBySlug = new Map<string, HTMLDetailsElement[]>();
  let outlineHidden = false;
  let activeSlug: string | undefined;
  let animationFrame = 0;

  for (const link of links) {
    const slug = link.dataset.headingSlug;
    if (!slug) continue;
    const matchingLinks = linksBySlug.get(slug) || [];
    matchingLinks.push(link);
    linksBySlug.set(slug, matchingLinks);
  }
  for (const branch of branches) {
    const slug = branch.dataset.headingSlug;
    if (!slug) continue;
    const matchingBranches = branchesBySlug.get(slug) || [];
    matchingBranches.push(branch);
    branchesBySlug.set(slug, matchingBranches);
  }

  const headings = [...document.querySelectorAll<HTMLElement>(
    ".markdown-content :is(h1, h2, h3, h4, h5, h6)[id]",
  )].filter((heading) => linksBySlug.has(heading.id));

  function visibleAncestorLink(link: HTMLAnchorElement) {
    let visibleLink = link;
    let ancestor = link.parentElement;
    while (ancestor && !ancestor.matches("[data-article-outline]")) {
      if (ancestor instanceof HTMLDetailsElement && !ancestor.open) {
        const summary = ancestor.querySelector<HTMLElement>(":scope > summary");
        if (summary && !summary.contains(visibleLink)) {
          visibleLink = summary.querySelector<HTMLAnchorElement>("[data-outline-link]") || visibleLink;
        }
      }
      ancestor = ancestor.parentElement;
    }
    return visibleLink;
  }

  function setCurrentHeading(slug?: string, force = false) {
    if (activeSlug === slug && !force) return;
    activeSlug = slug;
    for (const link of links) {
      link.classList.remove("is-current");
      link.removeAttribute("aria-current");
    }
    for (const link of slug ? linksBySlug.get(slug) || [] : []) {
      link.classList.add("is-current");
      link.setAttribute("aria-current", "location");
      // A manually folded section remains folded while its visible parent is highlighted.
      visibleAncestorLink(link).classList.add("is-current");
    }
  }

  function updateCollapseButtons() {
    const allCollapsed = branches.length > 0 && branches.every((branch) => !branch.open);
    for (const button of collapseButtons) {
      const label = allCollapsed ? "展开全部标题" : "折叠全部标题";
      button.disabled = branches.length === 0;
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(allCollapsed));
      button.title = label;
      button.querySelector("[data-outline-collapse-icon]")?.toggleAttribute("hidden", allCollapsed);
      button.querySelector("[data-outline-expand-icon]")?.toggleAttribute("hidden", !allCollapsed);
    }
  }

  function showOutline(hidden: boolean) {
    outlineHidden = hidden;
    for (const tree of trees) tree.hidden = hidden;
    for (const outline of outlines) outline.classList.toggle("is-outline-hidden", hidden);
    for (const button of visibilityButtons) {
      const label = hidden ? "显示大纲" : "隐藏大纲";
      button.setAttribute("aria-label", label);
      button.setAttribute("aria-pressed", String(hidden));
      button.title = label;
      button.querySelector("[data-outline-eye]")?.toggleAttribute("hidden", hidden);
      button.querySelector("[data-outline-eye-off]")?.toggleAttribute("hidden", !hidden);
    }
  }

  function expandAncestors(slug: string) {
    for (const link of linksBySlug.get(slug) || []) {
      let ancestor = link.parentElement;
      while (ancestor && !ancestor.matches("[data-article-outline]")) {
        if (ancestor instanceof HTMLDetailsElement && ancestor.matches("[data-outline-branch]")) {
          // Reveal hidden ancestor sections without unfolding the heading's own children.
          const summary = ancestor.querySelector(":scope > summary");
          if (!summary?.contains(link)) ancestor.open = true;
        }
        ancestor = ancestor.parentElement;
      }
    }
    updateCollapseButtons();
  }

  function currentHashSlug() {
    try {
      return decodeURIComponent(window.location.hash.slice(1));
    } catch {
      return window.location.hash.slice(1);
    }
  }

  function updateFromScroll() {
    animationFrame = 0;
    if (!headings.length) return;
    const firstHeading = headings[0];
    const scrollOffset = Math.max(48, Number.parseFloat(getComputedStyle(firstHeading).scrollMarginTop) || 132);
    let current = firstHeading;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > scrollOffset + 1) break;
      current = heading;
    }
    setCurrentHeading(current.id);
  }

  function requestScrollUpdate() {
    if (!animationFrame) animationFrame = window.requestAnimationFrame(updateFromScroll);
  }

  function updateFromHash() {
    const slug = currentHashSlug();
    if (linksBySlug.has(slug)) {
      expandAncestors(slug);
      setCurrentHeading(slug);
    }
    requestScrollUpdate();
  }

  for (const link of links) {
    link.addEventListener("click", (event) => {
      // Keep the anchor independent from the disclosure action on summary.
      event.stopPropagation();
      if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      const slug = link.dataset.headingSlug;
      if (!slug) return;
      expandAncestors(slug);
      setCurrentHeading(slug);
      // On small screens, reveal the destination instead of leaving the outline over it.
      const mobileDisclosure = link.closest(".reader-mobile-tools > details");
      if (mobileDisclosure instanceof HTMLDetailsElement) {
        mobileDisclosure.open = false;
        mobileDisclosure.querySelector<HTMLElement>(":scope > summary")?.focus({ preventScroll: true });
      }
    }, { signal });
  }

  for (const branch of branches) {
    branch.addEventListener("toggle", () => {
      const slug = branch.dataset.headingSlug;
      if (slug) {
        for (const counterpart of branchesBySlug.get(slug) || []) {
          if (counterpart !== branch && counterpart.open !== branch.open) counterpart.open = branch.open;
        }
      }
      updateCollapseButtons();
      setCurrentHeading(activeSlug, true);
    }, { signal });
  }

  for (const button of visibilityButtons) {
    button.hidden = false;
    button.addEventListener("click", () => showOutline(!outlineHidden), { signal });
  }
  for (const button of collapseButtons) {
    button.hidden = false;
    button.addEventListener("click", () => {
      const expand = branches.every((branch) => !branch.open);
      for (const branch of branches) branch.open = expand;
      updateCollapseButtons();
      setCurrentHeading(activeSlug, true);
    }, { signal });
  }

  window.addEventListener("scroll", requestScrollUpdate, { passive: true, signal });
  window.addEventListener("resize", requestScrollUpdate, { passive: true, signal });
  window.addEventListener("hashchange", updateFromHash, { signal });
  showOutline(outlines[0].classList.contains("is-outline-hidden"));
  updateCollapseButtons();
  updateFromHash();

  cleanUpOutline = () => {
    controller.abort();
    if (animationFrame) window.cancelAnimationFrame(animationFrame);
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeArticleOutline, { once: true });
} else {
  initializeArticleOutline();
}
document.addEventListener("astro:page-load", initializeArticleOutline);
document.addEventListener("astro:before-swap", () => {
  cleanUpOutline?.();
  cleanUpOutline = undefined;
});

export {};
