type LightboxPhoto = { source: string; caption: string; image: HTMLImageElement };

let cleanUpLightbox: (() => void) | undefined;

/** Enhance existing photos without changing their URLs or their no-JS behavior. */
function initializeBlogLightbox() {
  cleanUpLightbox?.();
  cleanUpLightbox = undefined;

  const dialog = document.querySelector<HTMLDialogElement>("[data-blog-lightbox]");
  const viewer = dialog?.querySelector<HTMLImageElement>("[data-lightbox-image]");
  const stage = dialog?.querySelector<HTMLElement>("[data-lightbox-stage]");
  const canvas = dialog?.querySelector<HTMLElement>("[data-lightbox-canvas]");
  const download = dialog?.querySelector<HTMLAnchorElement>("[data-lightbox-download]");
  const original = dialog?.querySelector<HTMLAnchorElement>("[data-lightbox-original]");
  if (!dialog || !viewer || !stage || !download || !original || typeof dialog.showModal !== "function") return;

  const caption = dialog.querySelector<HTMLElement>("[data-lightbox-caption]");
  const count = dialog.querySelector<HTMLElement>("[data-lightbox-count]");
  const status = dialog.querySelector<HTMLElement>("[data-lightbox-status]");
  const previous = dialog.querySelector<HTMLButtonElement>("[data-lightbox-prev]");
  const next = dialog.querySelector<HTMLButtonElement>("[data-lightbox-next]");
  const zoom = dialog.querySelector<HTMLButtonElement>("[data-lightbox-zoom]");
  const controller = new AbortController();
  const { signal } = controller;
  const attributeRestorers: (() => void)[] = [];
  const objectUrls = new Map<string, number>();
  const articlePhotos: LightboxPhoto[] = [];
  const avatarPhotos: LightboxPhoto[] = [];
  const triggerPhotos = new Map<HTMLElement, LightboxPhoto[]>();
  let activePhotos: LightboxPhoto[] = [];
  let activeIndex = 0;
  let openingTrigger: HTMLElement | undefined;
  let originalBodyOverflow: string | undefined;
  let originalScrollPosition: { x: number; y: number } | undefined;
  let pendingDownload: AbortController | undefined;
  let imageVersion = 0;
  let zoomFrame = 0;
  let pointerStart: { x: number; y: number; target: EventTarget | null } | undefined;

  function imageSource(image: HTMLImageElement): string | undefined {
    try {
      const value = image.dataset.lightboxSrc || image.currentSrc || image.getAttribute("src");
      if (!value?.trim()) return undefined;
      const source = new URL(value, document.baseURI);
      if (source.protocol === "http:" || source.protocol === "https:" || source.protocol === "blob:") return source.href;
      if (source.protocol === "data:" && /^data:image\/[a-z0-9.+-]+[;,]/i.test(source.href)) return source.href;
    } catch { /* An invalid source remains a normal, unenhanced image. */ }
    return undefined;
  }

  function imageCaption(image: HTMLImageElement): string {
    const description = image.dataset.lightboxCaption?.trim()
      || image.closest("figure")?.querySelector("figcaption")?.textContent?.trim();
    if (description) return description;
    const alt = image.alt.trim();
    // Note exports often use a hash or timestamp as alt text, rather than a caption.
    const generatedName = /^(?:[a-f\d]{16,}(?:-\d+)?|image[-_]\d{10,})(?:\.(?:jpe?g|png|gif|webp))?$/i;
    return alt && !generatedName.test(alt) ? alt : "图片";
  }

  function rememberAttributes(element: HTMLElement, attributes: string[]) {
    const originals = attributes.map((name) => [name, element.getAttribute(name)] as const);
    attributeRestorers.push(() => {
      for (const [name, value] of originals) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    });
  }

  const images = document.querySelectorAll<HTMLImageElement>(
    ".blog-article .markdown-content img, .blog-article__cover img, .blog-sidebar__avatar",
  );
  for (const image of images) {
    if (image.closest('[aria-hidden="true"], [data-no-lightbox]')) continue;
    const source = imageSource(image);
    if (!source) continue;
    const group = image.matches(".blog-sidebar__avatar") ? avatarPhotos : articlePhotos;
    const description = imageCaption(image);
    const photo = { source, caption: description === "图片" ? `图片 ${group.length + 1}` : description, image };
    // Responsive copies of the same photograph belong to one gallery entry.
    if (!group.some((existing) => existing.source === source)) group.push(photo);
    const existingTrigger = image.closest<HTMLElement>('a[href], button, summary, [role="button"], [role="link"]');
    const trigger = existingTrigger || image;
    if (!triggerPhotos.has(trigger)) {
      rememberAttributes(trigger, ["data-lightbox-trigger", "role", "tabindex", "aria-label", "aria-haspopup", "title"]);
      trigger.setAttribute("data-lightbox-trigger", "");
      trigger.setAttribute("aria-haspopup", "dialog");
      if (!trigger.hasAttribute("title")) trigger.setAttribute("title", "点击放大，可下载原图");
      if (!existingTrigger) {
        trigger.setAttribute("role", "button");
        trigger.setAttribute("tabindex", "0");
        trigger.setAttribute("aria-label", `放大图片：${photo.caption}`);
      }
      triggerPhotos.set(trigger, []);
    }
    triggerPhotos.get(trigger)!.push(photo);
  }

  function say(message: string) {
    if (status) status.textContent = message;
  }

  function filename(source: string): string {
    try {
      const url = new URL(source);
      if (url.protocol === "data:" || url.protocol === "blob:") return "博客图片";
      const basename = url.pathname.split("/").pop() || "博客图片";
      let decoded = basename;
      try { decoded = decodeURIComponent(basename); } catch { /* Keep an encoded filename. */ }
      return decoded.replace(/[\u0000-\u001f\u007f/\\:*?"<>|]/g, "-").slice(0, 180) || "博客图片";
    } catch { return "博客图片"; }
  }

  function resetDownload() {
    pendingDownload?.abort();
    pendingDownload = undefined;
    download!.removeAttribute("aria-busy");
    download!.removeAttribute("aria-disabled");
  }

  function applyZoom() {
    const zoomed = dialog!.dataset.zoomed === "true";
    if (zoomed && viewer!.naturalWidth) {
      viewer!.style.width = `${viewer!.naturalWidth}px`;
      viewer!.style.height = `${viewer!.naturalHeight}px`;
    } else {
      viewer!.style.removeProperty("width");
      viewer!.style.removeProperty("height");
    }
    const label = zoomed ? "适应窗口" : "原始尺寸";
    zoom?.setAttribute("aria-label", label);
    zoom?.setAttribute("title", label);
    zoom?.setAttribute("aria-pressed", String(zoomed));
    const zoomLabel = zoom?.querySelector<HTMLElement>("span");
    if (zoomLabel) zoomLabel.textContent = label;
  }

  function toggleZoom() {
    if (dialog!.dataset.zoomed === "true") delete dialog!.dataset.zoomed;
    else dialog!.dataset.zoomed = "true";
    applyZoom();
    if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
    zoomFrame = window.requestAnimationFrame(() => {
      zoomFrame = 0;
      stage!.scrollLeft = Math.max(0, (stage!.scrollWidth - stage!.clientWidth) / 2);
      stage!.scrollTop = Math.max(0, (stage!.scrollHeight - stage!.clientHeight) / 2);
    });
  }

  function showPhoto(index: number) {
    if (!activePhotos.length) return;
    imageVersion += 1;
    resetDownload();
    activeIndex = (index + activePhotos.length) % activePhotos.length;
    const photo = activePhotos[activeIndex];
    delete dialog!.dataset.zoomed;
    viewer!.hidden = false;
    viewer!.alt = photo.caption === "图片" ? "放大的博客图片" : photo.caption;
    viewer!.src = photo.source;
    viewer!.draggable = false;
    applyZoom();
    stage!.scrollTop = 0;
    stage!.scrollLeft = 0;
    if (caption) caption.textContent = photo.caption;
    if (count) count.textContent = `${activeIndex + 1} / ${activePhotos.length}`;
    if (previous) previous.hidden = activePhotos.length < 2;
    if (next) next.hidden = activePhotos.length < 2;
    original!.href = photo.source;
    download!.href = photo.source;
    download!.download = filename(photo.source);
    say("");
  }

  function openPhoto(photo: LightboxPhoto, trigger: HTMLElement) {
    activePhotos = photo.image.matches(".blog-sidebar__avatar") ? avatarPhotos : articlePhotos;
    openingTrigger = trigger;
    showPhoto(activePhotos.findIndex((entry) => entry.source === photo.source));
    if (!dialog!.open) {
      originalScrollPosition = { x: window.scrollX, y: window.scrollY };
      originalBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      dialog!.showModal();
    }
  }

  function restorePage() {
    imageVersion += 1;
    resetDownload();
    if (originalBodyOverflow !== undefined) {
      document.body.style.overflow = originalBodyOverflow;
      originalBodyOverflow = undefined;
    }
    delete dialog!.dataset.zoomed;
    if (zoomFrame) window.cancelAnimationFrame(zoomFrame);
    zoomFrame = 0;
    openingTrigger?.isConnected && openingTrigger.focus({ preventScroll: true });
    if (originalScrollPosition) {
      window.scrollTo({ left: originalScrollPosition.x, top: originalScrollPosition.y, behavior: "instant" });
      originalScrollPosition = undefined;
    }
    openingTrigger = undefined;
    pointerStart = undefined;
  }

  for (const [trigger, photos] of triggerPhotos) {
    trigger.addEventListener("click", (event) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || event.defaultPrevented) return;
      const selected = photos.find((photo) => photo.image === event.target || photo.image.contains(event.target as Node)) || photos[0];
      event.preventDefault();
      openPhoto(selected, trigger);
    }, { signal });
    trigger.addEventListener("keydown", (event) => {
      if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      // Native links/buttons activate with Enter; unlinked images need both keys.
      const native = trigger.matches("a[href], button, summary");
      if ((event.key !== " " && (event.key !== "Enter" || native)) || (event.key === " " && trigger.matches("button, summary"))) return;
      event.preventDefault();
      openPhoto(photos[0], trigger);
    }, { signal });
  }

  dialog.addEventListener("close", restorePage, { signal });
  dialog.querySelector<HTMLButtonElement>("[data-lightbox-close]")?.addEventListener("click", () => dialog.close(), { signal });
  previous?.addEventListener("click", () => showPhoto(activeIndex - 1), { signal });
  next?.addEventListener("click", () => showPhoto(activeIndex + 1), { signal });
  zoom?.addEventListener("click", toggleZoom, { signal });
  dialog.addEventListener("keydown", (event) => {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showPhoto(activeIndex + (event.key === "ArrowLeft" ? -1 : 1));
    }
  }, { signal });
  dialog.addEventListener("pointerdown", (event) => {
    pointerStart = { x: event.clientX, y: event.clientY, target: event.target };
  }, { signal });
  dialog.addEventListener("click", (event) => {
    if (!pointerStart || Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 6 || pointerStart.target !== event.target) return;
    if (event.target === viewer) toggleZoom();
    else if (event.target === dialog || event.target === stage || event.target === canvas) dialog.close();
    pointerStart = undefined;
  }, { signal });
  viewer.addEventListener("load", applyZoom, { signal });
  viewer.addEventListener("error", () => {
    if (!dialog.open) return;
    viewer.hidden = true;
    say("图片加载失败，请点击「查看原图」尝试打开原始图片。");
  }, { signal });

  download.addEventListener("click", async (event) => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
    const photo = activePhotos[activeIndex];
    if (!photo) return;
    const source = new URL(photo.source);
    if (source.origin === location.origin || source.protocol === "blob:" || source.protocol === "data:") return;
    // Cross-origin download attributes are ignored by browsers; request a CORS-readable
    // blob only after the viewer explicitly chooses to download this photograph.
    event.preventDefault();
    if (pendingDownload) return;
    const version = imageVersion;
    const request = new AbortController();
    pendingDownload = request;
    download.setAttribute("aria-busy", "true");
    download.setAttribute("aria-disabled", "true");
    say("正在准备原图下载…");
    try {
      const response = await fetch(photo.source, { mode: "cors", credentials: "omit", signal: request.signal });
      if (!response.ok) throw new Error("Image request failed");
      const blob = await response.blob();
      if (!blob.size || (blob.type && !blob.type.startsWith("image/"))) throw new Error("Not an image response");
      if (signal.aborted || request.signal.aborted || version !== imageVersion || !dialog.open) return;
      const objectUrl = URL.createObjectURL(blob);
      const temporaryLink = document.createElement("a");
      temporaryLink.href = objectUrl;
      temporaryLink.download = filename(photo.source);
      temporaryLink.hidden = true;
      document.body.append(temporaryLink);
      temporaryLink.click();
      temporaryLink.remove();
      objectUrls.set(objectUrl, window.setTimeout(() => {
        URL.revokeObjectURL(objectUrl);
        objectUrls.delete(objectUrl);
      }, 60_000));
      say("已开始下载原图。");
    } catch {
      if (!signal.aborted && !request.signal.aborted && version === imageVersion && dialog.open) {
        say("此图片的来源暂不支持直接下载，请点击「查看原图」，再保存图片。");
      }
    } finally {
      if (pendingDownload === request) {
        pendingDownload = undefined;
        download.removeAttribute("aria-busy");
        download.removeAttribute("aria-disabled");
      }
    }
  }, { signal });

  cleanUpLightbox = () => {
    if (dialog.open) dialog.close();
    restorePage();
    controller.abort();
    for (const restore of attributeRestorers) restore();
    for (const [objectUrl, timer] of objectUrls) {
      window.clearTimeout(timer);
      URL.revokeObjectURL(objectUrl);
    }
    objectUrls.clear();
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeBlogLightbox, { once: true });
} else {
  initializeBlogLightbox();
}
document.addEventListener("astro:page-load", initializeBlogLightbox);
function disposeBlogLightbox() {
  cleanUpLightbox?.();
  cleanUpLightbox = undefined;
}
document.addEventListener("astro:before-swap", disposeBlogLightbox);

function restoreBlogLightbox(event: PageTransitionEvent) {
  if (event.persisted) initializeBlogLightbox();
}
window.addEventListener("pageshow", restoreBlogLightbox);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeBlogLightbox();
    document.removeEventListener("DOMContentLoaded", initializeBlogLightbox);
    document.removeEventListener("astro:page-load", initializeBlogLightbox);
    document.removeEventListener("astro:before-swap", disposeBlogLightbox);
    window.removeEventListener("pageshow", restoreBlogLightbox);
  });
}

export {};
