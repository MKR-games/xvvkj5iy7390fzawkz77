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
  const fontDown = document.getElementById("fontDown");
  const fontUp = document.getElementById("fontUp");
  const mapModal = document.getElementById("mapModal");
  const mapOpen = document.getElementById("mapOpen");
  const mapClose = document.getElementById("mapClose");
  const mapBackdrop = document.getElementById("mapBackdrop");
  const mapViewport = document.getElementById("mapViewport");
  const mapImage = document.getElementById("mapImage");
  const mapTitle = document.getElementById("mapTitle");
  const mapCounter = document.getElementById("mapCounter");
  const mapThumbnails = Array.from(document.querySelectorAll(".map-thumbnail"));
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

  // Shared by the five character pages on the same origin. Do not version this
  // key on routine updates: a player who has seen the guide should not see it again.
  const tutorialSeenKey = "mukkuri-ddokddokddok-reader-tutorial-seen";
  const tutorial = document.getElementById("readerTutorial");
  const tutorialCard = document.getElementById("tutorialCard");
  const tutorialSpotlight = document.getElementById("tutorialSpotlight");
  const tutorialTitle = document.getElementById("tutorialTitle");
  const tutorialDescription = document.getElementById("tutorialDescription");
  const tutorialCounter = document.getElementById("tutorialCounter");
  const tutorialPrevious = document.getElementById("tutorialPrevious");
  const tutorialNext = document.getElementById("tutorialNext");
  const tutorialClose = document.getElementById("tutorialClose");
  const tutorialSteps = [
    {
      targets: [gameGuideLink],
      title: "게임 설명서",
      description: "진행 순서나 규칙이 헷갈리면 여기서 다시 확인하세요. 설명서에서 돌아오면 읽던 위치로 이어집니다."
    },
    {
      targets: [fontDown, fontUp],
      title: "가− · 가＋ 글자 크기",
      description: "가−를 누르면 글자가 작아지고, 가＋를 누르면 커집니다. 읽기 편한 크기로 맞춰 주세요."
    },
    {
      targets: [mapOpen],
      title: "MAP · 지도와 침대 배치",
      description: "수련원 지도와 수련생방 침대 배치도를 볼 수 있어요. 아래 작은 미리보기 두 개 중 원하는 그림을 누르면 바뀝니다. 선택한 그림에는 체크 표시가 생겨요. ＋·−로 확대·축소하고, 맞춤을 누르면 처음 크기로 돌아옵니다."
    },
    {
      targets: [tocOpen],
      title: "목차",
      description: "그날 밤의 행동, 핵심 비밀, 첫 진술 등 원하는 항목으로 바로 이동합니다. 이제 설정서를 읽어 주세요."
    }
  ];
  let tutorialActive = false;
  let tutorialStepIndex = 0;
  let tutorialBackgroundState = [];
  let tutorialPositionFrame = 0;

  function positionTutorial() {
    if (!tutorialActive) return;
    const viewport = window.visualViewport;
    const viewLeft = viewport ? viewport.offsetLeft : 0;
    const viewTop = viewport ? viewport.offsetTop : 0;
    const viewWidth = viewport ? viewport.width : document.documentElement.clientWidth;
    const viewHeight = viewport ? viewport.height : window.innerHeight;
    const rects = tutorialSteps[tutorialStepIndex].targets.map((element) => element.getBoundingClientRect());
    const left = Math.min(...rects.map((rect) => rect.left)) - 4;
    const top = Math.min(...rects.map((rect) => rect.top)) - 4;
    const right = Math.max(...rects.map((rect) => rect.right)) + 4;
    const bottom = Math.max(...rects.map((rect) => rect.bottom)) + 4;
    Object.assign(tutorialSpotlight.style, {
      left: `${left}px`, top: `${top}px`,
      width: `${right - left}px`, height: `${bottom - top}px`
    });
    const width = Math.min(380, viewWidth - 24);
    const cardLeft = Math.max(viewLeft + 12, Math.min((left + right - width) / 2, viewLeft + viewWidth - width - 12));
    const cardTop = Math.max(viewTop + 12, bottom + 14);
    Object.assign(tutorialCard.style, {
      width: `${width}px`, left: `${cardLeft}px`, top: `${cardTop}px`,
      maxHeight: `${Math.max(100, viewTop + viewHeight - cardTop - 12)}px`
    });
  }

  function queueTutorialPosition() {
    if (!tutorialActive || tutorialPositionFrame) return;
    tutorialPositionFrame = requestAnimationFrame(() => {
      tutorialPositionFrame = 0;
      positionTutorial();
    });
  }

  function renderTutorialStep() {
    const step = tutorialSteps[tutorialStepIndex];
    tutorialTitle.textContent = step.title;
    tutorialDescription.textContent = step.description;
    tutorialCounter.textContent = `${tutorialStepIndex + 1} / ${tutorialSteps.length}`;
    tutorialPrevious.disabled = tutorialStepIndex === 0;
    tutorialNext.textContent = tutorialStepIndex === tutorialSteps.length - 1 ? "설정서 읽기" : "다음";
    tutorialCard.querySelector(".reader-tutorial__copy").scrollTop = 0;
    positionTutorial();
  }

  function finishTutorial() {
    if (!tutorialActive) return;
    tutorialActive = false;
    tutorial.hidden = true;
    body.classList.remove("is-tutorial");
    tutorialBackgroundState.forEach(({ element, inert, ariaHidden }) => {
      element.toggleAttribute("inert", inert);
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
    tutorialBackgroundState = [];
    window.removeEventListener("resize", queueTutorialPosition);
    if (window.visualViewport) {
      window.visualViewport.removeEventListener("resize", queueTutorialPosition);
      window.visualViewport.removeEventListener("scroll", queueTutorialPosition);
    }
    cancelAnimationFrame(tutorialPositionFrame);
    tutorialPositionFrame = 0;
    mainContent.focus({ preventScroll: true });
    updateReadingState();
  }

  function startTutorialIfNeeded() {
    if (tutorialActive || safeGet(tutorialSeenKey) === "1" || safeSessionGet(tutorialSeenKey) === "1") return;
    // Remember the first display, including dismissal or a reload mid-guide.
    safeSet(tutorialSeenKey, "1");
    safeSessionSet(tutorialSeenKey, "1");
    tutorialActive = true;
    tutorialStepIndex = 0;
    scrollPageTo(0, "auto");
    tutorial.hidden = false;
    body.classList.add("is-tutorial");
    renderTutorialStep();
    tutorialNext.focus({ preventScroll: true });
    tutorialBackgroundState = Array.from(body.children)
      .filter((element) => element !== tutorial)
      .map((element) => ({ element, inert: element.hasAttribute("inert"), ariaHidden: element.getAttribute("aria-hidden") }));
    tutorialBackgroundState.forEach(({ element }) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    window.addEventListener("resize", queueTutorialPosition);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", queueTutorialPosition);
      window.visualViewport.addEventListener("scroll", queueTutorialPosition);
    }
    queueTutorialPosition();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(queueTutorialPosition).catch(() => {});
  }

  tutorialPrevious.addEventListener("click", () => {
    if (tutorialStepIndex > 0) {
      tutorialStepIndex -= 1;
      renderTutorialStep();
      // A disabled Previous button cannot retain keyboard focus on step one.
      if (tutorialStepIndex === 0) tutorialNext.focus({ preventScroll: true });
    }
  });
  tutorialNext.addEventListener("click", () => {
    if (tutorialStepIndex === tutorialSteps.length - 1) finishTutorial();
    else {
      tutorialStepIndex += 1;
      renderTutorialStep();
    }
  });
  tutorialClose.addEventListener("click", finishTutorial);
  window.addEventListener("pageshow", (event) => {
    if (event.persisted && tutorialActive) finishTutorial();
  });

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

  function selectMapImage(button) {
    if (button.getAttribute("aria-pressed") === "true") return;
    mapThumbnails.forEach((thumbnail) => {
      thumbnail.setAttribute("aria-pressed", String(thumbnail === button));
    });
    mapTitle.textContent = button.dataset.mapTitle;
    mapCounter.textContent = `MAP ${mapThumbnails.indexOf(button) + 1} / ${mapThumbnails.length}`;
    mapImage.alt = button.dataset.mapAlt;
    mapImage.src = button.dataset.mapSrc;
    resetMapView();
  }

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
    startTutorialIfNeeded();
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
  mapThumbnails.forEach((button) => {
    button.addEventListener("click", () => selectMapImage(button));
  });
  mapImage.addEventListener("load", () => {
    if (mapModal.classList.contains("is-open")) applyMapZoom(false);
  });

  document.addEventListener("keydown", function (event) {
    if (tutorialActive) {
      if (event.key === "Escape") {
        event.preventDefault();
        finishTutorial();
      } else if (event.key === "Tab") trapModalFocus(tutorial, event);
      return;
    }
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
