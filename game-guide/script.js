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

  const getStorage = (name) => {
    try {
      return window[name];
    } catch {
      return null;
    }
  };

  const localStore = getStorage("localStorage");
  const sessionStore = getStorage("sessionStorage");

  const safeGet = (storage, key) => {
    if (!storage) return null;
    try {
      return storage.getItem(key);
    } catch {
      return null;
    }
  };

  const safeSet = (storage, key, value) => {
    if (!storage) return;
    try {
      storage.setItem(key, value);
    } catch {
      // 저장이 차단된 환경에서도 읽기 기능은 계속 동작한다.
    }
  };

  const storedFont = Number(safeGet(localStore, FONT_KEY));
  let currentFont =
    Number.isFinite(storedFont) && storedFont >= MIN_FONT && storedFont <= MAX_FONT
      ? storedFont
      : DEFAULT_FONT;

  const applyFont = () => {
    root.style.setProperty("--body-size", `${currentFont}px`);
    safeSet(localStore, FONT_KEY, String(currentFont));
  };

  const saveOpenSections = () => {
    const openIds = sections
      .filter((section) => section.querySelector(".section-toggle").getAttribute("aria-expanded") === "true")
      .map((section) => section.id);

    safeSet(localStore, OPEN_KEY, JSON.stringify(openIds));
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
      savedOpenIds = JSON.parse(safeGet(localStore, OPEN_KEY));
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
    const scrollTop = window.scrollY;
    const scrollable = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = scrollable > 0 ? Math.min(1, Math.max(0, scrollTop / scrollable)) : 0;

    progress.style.width = `${ratio * 100}%`;
    const shouldShowBackToTop = scrollTop > 700;
    backToTop.classList.toggle("is-visible", shouldShowBackToTop);
    backToTop.tabIndex = shouldShowBackToTop ? 0 : -1;
    backToTop.setAttribute("aria-hidden", String(!shouldShowBackToTop));
    safeSet(sessionStore, SCROLL_KEY, String(scrollTop));
  };

  window.addEventListener("scroll", updateScrollUI, { passive: true });

  backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  applyFont();
  restoreOpenState();
  updateScrollUI();

  const savedPosition = Number(safeGet(sessionStore, SCROLL_KEY));
  if (Number.isFinite(savedPosition) && savedPosition > 0 && !location.hash) {
    requestAnimationFrame(() => {
      window.scrollTo({ top: savedPosition, behavior: "auto" });
    });
  }
})();
