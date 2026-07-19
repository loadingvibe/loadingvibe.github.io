(() => {
  "use strict";

  const STORAGE_KEY = "loading-vibe-view";
  const DEFAULT_FILTER = "全部";
  const VALID_VIEWS = new Set(["editorial", "covers", "list"]);
  const ALL_FILTERS = new Set(["", "*", "all", "all-shows", "全部"]);

  const catalog = document.querySelector("[data-catalog]");
  const cards = Array.from(
    (catalog || document).querySelectorAll(".show-card"),
  );
  const filterControls = Array.from(document.querySelectorAll("[data-filter]"));
  const viewControls = Array.from(document.querySelectorAll("[data-view]"));
  const resetCatalogControls = Array.from(
    document.querySelectorAll("[data-reset-catalog]"),
  );
  const searchInput = document.querySelector("#show-search");
  const clearSearchControl = document.querySelector(
    "[data-clear-search], #clear-search",
  );
  const resultCount = document.querySelector(
    "[data-result-count], #result-count",
  );
  const emptyState = document.querySelector(
    "[data-empty-state], #catalog-empty",
  );

  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .trim()
      .toLocaleLowerCase();

  const firstActiveFilter = filterControls.find(
    (control) =>
      control.getAttribute("aria-pressed") === "true" ||
      control.classList.contains("is-active"),
  );

  const state = {
    filter: firstActiveFilter?.dataset.filter || DEFAULT_FILTER,
    query: normalize(searchInput?.value),
  };

  function isAllFilter(filter) {
    return ALL_FILTERS.has(normalize(filter));
  }

  function cardMatchesFilter(card) {
    if (isAllFilter(state.filter)) {
      return true;
    }

    return normalize(card.dataset.category).includes(normalize(state.filter));
  }

  function cardMatchesSearch(card) {
    if (!state.query) {
      return true;
    }

    const searchableText = normalize(
      card.dataset.search || card.textContent || "",
    );
    const searchableTokens = searchableText.match(/[\p{L}\p{N}]+/gu) || [];

    return state.query
      .split(/\s+/)
      .every((term) => {
        const isShortLatinTerm = /^[a-z0-9]{1,2}$/.test(term);
        return isShortLatinTerm
          ? searchableTokens.includes(term)
          : searchableText.includes(term);
      });
  }

  function setControlState(control, active) {
    control.setAttribute("aria-pressed", String(active));
    control.classList.toggle("is-active", active);

    if (control.getAttribute("role") === "tab") {
      control.setAttribute("aria-selected", String(active));
      control.tabIndex = active ? 0 : -1;
    }
  }

  function updateResultCount(visibleCount) {
    if (!resultCount) {
      return;
    }

    const totalCount = cards.length;
    const template = resultCount.dataset.resultTemplate;
    resultCount.textContent = template
      ? template
          .replaceAll("{visible}", String(visibleCount))
          .replaceAll("{total}", String(totalCount))
      : String(visibleCount).padStart(2, "0");
    resultCount.setAttribute(
      "aria-label",
      `显示 ${visibleCount} / ${totalCount} 档节目`,
    );
    resultCount.setAttribute("aria-live", "polite");
    resultCount.setAttribute("aria-atomic", "true");
  }

  function updateClearSearchControl() {
    if (!clearSearchControl) {
      return;
    }

    const hasQuery = Boolean(searchInput?.value);
    clearSearchControl.hidden = !hasQuery;
    clearSearchControl.disabled = !hasQuery;
    clearSearchControl.setAttribute("aria-hidden", String(!hasQuery));
  }

  function applyCatalogState() {
    let visibleCount = 0;

    cards.forEach((card) => {
      const isVisible = cardMatchesFilter(card) && cardMatchesSearch(card);
      card.hidden = !isVisible;
      visibleCount += Number(isVisible);
    });

    filterControls.forEach((control) => {
      setControlState(control, control.dataset.filter === state.filter);
    });

    updateResultCount(visibleCount);
    updateClearSearchControl();

    if (emptyState) {
      emptyState.hidden = visibleCount !== 0;
    }
  }

  function readStoredView() {
    try {
      const storedView = window.localStorage.getItem(STORAGE_KEY);
      return VALID_VIEWS.has(storedView) ? storedView : null;
    } catch {
      return null;
    }
  }

  function storeView(mode) {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // Storage can be unavailable in privacy modes; the view still works.
    }
  }

  function setView(mode, { persist = true } = {}) {
    if (!VALID_VIEWS.has(mode)) {
      return;
    }

    document.body.dataset.viewMode = mode;
    viewControls.forEach((control) => {
      setControlState(control, control.dataset.view === mode);
    });

    if (persist) {
      storeView(mode);
    }
  }

  function clearSearch() {
    if (!searchInput) {
      return;
    }

    searchInput.value = "";
    state.query = "";
    applyCatalogState();
    searchInput.focus();
  }

  function resetCatalog() {
    state.filter = DEFAULT_FILTER;

    if (searchInput) {
      searchInput.value = "";
    }

    state.query = "";
    applyCatalogState();

    const allFilterControl = filterControls.find((control) =>
      isAllFilter(control.dataset.filter),
    );
    (allFilterControl || searchInput)?.focus();
  }

  filterControls.forEach((control) => {
    control.addEventListener("click", () => {
      state.filter = control.dataset.filter || DEFAULT_FILTER;
      applyCatalogState();
    });
  });

  viewControls.forEach((control) => {
    control.addEventListener("click", () => {
      setView(control.dataset.view);
    });
  });

  searchInput?.addEventListener("input", () => {
    state.query = normalize(searchInput.value);
    applyCatalogState();
  });

  searchInput?.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && searchInput.value) {
      event.preventDefault();
      clearSearch();
    }
  });

  clearSearchControl?.addEventListener("click", clearSearch);
  resetCatalogControls.forEach((control) => {
    control.addEventListener("click", resetCatalog);
  });

  const initialView =
    readStoredView() ||
    (VALID_VIEWS.has(document.body.dataset.viewMode)
      ? document.body.dataset.viewMode
      : "editorial");

  setView(initialView, { persist: false });
  applyCatalogState();

  const reducedMotion = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!reducedMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) {
            return;
          }

          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    document.documentElement.classList.add("reveal-ready");
    cards.forEach((card, index) => {
      card.style.setProperty("--reveal-index", String(index));
      observer.observe(card);
    });
  } else {
    cards.forEach((card) => card.classList.add("is-revealed"));
  }
})();
