(() => {
  "use strict";

  const STORAGE_KEY = "frequency-loader.markdown-draft.v1";
  const AUTOSAVE_DELAY = 320;
  const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

  const EMPTY_DRAFT = Object.freeze({
    title: "",
    body: "",
    updatedAt: "",
  });

  let elements = null;
  let autosaveTimer = 0;
  let toastTimer = 0;
  let dragDepth = 0;

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return entities[character];
    });
  }

  function inspectUrl(value) {
    return String(value)
      .replace(/&amp;/gi, "&")
      .replace(/&#0*58;|&#x0*3a;/gi, ":")
      .trim();
  }

  function sanitizeUrl(value) {
    const escapedUrl = String(value ?? "").trim();
    const inspectedUrl = inspectUrl(escapedUrl);

    if (!inspectedUrl || /[\u0000-\u001f\u007f]/.test(inspectedUrl)) {
      return null;
    }

    // Network-path references can silently change origin and are not treated as
    // local relative URLs here. Backslashes are rejected for the same reason.
    if (/^(?:\/\/|\\\\)/.test(inspectedUrl)) {
      return null;
    }

    const scheme = inspectedUrl.match(/^([a-z][a-z\d+.-]*):/i)?.[1]?.toLowerCase();
    if (scheme && !["http", "https", "mailto"].includes(scheme)) {
      return null;
    }

    if (
      scheme ||
      inspectedUrl.startsWith("#") ||
      inspectedUrl.startsWith("?") ||
      inspectedUrl.startsWith("/") ||
      inspectedUrl.startsWith("./") ||
      inspectedUrl.startsWith("../") ||
      !/^[a-z][a-z\d+.-]*:/i.test(inspectedUrl)
    ) {
      return escapedUrl;
    }

    return null;
  }

  function applyEmphasis(value) {
    return value
      .replace(/~~([^~\n]+)~~/g, "<del>$1</del>")
      .replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>")
      .replace(/__([^_\n]+)__/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>")
      .replace(/(^|[^\w])_([^_\n]+)_(?!\w)/g, "$1<em>$2</em>");
  }

  function renderInline(source) {
    let output = String(source ?? "");
    let tokenPrefix = "\uE000MD";
    while (output.includes(tokenPrefix)) {
      tokenPrefix += "X";
    }

    const tokens = [];
    const keep = (html) => {
      const index = tokens.push(html) - 1;
      return `${tokenPrefix}${index}\uE001`;
    };

    output = output.replace(/`([^`\n]+)`/g, (_match, code) => {
      let content = code;
      if (/^\s.*\s$/.test(content) && !/^\s+$/.test(content)) {
        content = content.slice(1, -1);
      }
      return keep(`<code>${content}</code>`);
    });

    output = output.replace(/!\[([^\]\n]*)\]\(([^\s)]+)\)/g, (match, alt, url) => {
      const safeUrl = sanitizeUrl(url);
      if (!safeUrl) return match;
      const plainAlt = alt.replace(/[*_~`]/g, "");
      return keep(
        `<img src="${safeUrl}" alt="${plainAlt}" loading="lazy" decoding="async">`,
      );
    });

    output = output.replace(/\[([^\]\n]+)\]\(([^\s)]+)\)/g, (match, label, url) => {
      const safeUrl = sanitizeUrl(url);
      if (!safeUrl) return match;
      const labelHtml = applyEmphasis(label);
      const isHashLink = inspectUrl(safeUrl).startsWith("#");
      const externalAttributes = isHashLink
        ? ""
        : ' target="_blank" rel="noopener noreferrer"';
      return keep(`<a href="${safeUrl}"${externalAttributes}>${labelHtml}</a>`);
    });

    output = applyEmphasis(output);
    output = output
      .replace(/ {2,}\n/g, "<br>\n")
      .replace(/\n/g, " ");

    const tokenPattern = new RegExp(`${tokenPrefix}(\\d+)\\uE001`, "g");
    return output.replace(tokenPattern, (_match, index) => tokens[Number(index)] ?? "");
  }

  function renderMarkdown(source) {
    // Escape the complete author-controlled string before interpreting any
    // Markdown token. Every HTML fragment below is therefore generated here.
    const escapedSource = escapeHtml(String(source ?? "").replace(/\r\n?/g, "\n"));
    if (!escapedSource.trim()) return "";

    const lines = escapedSource.split("\n");
    const html = [];
    let paragraph = [];
    let quote = [];
    let list = null;
    let fence = null;

    const flushParagraph = () => {
      if (!paragraph.length) return;
      html.push(`<p>${renderInline(paragraph.join("\n"))}</p>`);
      paragraph = [];
    };

    const flushQuote = () => {
      if (!quote.length) return;
      const groups = [];
      let current = [];
      quote.forEach((line) => {
        if (!line.trim()) {
          if (current.length) groups.push(current.join("\n"));
          current = [];
          return;
        }
        current.push(line);
      });
      if (current.length) groups.push(current.join("\n"));
      const contents = groups.length
        ? groups.map((group) => `<p>${renderInline(group)}</p>`).join("")
        : "";
      html.push(`<blockquote>${contents}</blockquote>`);
      quote = [];
    };

    const flushList = () => {
      if (!list) return;
      const isTaskList = list.items.some((item) => item.task);
      const className = isTaskList ? ' class="task-list"' : "";
      const start = list.type === "ol" && list.start !== 1 ? ` start="${list.start}"` : "";
      const items = list.items
        .map((item) => {
          const itemClass = item.task ? ' class="task-list-item task-list__item"' : "";
          const checkbox = item.task
            ? `<input type="checkbox" disabled${item.checked ? " checked" : ""} aria-label="${
                item.checked ? "已完成" : "未完成"
              }">`
            : "";
          return `<li${itemClass}>${checkbox}${renderInline(item.content)}</li>`;
        })
        .join("");
      html.push(`<${list.type}${className}${start}>${items}</${list.type}>`);
      list = null;
    };

    const flushFlow = () => {
      flushParagraph();
      flushQuote();
      flushList();
    };

    const flushFence = () => {
      if (!fence) return;
      const language = /^[a-z\d_-]+$/i.test(fence.language) ? fence.language.toLowerCase() : "";
      const languageClass = language ? ` class="language-${language}"` : "";
      html.push(`<pre><code${languageClass}>${fence.lines.join("\n")}</code></pre>`);
      fence = null;
    };

    for (const line of lines) {
      if (fence) {
        const closingFence = line.match(/^\s*(`{3,}|~{3,})\s*$/);
        if (
          closingFence &&
          closingFence[1][0] === fence.marker &&
          closingFence[1].length >= fence.length
        ) {
          flushFence();
        } else {
          fence.lines.push(line);
        }
        continue;
      }

      const openingFence = line.match(/^\s*(`{3,}|~{3,})\s*([a-z\d_-]*)\s*$/i);
      if (openingFence) {
        flushFlow();
        fence = {
          marker: openingFence[1][0],
          length: openingFence[1].length,
          language: openingFence[2],
          lines: [],
        };
        continue;
      }

      if (!line.trim()) {
        flushFlow();
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+?)(?:\s+#+)?\s*$/);
      if (heading) {
        flushFlow();
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2])}</h${level}>`);
        continue;
      }

      if (/^\s{0,3}(?:(?:-\s*){3,}|(?:\*\s*){3,}|(?:_\s*){3,})$/.test(line)) {
        flushFlow();
        html.push("<hr>");
        continue;
      }

      const blockquote = line.match(/^\s*&gt;\s?(.*)$/);
      if (blockquote) {
        flushParagraph();
        flushList();
        quote.push(blockquote[1]);
        continue;
      }

      const unorderedItem = line.match(/^\s{0,3}[-+*]\s+(.+)$/);
      const orderedItem = line.match(/^\s{0,3}(\d+)[.)]\s+(.+)$/);
      if (unorderedItem || orderedItem) {
        flushParagraph();
        flushQuote();
        const type = unorderedItem ? "ul" : "ol";
        const rawContent = unorderedItem ? unorderedItem[1] : orderedItem[2];
        const orderedStart = orderedItem ? Number(orderedItem[1]) : 1;
        if (!list || list.type !== type) {
          flushList();
          list = { type, start: orderedStart, items: [] };
        }

        const task = type === "ul" ? rawContent.match(/^\[([ xX])\]\s+(.*)$/) : null;
        list.items.push({
          content: task ? task[2] : rawContent,
          task: Boolean(task),
          checked: Boolean(task && task[1].toLowerCase() === "x"),
        });
        continue;
      }

      if (list && /^\s{2,}\S/.test(line) && list.items.length) {
        list.items[list.items.length - 1].content += `\n${line.trim()}`;
        continue;
      }

      flushQuote();
      flushList();
      paragraph.push(line);
    }

    if (fence) flushFence();
    flushFlow();
    return html.join("\n");
  }

  function findElements() {
    if (typeof document === "undefined") return null;
    return {
      title: document.querySelector("#article-title"),
      input: document.querySelector("#markdown-input"),
      preview: document.querySelector("#markdown-preview, [data-markdown-preview]"),
      importer: document.querySelector("#markdown-import, input[data-import-markdown]"),
      saveStatus: document.querySelector("[data-save-status]"),
      toast: document.querySelector("[data-toast]"),
      wordCount: document.querySelector("[data-word-count]"),
      characterCount: document.querySelector("[data-character-count]"),
      dropzone: document.querySelector("[data-dropzone]"),
    };
  }

  function getElements() {
    elements ||= findElements();
    return elements;
  }

  function createDraft(title = "", body = "", updatedAt = "") {
    return {
      title: typeof title === "string" ? title : "",
      body: typeof body === "string" ? body : "",
      updatedAt: typeof updatedAt === "string" ? updatedAt : "",
    };
  }

  function loadDraft() {
    if (typeof localStorage === "undefined") return { ...EMPTY_DRAFT };
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return { ...EMPTY_DRAFT };
      const draft = JSON.parse(stored);
      if (!draft || typeof draft !== "object") return { ...EMPTY_DRAFT };
      return createDraft(draft.title, draft.body, draft.updatedAt);
    } catch (_error) {
      return { ...EMPTY_DRAFT };
    }
  }

  function formatSavedTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  function setSaveStatus(message, state = "idle") {
    const status = getElements()?.saveStatus;
    if (!status) return;
    status.textContent = message;
    status.dataset.state = state;
  }

  function announce(message, state = "success") {
    const toast = getElements()?.toast;
    if (!toast) return;
    window.clearTimeout(toastTimer);
    toast.hidden = false;
    toast.textContent = "";
    toast.dataset.state = state;
    // Splitting the update makes repeated messages announce in live regions.
    window.requestAnimationFrame(() => {
      toast.textContent = message;
      toast.dataset.visible = "true";
      toast.classList.add("is-visible");
    });
    toastTimer = window.setTimeout(() => {
      toast.dataset.visible = "false";
      toast.classList.remove("is-visible");
      toast.hidden = true;
    }, 2600);
  }

  function currentDraft(updatedAt = "") {
    const editor = getElements();
    return createDraft(editor?.title?.value, editor?.input?.value, updatedAt);
  }

  function saveDraft(options = {}) {
    const { source = "manual" } = options;
    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;

    const draft = currentDraft(new Date().toISOString());
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      const time = formatSavedTime(draft.updatedAt);
      setSaveStatus(`已保存${time ? ` · ${time}` : ""}`, "saved");
      if (source === "manual") announce("草稿已保存");
      return draft;
    } catch (_error) {
      setSaveStatus("无法保存", "error");
      announce("草稿保存失败，请检查浏览器存储权限。", "error");
      return draft;
    }
  }

  function countWords(value) {
    const text = String(value ?? "").trim();
    if (!text) return 0;

    if (typeof Intl !== "undefined" && typeof Intl.Segmenter === "function") {
      const segments = new Intl.Segmenter("zh-CN", { granularity: "word" }).segment(text);
      return Array.from(segments).filter((segment) => segment.isWordLike).length;
    }

    return (text.match(/[\p{Script=Han}]|[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
  }

  function updateCounts() {
    const editor = getElements();
    const content = [editor?.title?.value, editor?.input?.value].filter(Boolean).join("\n");
    if (editor?.wordCount) editor.wordCount.textContent = String(countWords(content));
    if (editor?.characterCount) {
      editor.characterCount.textContent = String(Array.from(content).length);
    }
  }

  function updatePreview() {
    const editor = getElements();
    if (!editor?.preview) return;
    const title = editor.title?.value.trim() || "";
    const body = editor.input?.value || "";
    const titleHtml = title
      ? `<h1 class="markdown-preview__title">${escapeHtml(title)}</h1>`
      : "";
    const bodyHtml = renderMarkdown(body);
    editor.preview.innerHTML =
      titleHtml || bodyHtml
        ? `${titleHtml}${bodyHtml}`
        : '<div class="markdown-empty"><span aria-hidden="true">Aa</span><h3>文字会在这里成形</h3><p>在左侧输入标题与 Markdown，预览会即时更新。</p></div>';
  }

  function scheduleAutosave() {
    window.clearTimeout(autosaveTimer);
    setSaveStatus("等待保存…", "pending");
    autosaveTimer = window.setTimeout(() => saveDraft({ source: "auto" }), AUTOSAVE_DELAY);
  }

  function handleEditorInput() {
    updatePreview();
    updateCounts();
    scheduleAutosave();
  }

  function readFileAsText(file) {
    if (typeof file.text === "function") return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => resolve(String(reader.result ?? "")), { once: true });
      reader.addEventListener("error", () => reject(reader.error), { once: true });
      reader.readAsText(file, "UTF-8");
    });
  }

  function splitImportedMarkdown(source, fallbackTitle = "") {
    const normalized = String(source ?? "").replace(/\r\n?/g, "\n");
    const lines = normalized.split("\n");
    const headingIndex = lines.findIndex((line) => /^#\s+\S/.test(line.trim()));
    if (headingIndex === -1) {
      return { title: fallbackTitle, body: normalized };
    }

    const title = lines[headingIndex].trim().replace(/^#\s+/, "").replace(/\s+#+\s*$/, "").trim();
    lines.splice(headingIndex, 1);
    if (headingIndex < lines.length && !lines[headingIndex].trim()) lines.splice(headingIndex, 1);
    return { title: title || fallbackTitle, body: lines.join("\n").replace(/^\n+/, "") };
  }

  async function importMarkdown(file) {
    if (!file) return;
    const filename = String(file.name || "");
    const isMarkdown = /\.(?:md|markdown)$/i.test(filename) || file.type === "text/markdown";
    if (!isMarkdown) {
      announce("请选择 .md 文件。", "error");
      return;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      announce("文件超过 5 MB，无法导入。", "error");
      return;
    }

    try {
      const source = await readFileAsText(file);
      const fallbackTitle = filename.replace(/\.(?:md|markdown)$/i, "");
      const imported = splitImportedMarkdown(source, fallbackTitle);
      const editor = getElements();
      if (editor?.title) editor.title.value = imported.title;
      if (editor?.input) editor.input.value = imported.body;
      updatePreview();
      updateCounts();
      saveDraft({ source: "import" });
      announce(`已导入 ${filename || "Markdown 文件"}`);
      editor?.input?.focus();
    } catch (_error) {
      announce("文件读取失败，请确认它是 UTF-8 编码的 Markdown。", "error");
    }
  }

  function safeFilename(title) {
    const cleaned = String(title || "")
      .normalize("NFKC")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[.\s-]+|[.\s-]+$/g, "")
      .slice(0, 80);
    return cleaned || "frequency-loader-draft";
  }

  function exportMarkdown() {
    const editor = getElements();
    const title = editor?.title?.value.trim() || "未命名文章";
    const body = editor?.input?.value.replace(/^\s+/, "") || "";
    const markdown = `# ${title}\n${body ? `\n${body}` : ""}\n`;
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${safeFilename(title)}.md`;
    anchor.hidden = true;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 0);
    saveDraft({ source: "export" });
    announce("Markdown 已导出");
  }

  function clearDraft() {
    const editor = getElements();
    const hasContent = Boolean(editor?.title?.value.trim() || editor?.input?.value.trim());
    if (hasContent && !window.confirm("确定清空当前草稿吗？此操作无法撤销。")) return;

    window.clearTimeout(autosaveTimer);
    autosaveTimer = 0;
    if (editor?.title) editor.title.value = "";
    if (editor?.input) editor.input.value = "";
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (_error) {
      // The visible editor can still be cleared if storage access is blocked.
    }
    updatePreview();
    updateCounts();
    setSaveStatus("尚未保存", "idle");
    announce("草稿已清空");
    editor?.title?.focus();
  }

  function handleTextareaTab(event) {
    if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText("  ", start, end, "end");
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function handleShortcut(event) {
    if (!(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== "s") {
      return;
    }
    event.preventDefault();
    if (event.shiftKey) exportMarkdown();
    else saveDraft({ source: "manual" });
  }

  function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes("Files");
  }

  function bindDropzone(dropzone) {
    if (!dropzone) return;
    dropzone.addEventListener("dragenter", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth += 1;
      dropzone.classList.add("is-dragging");
    });
    dropzone.addEventListener("dragover", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    });
    dropzone.addEventListener("dragleave", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (!dragDepth) dropzone.classList.remove("is-dragging");
    });
    dropzone.addEventListener("drop", (event) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth = 0;
      dropzone.classList.remove("is-dragging");
      const file = event.dataTransfer?.files?.[0];
      if (file) void importMarkdown(file);
    });
  }

  function bindActions() {
    document.querySelectorAll("[data-action]").forEach((control) => {
      control.addEventListener("click", (event) => {
        const action = event.currentTarget.dataset.action;
        if (action === "save") saveDraft({ source: "manual" });
        if (action === "export") exportMarkdown();
        if (action === "clear") clearDraft();
        if (action === "import" && event.currentTarget.tagName !== "LABEL") {
          getElements()?.importer?.click();
        }
      });
    });
  }

  function initializeEditor() {
    elements = findElements();
    const editor = getElements();
    if (!editor?.input || !editor?.preview) return;

    const draft = loadDraft();
    if (editor.title) editor.title.value = draft.title;
    editor.input.value = draft.body;
    updatePreview();
    updateCounts();
    if (draft.updatedAt) {
      const time = formatSavedTime(draft.updatedAt);
      setSaveStatus(`已恢复${time ? ` · ${time}` : ""}`, "saved");
    } else {
      setSaveStatus("尚未保存", "idle");
    }

    editor.title?.addEventListener("input", handleEditorInput);
    editor.input.addEventListener("input", handleEditorInput);
    editor.input.addEventListener("keydown", handleTextareaTab);
    editor.importer?.addEventListener("change", (event) => {
      const file = event.currentTarget.files?.[0];
      if (file) void importMarkdown(file);
      event.currentTarget.value = "";
    });

    bindActions();
    bindDropzone(editor.dropzone);
    document.addEventListener("keydown", handleShortcut);
    document.addEventListener("dragover", (event) => {
      if (isFileDrag(event)) event.preventDefault();
    });
    document.addEventListener("drop", (event) => {
      if (isFileDrag(event)) event.preventDefault();
    });
    window.addEventListener("pagehide", () => {
      if (autosaveTimer) saveDraft({ source: "pagehide" });
    });
  }

  if (typeof window !== "undefined") {
    Object.assign(window, {
      renderMarkdown,
      loadDraft,
      saveDraft,
      importMarkdown,
      exportMarkdown,
    });
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", initializeEditor, { once: true });
    } else {
      initializeEditor();
    }
  }
})();
