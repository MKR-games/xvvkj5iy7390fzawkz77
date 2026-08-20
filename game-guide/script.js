(() => {
  const root = document.documentElement;
  const progress = document.getElementById("scrollProgress");
  const backToTop = document.getElementById("backToTop");
  const fontUp = document.getElementById("fontUp");
  const fontDown = document.getElementById("fontDown");
  const menuToggle = document.getElementById("menuToggle");
  const quickNav = document.getElementById("quickNav");
  const searchInput = document.getElementById("manualSearch");
  const searchStatus = document.getElementById("searchStatus");
  const noResults = document.getElementById("noResults");
  const expandAll = document.getElementById("expandAll");
  const collapseAll = document.getElementById("collapseAll");
  const sections = [...document.querySelectorAll(".manual-section")];

  const MIN_FONT = 15;
  const MAX_FONT = 22;
  const DEFAULT_FONT = 17;
  const FONT_KEY = "ttok-ttok-ttok-manual-font-size";
  const SCROLL_KEY = "ttok-ttok-ttok-manual-scroll-position";
  const OPEN_KEY = "ttok-ttok-ttok-manual-open-sections";

  const safeLocalGet = (key) => {
    try { return localStorage.getItem(key); } catch { return null; }
  };

  const safeLocalSet = (key, value) => {
    try { localStorage.setItem(key, value); } catch { /* local file privacy mode */ }
  };

  const safeSessionGet = (key) => {
    try { return sessionStorage.getItem(key); } catch { return null; }
  };

  const safeSessionSet = (key, value) => {
    try { sessionStorage.setItem(key, value); } catch { /* local file privacy mode */ }
  };

  const getScrollTop = () =>
    window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;

  const scrollPageTo = (top, behavior = "smooth") => {
    const destination = Math.max(0, Math.round(top));
    const reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const supportsSmooth = "scrollBehavior" in document.documentElement.style;
    const mode = behavior === "auto" || reducedMotion || !supportsSmooth ? "auto" : "smooth";

    if (mode === "auto") {
      const previousBehavior = document.documentElement.style.scrollBehavior;
      document.documentElement.style.scrollBehavior = "auto";
      window.scrollTo(0, destination);
      document.documentElement.scrollTop = destination;
      document.body.scrollTop = destination;
      requestAnimationFrame(() => { document.documentElement.style.scrollBehavior = previousBehavior; });
      return;
    }

    if (supportsSmooth) {
      window.scrollTo({ top: destination, left: 0, behavior: mode });
    } else {
      window.scrollTo(0, destination);
      document.documentElement.scrollTop = destination;
      document.body.scrollTop = destination;
    }
  };

  const storedFont = Number(safeLocalGet(FONT_KEY));
  let currentFont =
    Number.isFinite(storedFont) && storedFont >= MIN_FONT && storedFont <= MAX_FONT
      ? storedFont
      : DEFAULT_FONT;

  const applyFont = () => {
    root.style.setProperty("--body-size", `${currentFont}px`);
    safeLocalSet(FONT_KEY, String(currentFont));
    fontDown.disabled = currentFont <= MIN_FONT;
    fontUp.disabled = currentFont >= MAX_FONT;
  };

  const saveOpenSections = () => {
    const openIds = sections
      .filter((section) => section.querySelector(".section-toggle").getAttribute("aria-expanded") === "true")
      .map((section) => section.id);

    safeLocalSet(OPEN_KEY, JSON.stringify(openIds));
  };

  const setSectionOpen = (section, shouldOpen, shouldSave = true) => {
    const button = section.querySelector(".section-toggle");
    const content = section.querySelector(".section-content");
    const mark = section.querySelector(".toggle-mark");

    button.setAttribute("aria-expanded", String(shouldOpen));
    content.hidden = !shouldOpen;
    mark.textContent = shouldOpen ? "−" : "+";

    if (shouldSave) saveOpenSections();
  };

  sections.forEach((section) => {
    const button = section.querySelector(".section-toggle");
    button.addEventListener("click", () => {
      const isOpen = button.getAttribute("aria-expanded") === "true";
      setSectionOpen(section, !isOpen);
    });
  });

  fontUp.addEventListener("click", () => {
    currentFont = Math.min(MAX_FONT, currentFont + 1);
    applyFont();
  });

  fontDown.addEventListener("click", () => {
    currentFont = Math.max(MIN_FONT, currentFont - 1);
    applyFont();
  });

  menuToggle.addEventListener("click", () => {
    const willOpen = !quickNav.classList.contains("is-open");
    quickNav.classList.toggle("is-open", willOpen);
    menuToggle.setAttribute("aria-expanded", String(willOpen));
  });

  quickNav.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link) return;

    quickNav.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");

    const target = document.querySelector(link.getAttribute("href"));
    if (target) {
      target.hidden = false;
      setSectionOpen(target, true);
    }
  });

  document.addEventListener("click", (event) => {
    if (!quickNav.contains(event.target) && !menuToggle.contains(event.target)) {
      quickNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && quickNav.classList.contains("is-open")) {
      quickNav.classList.remove("is-open");
      menuToggle.setAttribute("aria-expanded", "false");
      menuToggle.focus();
    }
  });

  expandAll.addEventListener("click", () => {
    sections.forEach((section) => {
      if (!section.hidden) setSectionOpen(section, true, false);
    });
    saveOpenSections();
  });

  collapseAll.addEventListener("click", () => {
    sections.forEach((section) => {
      if (!section.hidden) setSectionOpen(section, false, false);
    });
    saveOpenSections();
  });

  const normalize = (value) =>
    value.toLocaleLowerCase("ko-KR").replace(/\s+/g, " ").trim();

  const restoreOpenState = () => {
    let savedOpenIds = null;

    try {
      savedOpenIds = JSON.parse(safeLocalGet(OPEN_KEY));
    } catch {
      savedOpenIds = null;
    }

    if (!Array.isArray(savedOpenIds)) {
      sections.forEach((section, index) => setSectionOpen(section, index < 6, false));
      return;
    }

    const openSet = new Set(savedOpenIds);
    sections.forEach((section) => setSectionOpen(section, openSet.has(section.id), false));
  };

  const runSearch = () => {
    const query = normalize(searchInput.value);
    let visibleCount = 0;

    sections.forEach((section) => {
      const searchable = normalize(section.textContent || "");
      const matches = !query || searchable.includes(query);
      section.hidden = !matches;

      if (matches) {
        visibleCount += 1;
        if (query) setSectionOpen(section, true, false);
      }
    });

    noResults.hidden = visibleCount !== 0;

    if (!query) {
      searchStatus.textContent = "";
      restoreOpenState();
    } else {
      searchStatus.textContent = `${visibleCount}개 구역에서 검색어를 찾았습니다.`;
    }
  };

  searchInput.addEventListener("input", runSearch);

  const updateScrollUI = () => {
    const scrollTop = getScrollTop();
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0;

    progress.style.width = `${ratio * 100}%`;
    const isVisible = scrollTop > 700;
    backToTop.classList.toggle("is-visible", isVisible);
    backToTop.setAttribute("aria-hidden", String(!isVisible));
    backToTop.tabIndex = isVisible ? 0 : -1;
    safeSessionSet(SCROLL_KEY, String(scrollTop));
  };

  window.addEventListener("scroll", updateScrollUI, { passive: true });

  backToTop.addEventListener("click", () => {
    scrollPageTo(0, "auto");
  });

  applyFont();
  restoreOpenState();
  updateScrollUI();

  const savedPosition = Number(safeSessionGet(SCROLL_KEY));
  if (Number.isFinite(savedPosition) && savedPosition > 0 && !location.hash) {
    requestAnimationFrame(() => {
      scrollPageTo(savedPosition, "auto");
    });
  }
})();
