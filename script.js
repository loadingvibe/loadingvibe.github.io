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

    if (catalog) {
      const isFiltered = !isAllFilter(state.filter) || Boolean(state.query);
      catalog.classList.toggle("is-filtered", isFiltered);
      catalog.classList.toggle("has-single-result", visibleCount === 1);
    }

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

  const motionPreference = window.matchMedia?.(
    "(prefers-reduced-motion: reduce)",
  );
  let reducedMotion = motionPreference?.matches ?? false;

  const homepageSlider = document.querySelector("[data-homepage-slider]");
  const sliderNavigation = document.querySelector("[data-slider-nav]");

  if (homepageSlider) {
    const sliderViewport = homepageSlider.querySelector(
      ".homepage-slider__viewport",
    );
    const slides = Array.from(
      homepageSlider.querySelectorAll("[data-homepage-slide]"),
    );
    const navigationControls = Array.from(
      sliderNavigation?.querySelectorAll("[data-slide-to]") || [],
    );
    const indexLabel = homepageSlider.querySelector("[data-slider-index]");
    const nameLabel = homepageSlider.querySelector("[data-slider-name]");
    const announcer = homepageSlider.querySelector("[data-slider-announcer]");
    const previousControl = homepageSlider.querySelector("[data-slider-prev]");
    const nextControl = homepageSlider.querySelector("[data-slider-next]");
    const toggleControl = homepageSlider.querySelector("[data-slider-toggle]");
    const progressIndicator = homepageSlider.querySelector(
      "[data-slider-progress]",
    );
    const AUTOPLAY_DELAY = 5800;
    let currentIndex = Math.max(
      0,
      slides.findIndex((slide) => slide.classList.contains("is-active")),
    );
    let autoplayTimer = null;
    let transitionTimer = null;
    let pausedByUser = false;
    let pausedByPointer = false;
    let pausedByFocus = false;
    let sliderInView = true;
    let touchGesture = null;
    let suppressClickUntil = 0;

    const wrapIndex = (index) => (index + slides.length) % slides.length;

    function setSlideAccess(slide, active) {
      slide.setAttribute("aria-hidden", String(!active));
      slide.tabIndex = active ? 0 : -1;
      slide.toggleAttribute("inert", !active);
    }

    function updateToggleControl() {
      if (!toggleControl) {
        return;
      }

      if (reducedMotion) {
        toggleControl.disabled = true;
        toggleControl.textContent = "静止";
        toggleControl.setAttribute("aria-label", "已关闭自动轮播");
        toggleControl.setAttribute("aria-pressed", "true");
        return;
      }

      toggleControl.disabled = false;
      toggleControl.textContent = pausedByUser ? "继续" : "暂停";
      toggleControl.setAttribute(
        "aria-label",
        pausedByUser ? "继续轮播" : "暂停轮播",
      );
      toggleControl.setAttribute("aria-pressed", String(pausedByUser));
    }

    function centerActiveNavigation(control) {
      if (!sliderNavigation || !control) {
        return;
      }

      const left =
        control.offsetLeft -
        (sliderNavigation.clientWidth - control.offsetWidth) / 2;
      sliderNavigation.scrollTo({
        left: Math.max(0, left),
        behavior: reducedMotion ? "auto" : "smooth",
      });
    }

    function updateSliderLabels({ announce = false } = {}) {
      const activeSlide = slides[currentIndex];
      const activeName = activeSlide?.dataset.name || "";

      if (indexLabel) {
        indexLabel.textContent = String(currentIndex + 1).padStart(2, "0");
      }

      if (nameLabel) {
        nameLabel.textContent = activeName;
      }

      navigationControls.forEach((control, index) => {
        const active = index === currentIndex;
        control.classList.toggle("is-active", active);
        control.tabIndex = active ? 0 : -1;

        if (active) {
          control.setAttribute("aria-current", "true");
        } else {
          control.removeAttribute("aria-current");
        }
      });

      centerActiveNavigation(navigationControls[currentIndex]);

      if (announce && announcer) {
        announcer.textContent = `第 ${currentIndex + 1} 个，共 ${slides.length} 个：${activeName}`;
      }
    }

    function showSlide(index, { direction = 1, announce = false } = {}) {
      const nextIndex = wrapIndex(index);

      if (nextIndex === currentIndex || slides.length < 2) {
        return;
      }

      window.clearTimeout(transitionTimer);

      const outgoing = slides[currentIndex];
      const incoming = slides[nextIndex];
      slides.forEach((slide) => {
        slide.classList.remove("is-exiting-left", "is-exiting-right");
      });

      incoming.classList.remove("is-active");
      incoming.classList.toggle("is-entering-right", direction < 0);
      setSlideAccess(outgoing, false);
      setSlideAccess(incoming, true);

      // Commit the off-canvas start position before beginning the transition.
      void incoming.offsetWidth;
      outgoing.classList.remove("is-active");
      outgoing.classList.add(
        direction < 0 ? "is-exiting-left" : "is-exiting-right",
      );
      incoming.classList.add("is-active");
      incoming.classList.remove("is-entering-right");

      currentIndex = nextIndex;
      updateSliderLabels({ announce });

      transitionTimer = window.setTimeout(() => {
        outgoing.classList.remove("is-exiting-left", "is-exiting-right");
      }, reducedMotion ? 20 : 620);
    }

    function stopAutoplay() {
      window.clearTimeout(autoplayTimer);
      autoplayTimer = null;
      homepageSlider.classList.remove("is-progressing");
    }

    function canAutoplay() {
      return (
        slides.length > 1 &&
        !reducedMotion &&
        !pausedByUser &&
        !pausedByPointer &&
        !pausedByFocus &&
        sliderInView &&
        !document.hidden
      );
    }

    function scheduleAutoplay() {
      stopAutoplay();

      if (!canAutoplay()) {
        return;
      }

      if (progressIndicator) {
        void progressIndicator.offsetWidth;
        homepageSlider.classList.add("is-progressing");
      }

      autoplayTimer = window.setTimeout(() => {
        showSlide(currentIndex + 1, { direction: 1 });
        scheduleAutoplay();
      }, AUTOPLAY_DELAY);
    }

    function manuallyShow(index, direction) {
      showSlide(index, { direction, announce: true });
      scheduleAutoplay();
    }

    slides.forEach((slide, index) => {
      const active = index === currentIndex;
      slide.classList.toggle("is-active", active);
      setSlideAccess(slide, active);
    });

    navigationControls.forEach((control, index) => {
      control.addEventListener("click", () => {
        const direction = index < currentIndex ? -1 : 1;
        manuallyShow(index, direction);
      });

      control.addEventListener("keydown", (event) => {
        let targetIndex = null;

        if (event.key === "ArrowLeft") {
          targetIndex = wrapIndex(currentIndex - 1);
        } else if (event.key === "ArrowRight") {
          targetIndex = wrapIndex(currentIndex + 1);
        } else if (event.key === "Home") {
          targetIndex = 0;
        } else if (event.key === "End") {
          targetIndex = slides.length - 1;
        }

        if (targetIndex === null) {
          return;
        }

        event.preventDefault();
        const direction = targetIndex < currentIndex ? -1 : 1;
        manuallyShow(targetIndex, direction);
        navigationControls[targetIndex]?.focus();
      });
    });

    homepageSlider.addEventListener("keydown", (event) => {
      if (event.target !== homepageSlider) {
        return;
      }

      let targetIndex = null;
      if (event.key === "ArrowLeft") {
        targetIndex = currentIndex - 1;
      } else if (event.key === "ArrowRight") {
        targetIndex = currentIndex + 1;
      } else if (event.key === "Home") {
        targetIndex = 0;
      } else if (event.key === "End") {
        targetIndex = slides.length - 1;
      }

      if (targetIndex === null) {
        return;
      }

      event.preventDefault();
      const direction = targetIndex < currentIndex ? -1 : 1;
      manuallyShow(targetIndex, direction);
    });

    sliderViewport?.addEventListener("pointerdown", (event) => {
      if (event.pointerType !== "touch") {
        return;
      }

      touchGesture = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
    });

    sliderViewport?.addEventListener("pointerup", (event) => {
      if (!touchGesture || event.pointerId !== touchGesture.pointerId) {
        return;
      }

      const deltaX = event.clientX - touchGesture.x;
      const deltaY = event.clientY - touchGesture.y;
      touchGesture = null;

      if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) {
        return;
      }

      suppressClickUntil = performance.now() + 500;
      const direction = deltaX < 0 ? 1 : -1;
      manuallyShow(currentIndex + direction, direction);
    });

    sliderViewport?.addEventListener("pointercancel", () => {
      touchGesture = null;
    });

    sliderViewport?.addEventListener(
      "click",
      (event) => {
        if (performance.now() >= suppressClickUntil) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
      },
      true,
    );

    previousControl?.addEventListener("click", () => {
      manuallyShow(currentIndex - 1, -1);
    });

    nextControl?.addEventListener("click", () => {
      manuallyShow(currentIndex + 1, 1);
    });

    toggleControl?.addEventListener("click", () => {
      pausedByUser = !pausedByUser;
      updateToggleControl();
      scheduleAutoplay();
    });

    [homepageSlider, sliderNavigation].filter(Boolean).forEach((element) => {
      element.addEventListener("pointerenter", () => {
        pausedByPointer = true;
        scheduleAutoplay();
      });
      element.addEventListener("pointerleave", () => {
        pausedByPointer = false;
        scheduleAutoplay();
      });
      element.addEventListener("focusin", () => {
        pausedByFocus = true;
        scheduleAutoplay();
      });
      element.addEventListener("focusout", () => {
        window.setTimeout(() => {
          pausedByFocus =
            homepageSlider.contains(document.activeElement) ||
            Boolean(sliderNavigation?.contains(document.activeElement));
          scheduleAutoplay();
        });
      });
    });

    document.addEventListener("visibilitychange", scheduleAutoplay);
    motionPreference?.addEventListener?.("change", (event) => {
      reducedMotion = event.matches;
      updateToggleControl();
      scheduleAutoplay();
    });

    if ("IntersectionObserver" in window) {
      const sliderObserver = new IntersectionObserver(
        ([entry]) => {
          sliderInView = Boolean(entry?.isIntersecting);
          scheduleAutoplay();
        },
        { threshold: 0.15 },
      );
      sliderObserver.observe(homepageSlider);
    }

    updateSliderLabels();
    updateToggleControl();
    scheduleAutoplay();
  }

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
