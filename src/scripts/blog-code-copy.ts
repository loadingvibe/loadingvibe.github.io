type CopyBlock = {
  pre: HTMLPreElement;
  wrapper: HTMLDivElement;
  button: HTMLButtonElement;
  label: HTMLSpanElement;
  status: HTMLSpanElement;
  resetTimer?: number;
};

let cleanUpCodeCopy: (() => void) | undefined;

/** Copy the full text while keeping the reader's focus, selection and position. */
function copyWithSelection(text: string): boolean {
  const focused = document.activeElement;
  const scroll = { x: window.scrollX, y: window.scrollY };
  const selection = window.getSelection();
  const ranges = selection
    ? Array.from({ length: selection.rangeCount }, (_, index) => selection.getRangeAt(index).cloneRange())
    : [];
  let inputSelection: { start: number; end: number; direction: "forward" | "backward" | "none" } | undefined;
  if (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement) {
    if (focused.selectionStart !== null && focused.selectionEnd !== null) {
      inputSelection = {
        start: focused.selectionStart,
        end: focused.selectionEnd,
        direction: focused.selectionDirection || "none",
      };
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0;";
  document.body.append(textarea);

  try {
    textarea.focus({ preventScroll: true });
    textarea.select();
    return typeof document.execCommand === "function" && document.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
    if (focused instanceof HTMLElement && focused.isConnected) {
      focused.focus({ preventScroll: true });
      if (inputSelection && (focused instanceof HTMLInputElement || focused instanceof HTMLTextAreaElement)) {
        focused.setSelectionRange(inputSelection.start, inputSelection.end, inputSelection.direction);
      }
    }
    if (selection) {
      selection.removeAllRanges();
      for (const range of ranges) {
        if (range.startContainer.isConnected && range.endContainer.isConnected) selection.addRange(range);
      }
    }
    window.scrollTo({ left: scroll.x, top: scroll.y, behavior: "instant" });
  }
}

function createCopyIcon(): SVGSVGElement {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(namespace, "svg");
  for (const [name, value] of Object.entries({
    width: "16", height: "16", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor",
    "stroke-width": "1.7", "stroke-linecap": "round", "stroke-linejoin": "round",
    "aria-hidden": "true", focusable: "false",
  })) svg.setAttribute(name, value);
  const path = document.createElementNS(namespace, "path");
  path.setAttribute("d", "M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1");
  svg.append(path);
  return svg;
}

/** Add controls beside pre elements, without touching highlighted code or its whitespace. */
function initializeBlogCodeCopy() {
  cleanUpCodeCopy?.();
  cleanUpCodeCopy = undefined;

  const pres = document.querySelectorAll<HTMLPreElement>(".blog-article .markdown-content pre");
  if (!pres.length) return;

  const controller = new AbortController();
  const { signal } = controller;
  const blocks: CopyBlock[] = [];

  function reset(block: CopyBlock) {
    block.label.textContent = "复制";
    block.button.setAttribute("aria-label", "复制代码");
    delete block.button.dataset.state;
    block.status.textContent = "";
    block.resetTimer = undefined;
  }

  async function copy(block: CopyBlock) {
    if (block.button.disabled || signal.aborted) return;
    if (block.resetTimer) window.clearTimeout(block.resetTimer);
    block.status.textContent = "";
    block.button.disabled = true;
    block.button.setAttribute("aria-busy", "true");
    block.button.dataset.state = "copying";
    block.label.textContent = "复制中";
    const text = (block.pre.querySelector("code") || block.pre).textContent || "";
    let copied = false;
    try {
      if (typeof navigator.clipboard?.writeText === "function") {
        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          if (!signal.aborted) copied = copyWithSelection(text);
        }
      } else {
        copied = copyWithSelection(text);
      }
    } catch {
      copied = false;
    } finally {
      // Clipboard promises can finish after Astro has swapped to another article.
      if (signal.aborted || !block.button.isConnected) return;
      block.button.disabled = false;
      block.button.removeAttribute("aria-busy");
      block.button.dataset.state = copied ? "copied" : "error";
      block.label.textContent = copied ? "已复制" : "复制失败";
      block.button.setAttribute("aria-label", copied ? "已复制代码" : "复制失败，重试复制代码");
      block.status.textContent = copied ? "代码已复制到剪贴板。" : "复制失败，请手动选中代码复制。";
      block.resetTimer = window.setTimeout(() => reset(block), 2000);
    }
  }

  for (const pre of pres) {
    if (pre.closest("[data-code-block]")) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "blog-code-block";
    wrapper.dataset.codeBlock = "";
    const button = document.createElement("button");
    button.className = "blog-code-copy";
    button.type = "button";
    button.dataset.codeCopy = "";
    button.setAttribute("aria-label", "复制代码");
    const label = document.createElement("span");
    label.dataset.codeCopyLabel = "";
    label.textContent = "复制";
    button.append(createCopyIcon(), label);
    const status = document.createElement("span");
    status.className = "blog-code-copy-status";
    status.dataset.codeCopyStatus = "";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");

    pre.before(wrapper);
    wrapper.append(pre, button, status);
    const block: CopyBlock = { pre, wrapper, button, label, status };
    blocks.push(block);
    button.addEventListener("click", () => void copy(block), { signal });
  }

  cleanUpCodeCopy = () => {
    controller.abort();
    for (const block of blocks) {
      if (block.resetTimer) window.clearTimeout(block.resetTimer);
      if (block.wrapper.isConnected) block.wrapper.replaceWith(block.pre);
    }
  };
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeBlogCodeCopy, { once: true });
} else {
  initializeBlogCodeCopy();
}
document.addEventListener("astro:page-load", initializeBlogCodeCopy);
function disposeBlogCodeCopy() {
  cleanUpCodeCopy?.();
  cleanUpCodeCopy = undefined;
}
document.addEventListener("astro:before-swap", disposeBlogCodeCopy);

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    disposeBlogCodeCopy();
    document.removeEventListener("DOMContentLoaded", initializeBlogCodeCopy);
    document.removeEventListener("astro:page-load", initializeBlogCodeCopy);
    document.removeEventListener("astro:before-swap", disposeBlogCodeCopy);
  });
}

export {};
