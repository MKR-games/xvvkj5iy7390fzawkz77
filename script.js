(function () {
  "use strict";

  const body = document.body;
  const gate = document.getElementById("privacyGate");
  const acknowledgeButton = document.getElementById("acknowledgeButton");
  const readerHeader = document.getElementById("readerHeader");
  const mainContent = document.getElementById("mainContent");
  const toc = document.getElementById("tocSheet");
  const tocOpen = document.getElementById("tocOpen");
  const tocClose = document.getElementById("tocClose");
  const tocBackdrop = document.getElementById("tocBackdrop");
  const topButton = document.getElementById("topButton");
  const footerTopLink = document.getElementById("footerTopLink");
  const gameGuideLink = document.getElementById("gameGuideLink");
  const progress = document.getElementById("readingProgress");
  const copyButton = document.getElementById("copyStatement");
  const copyStatus = document.getElementById("copyStatus");
  const fontDown = document.getElementById("fontDown");
  const fontUp = document.getElementById("fontUp");
  const mapModal = document.getElementById("mapModal");
  const mapOpen = document.getElementById("mapOpen");
  const mapClose = document.getElementById("mapClose");
  const mapBackdrop = document.getElementById("mapBackdrop");
  const mapViewport = document.getElementById("mapViewport");
  const mapImage = document.getElementById("mapImage");
  const mapZoomOut = document.getElementById("mapZoomOut");
  const mapZoomIn = document.getElementById("mapZoomIn");
  const mapReset = document.getElementById("mapReset");
  const mapZoomValue = document.getElementById("mapZoomValue");
  const minFontSize = 15;
  const maxFontSize = 22;
  const defaultFontSize = 17;
  const fontSizeKey = "min-dogyeom-font-size";
  const readerStateKey = "min-dogyeom-reader-open";
  const readerScrollKey = "min-dogyeom-reader-scroll";
  let currentFontSize = defaultFontSize;
  let tocLastFocused = null;
  let mapLastFocused = null;
  let mapZoomIndex = 0;
  const mapZoomLevels = [100, 125, 150, 175, 200, 225, 250];

  function safeGet(key) {
    try { return localStorage.getItem(key); } catch (_) { return null; }
  }

  function safeSet(key, value) {
    try { localStorage.setItem(key, value); } catch (_) { /* local file privacy mode */ }
  }

  function safeSessionGet(key) {
    try { return sessionStorage.getItem(key); } catch (_) { return null; }
  }

  function safeSessionSet(key, value) {
    try { sessionStorage.setItem(key, value); } catch (_) { /* local file privacy mode */ }
  }

  function getScrollTop() {
    return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
  }

  function scrollPageTo(top, behavior = "smooth") {
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
  }

  function scrollToTop(event) {
    if (event) event.preventDefault();
    scrollPageTo(0, "auto");
  }

  function setReaderAccessible(isAccessible) {
    [readerHeader, mainContent].forEach((element) => {
      element.toggleAttribute("inert", !isAccessible);
      element.setAttribute("aria-hidden", String(!isAccessible));
    });
  }

  function unlockReader(options = {}) {
    gate.hidden = true;
    body.classList.remove("is-locked");
    setReaderAccessible(true);

    if (options.restoreScroll) {
      const savedScroll = Number(safeSessionGet(readerScrollKey));
      if (Number.isFinite(savedScroll) && savedScroll > 0) {
        const restoreSavedPosition = () => scrollPageTo(savedScroll, "auto");
        requestAnimationFrame(() => requestAnimationFrame(restoreSavedPosition));
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(restoreSavedPosition).catch(() => {});
        }
      }
    } else {
      mainContent.focus({ preventScroll: true });
    }
    updateReadingState();
  }

  function normalizeStoredFont(value) {
    const legacySizes = { small: 15.5, normal: 17, large: 19 };
    if (value === null || value === "") return defaultFontSize;
    const parsed = Object.prototype.hasOwnProperty.call(legacySizes, value)
      ? legacySizes[value]
      : Number(value);
    return Number.isFinite(parsed)
      ? Math.min(maxFontSize, Math.max(minFontSize, parsed))
      : defaultFontSize;
  }

  function applyFontSize() {
    document.documentElement.style.setProperty("--body-size", `${currentFontSize}px`);
    fontDown.disabled = currentFontSize <= minFontSize;
    fontUp.disabled = currentFontSize >= maxFontSize;
    fontDown.setAttribute("aria-label", `글자 크기 줄이기, 현재 ${currentFontSize}픽셀`);
    fontUp.setAttribute("aria-label", `글자 크기 키우기, 현재 ${currentFontSize}픽셀`);
    safeSet(fontSizeKey, String(currentFontSize));
  }

  function openToc() {
    tocLastFocused = document.activeElement;
    toc.classList.add("is-open");
    toc.setAttribute("aria-hidden", "false");
    toc.removeAttribute("inert");
    tocOpen.setAttribute("aria-expanded", "true");
    setReaderAccessible(false);
    body.style.overflow = "hidden";
    tocClose.focus();
  }

  function closeToc(restoreFocus) {
    toc.classList.remove("is-open");
    toc.setAttribute("aria-hidden", "true");
    toc.setAttribute("inert", "");
    tocOpen.setAttribute("aria-expanded", "false");
    setReaderAccessible(true);
    body.style.overflow = "";
    if (restoreFocus) {
      const focusTarget = tocLastFocused && document.contains(tocLastFocused) ? tocLastFocused : tocOpen;
      focusTarget.focus();
    }
    updateReadingState();
  }

  function applyMapZoom(preserveCenter) {
    const oldWidth = Math.max(1, mapViewport.scrollWidth);
    const oldHeight = Math.max(1, mapViewport.scrollHeight);
    const centerX = (mapViewport.scrollLeft + mapViewport.clientWidth / 2) / oldWidth;
    const centerY = (mapViewport.scrollTop + mapViewport.clientHeight / 2) / oldHeight;
    const zoom = mapZoomLevels[mapZoomIndex];
    mapImage.style.width = `${zoom}%`;
    mapZoomValue.value = `${zoom}%`;
    mapZoomValue.textContent = `${zoom}%`;
    mapZoomOut.disabled = mapZoomIndex === 0;
    mapZoomIn.disabled = mapZoomIndex === mapZoomLevels.length - 1;
    requestAnimationFrame(() => {
      if (preserveCenter) {
        mapViewport.scrollLeft = Math.max(0, centerX * mapViewport.scrollWidth - mapViewport.clientWidth / 2);
        mapViewport.scrollTop = Math.max(0, centerY * mapViewport.scrollHeight - mapViewport.clientHeight / 2);
      } else mapViewport.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }

  function resetMapView() { mapZoomIndex = 0; applyMapZoom(false); }

  function openMap() {
    mapLastFocused = document.activeElement;
    mapModal.classList.add("is-open");
    mapModal.setAttribute("aria-hidden", "false");
    mapModal.removeAttribute("inert");
    mapOpen.setAttribute("aria-expanded", "true");
    setReaderAccessible(false);
    body.style.overflow = "hidden";
    resetMapView();
    mapClose.focus();
    updateReadingState();
  }

  function closeMap(restoreFocus) {
    mapModal.classList.remove("is-open");
    mapModal.setAttribute("aria-hidden", "true");
    mapModal.setAttribute("inert", "");
    mapOpen.setAttribute("aria-expanded", "false");
    setReaderAccessible(true);
    body.style.overflow = "";
    if (restoreFocus) {
      const focusTarget = mapLastFocused && document.contains(mapLastFocused) ? mapLastFocused : mapOpen;
      focusTarget.focus();
    }
    updateReadingState();
  }

  function trapModalFocus(container, event) {
    const focusable = Array.from(container.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])')).filter((element) => element.tabIndex >= 0);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function moveToSection(link) {
    const target = document.querySelector(link.getAttribute("href"));
    if (!target) return;

    const offset = readerHeader.getBoundingClientRect().height + 14;
    const destination = getScrollTop() + target.getBoundingClientRect().top - offset;
    scrollPageTo(destination, "auto");

    target.setAttribute("tabindex", "-1");
    requestAnimationFrame(() => {
      target.focus({ preventScroll: true });
      target.addEventListener("blur", () => target.removeAttribute("tabindex"), { once: true });
    });
  }

  function updateReadingState() {
    const scrollTop = getScrollTop();
    const documentHeight = document.documentElement.scrollHeight - window.innerHeight;
    const ratio = documentHeight > 0 ? Math.min(1, Math.max(0, scrollTop / documentHeight)) : 0;
    const topButtonVisible = gate.hidden && !toc.classList.contains("is-open") && !mapModal.classList.contains("is-open") && scrollTop > 560;
    progress.style.width = `${ratio * 100}%`;
    topButton.classList.toggle("is-visible", topButtonVisible);
    topButton.setAttribute("aria-hidden", String(!topButtonVisible));
    topButton.tabIndex = topButtonVisible ? 0 : -1;
  }

  acknowledgeButton.addEventListener("click", function () {
    unlockReader();
  });

  fontDown.addEventListener("click", function () {
    currentFontSize = Math.max(minFontSize, currentFontSize - 1);
    applyFontSize();
  });
  fontUp.addEventListener("click", function () {
    currentFontSize = Math.min(maxFontSize, currentFontSize + 1);
    applyFontSize();
  });

  tocOpen.addEventListener("click", openToc);
  tocClose.addEventListener("click", function () { closeToc(true); });
  tocBackdrop.addEventListener("click", function () { closeToc(true); });
  document.querySelectorAll(".toc-list a").forEach((link) => {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      closeToc(false);
      moveToSection(link);
    });
  });

  mapOpen.addEventListener("click", openMap);
  mapClose.addEventListener("click", function () { closeMap(true); });
  mapBackdrop.addEventListener("click", function () { closeMap(true); });
  mapZoomOut.addEventListener("click", function () { if (mapZoomIndex > 0) { mapZoomIndex -= 1; applyMapZoom(true); } });
  mapZoomIn.addEventListener("click", function () { if (mapZoomIndex < mapZoomLevels.length - 1) { mapZoomIndex += 1; applyMapZoom(true); } });
  mapReset.addEventListener("click", resetMapView);

  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") {
      if (mapModal.classList.contains("is-open")) { closeMap(true); return; }
      if (toc.classList.contains("is-open")) closeToc(true);
    }
    if (event.key !== "Tab") return;
    if (mapModal.classList.contains("is-open")) trapModalFocus(mapModal, event);
    else if (toc.classList.contains("is-open")) trapModalFocus(toc, event);
  });

  topButton.addEventListener("click", scrollToTop);
  footerTopLink.addEventListener("click", scrollToTop);

  gameGuideLink.addEventListener("click", function () {
    safeSessionSet(readerStateKey, "1");
    safeSessionSet(readerScrollKey, String(getScrollTop()));
  });

  copyButton.addEventListener("click", async function () {
    const text = document.getElementById("statementText").innerText.trim();
    try {
      await navigator.clipboard.writeText(text);
      copyStatus.textContent = "첫 진술을 복사했습니다.";
    } catch (_) {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      area.remove();
      copyStatus.textContent = copied ? "첫 진술을 복사했습니다." : "길게 눌러 직접 복사해 주세요.";
    }
    window.setTimeout(function () { copyStatus.textContent = ""; }, 2500);
  });

  if ("IntersectionObserver" in window) {
    const links = Array.from(document.querySelectorAll(".toc-list a"));
    const sectionObserver = new IntersectionObserver((entries) => {
      const visible = entries
        .filter((entry) => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (!visible) return;
      links.forEach((link) => link.classList.toggle("is-current", link.hash === `#${visible.target.id}`));
    }, { rootMargin: "-24% 0px -60% 0px", threshold: [0, .2, .55] });
    document.querySelectorAll("[data-section]").forEach((section) => sectionObserver.observe(section));
  }

  window.addEventListener("scroll", updateReadingState, { passive: true });
  window.addEventListener("resize", updateReadingState);
  currentFontSize = normalizeStoredFont(safeGet(fontSizeKey));
  applyFontSize();

  const returningFromGuide = new URLSearchParams(window.location.search).get("from") === "guide";
  if (returningFromGuide && safeSessionGet(readerStateKey) === "1") {
    unlockReader({ restoreScroll: true });
  } else {
    setReaderAccessible(false);
    requestAnimationFrame(() => acknowledgeButton.focus({ preventScroll: true }));
    updateReadingState();
  }
})();
