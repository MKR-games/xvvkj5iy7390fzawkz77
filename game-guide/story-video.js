(() => {
  'use strict';
  const opener = document.getElementById('storyVideoOpen');
  const modal = document.getElementById('storyVideoModal');
  const panel = document.getElementById('storyVideoPanel');
  const video = document.getElementById('storyVideo');
  const closeButton = document.getElementById('storyVideoClose');
  const fullscreenButton = document.getElementById('storyVideoFullscreen');
  const status = document.getElementById('storyVideoStatus');
  const playButton = document.getElementById('storyVideoPlay');
  const seek = document.getElementById('storyVideoSeek');
  const currentTime = document.getElementById('storyVideoCurrentTime');
  const totalTime = document.getElementById('storyVideoDuration');
  const muteButton = document.getElementById('storyVideoMute');
  if (!opener || !modal || !video) return;

  let previousFocus = null;
  let pointerStartedOnBackdrop = false;
  let playbackAttempt = 0;
  let draggingSeek = false;
  const setStatus = (message) => { status.textContent = message; };
  const duration = () => Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
  const formatTime = (seconds) => {
    const value = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
    const hours = Math.floor(value / 3600);
    const minutes = Math.floor(value % 3600 / 60);
    const tail = String(value % 60).padStart(2, '0');
    return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${tail}` : `${minutes}:${tail}`;
  };
  const syncTimeline = () => {
    const length = duration();
    seek.disabled = !length || Boolean(video.error);
    seek.max = String(length || 1);
    if (!draggingSeek) seek.value = String(Math.min(length, video.currentTime || 0));
    const position = draggingSeek ? Number(seek.value) : video.currentTime || 0;
    currentTime.textContent = formatTime(position);
    totalTime.textContent = length ? formatTime(length) : '--:--';
    seek.setAttribute('aria-valuetext', `${formatTime(position)} / ${length ? formatTime(length) : '--:--'}`);
    seek.style.setProperty('--seek-progress', `${length ? Math.min(100, Math.max(0, position / length * 100)) : 0}%`);
  };
  const syncPlayback = () => {
    const playing = !video.paused && !video.ended;
    const label = playing ? '일시정지' : video.ended ? '다시 재생' : '재생';
    playButton.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-label', label);
    playButton.title = label;
  };
  const syncVolume = () => {
    const muted = video.muted || video.volume === 0;
    muteButton.classList.toggle('is-muted', muted);
    muteButton.setAttribute('aria-label', muted ? '음소거 해제' : '음소거');
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.title = muted ? '음소거 해제' : '음소거';
  };
  const requestPlayback = async () => {
    const attempt = ++playbackAttempt;
    if (video.ended) video.currentTime = 0;
    try { await video.play(); }
    catch (error) {
      if (!modal.open || playbackAttempt !== attempt || video.error) return;
      if (error.name === 'NotAllowedError') setStatus('아래 재생 버튼을 눌러 주세요.');
      else if (error.name !== 'AbortError') setStatus('영상을 재생할 수 없습니다. 잠시 후 다시 열어 주세요.');
    }
    syncPlayback();
  };
  const fullscreenElement = () => document.fullscreenElement || document.webkitFullscreenElement;
  const isFullscreen = () => Boolean(fullscreenElement()) || Boolean(video.webkitDisplayingFullscreen);
  const syncFullscreenButton = () => {
    const expanded = isFullscreen() || modal.classList.contains('is-expanded');
    fullscreenButton.textContent = expanded ? '화면 축소' : '전체화면';
    fullscreenButton.setAttribute('aria-label', expanded ? '전체화면 종료' : '전체화면');
    fullscreenButton.setAttribute('aria-pressed', String(expanded));
  };
  const exitFullscreen = async () => {
    try {
      if (fullscreenElement()) {
        if (document.exitFullscreen) await document.exitFullscreen();
        else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      } else if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) {
        video.webkitExitFullscreen();
      }
    } catch { /* 브라우저가 이미 전체화면을 끝낸 경우에도 닫기를 계속한다. */ }
  };
  const openVideo = () => {
    if (modal.open) return;
    previousFocus = document.activeElement;
    modal.showModal();
    document.documentElement.classList.add('story-video-is-open');
    opener.setAttribute('aria-expanded', 'true');
    closeButton.focus({ preventScroll: true });

    const source = String(window.TTOK_STORY_VIDEO_SRC || 'assets/story-background.mp4').trim();
    if (!video.getAttribute('src') || video.error || video.getAttribute('src') !== source) {
      fullscreenButton.disabled = true;
      playButton.disabled = true;
      draggingSeek = false;
      setStatus('영상을 불러오는 중입니다.');
      video.src = source;
      video.load();
    } else if (video.ended) {
      video.currentTime = 0;
    }
    syncTimeline();
    void requestPlayback();
  };
  const closeVideo = () => {
    draggingSeek = false;
    video.pause();
    if (modal.open) modal.close();
  };
  modal.addEventListener('close', () => {
    ++playbackAttempt;
    video.pause();
    void exitFullscreen();
    modal.classList.remove('is-expanded');
    document.documentElement.classList.remove('story-video-is-open');
    opener.setAttribute('aria-expanded', 'false');
    setStatus('');
    syncFullscreenButton();
    if (previousFocus && previousFocus.isConnected) previousFocus.focus({ preventScroll: true });
  });
  modal.addEventListener('cancel', (event) => { event.preventDefault(); closeVideo(); });
  modal.addEventListener('pointerdown', (event) => { pointerStartedOnBackdrop = event.target === modal; });
  modal.addEventListener('click', (event) => {
    if (event.target === modal && pointerStartedOnBackdrop) closeVideo();
    pointerStartedOnBackdrop = false;
  });
  opener.addEventListener('click', openVideo);
  closeButton.addEventListener('click', closeVideo);
  playButton.addEventListener('click', () => {
    if (!modal.open || video.error) return;
    if (video.paused || video.ended) void requestPlayback();
    else { ++playbackAttempt; video.pause(); }
  });
  seek.addEventListener('pointerdown', () => { if (!seek.disabled) draggingSeek = true; });
  seek.addEventListener('input', () => {
    if (!duration() || video.error) return;
    video.currentTime = Math.min(duration(), Math.max(0, Number(seek.value)));
    syncTimeline();
  });
  const finishSeek = () => { draggingSeek = false; syncTimeline(); };
  seek.addEventListener('change', finishSeek);
  seek.addEventListener('blur', finishSeek);
  window.addEventListener('pointerup', () => { if (draggingSeek) finishSeek(); });
  window.addEventListener('pointercancel', () => { if (draggingSeek) finishSeek(); });
  muteButton.addEventListener('click', () => {
    if (video.muted || video.volume === 0) {
      video.muted = false;
      if (video.volume === 0) video.volume = 1;
    } else video.muted = true;
    syncVolume();
  });
  ['play', 'pause', 'ended'].forEach(name => video.addEventListener(name, syncPlayback));
  ['timeupdate', 'durationchange', 'loadedmetadata', 'ended', 'emptied'].forEach(name => video.addEventListener(name, syncTimeline));
  video.addEventListener('volumechange', syncVolume);
  video.addEventListener('loadedmetadata', () => {
    fullscreenButton.disabled = false;
    playButton.disabled = false;
    if (modal.open) setStatus('');
  });
  video.addEventListener('playing', () => {
    if (!modal.open) { video.pause(); return; }
    setStatus('');
  });
  video.addEventListener('error', () => {
    fullscreenButton.disabled = true;
    playButton.disabled = true;
    seek.disabled = true;
    syncPlayback();
    if (modal.open) setStatus('영상을 불러오지 못했습니다. 팝업을 닫고 아래 글로 읽어 주세요.');
  });

  fullscreenButton.addEventListener('click', async () => {
    if (isFullscreen() || modal.classList.contains('is-expanded')) {
      await exitFullscreen();
      modal.classList.remove('is-expanded');
      syncFullscreenButton();
      return;
    }
    try {
      // iPhone에서는 비디오 자체의 전체화면 재생기를 사용한다.
      if (video.webkitEnterFullscreen && !document.fullscreenEnabled) {
        video.webkitEnterFullscreen();
      } else if (panel.requestFullscreen && document.fullscreenEnabled) {
        await panel.requestFullscreen();
      } else if (panel.webkitRequestFullscreen) {
        panel.webkitRequestFullscreen();
      } else {
        modal.classList.add('is-expanded');
      }
    } catch {
      if (modal.open) modal.classList.add('is-expanded');
    }
    if (!modal.open) { await exitFullscreen(); return; }
    syncFullscreenButton();
  });
  document.addEventListener('fullscreenchange', syncFullscreenButton);
  document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
  video.addEventListener('webkitbeginfullscreen', syncFullscreenButton);
  video.addEventListener('webkitendfullscreen', syncFullscreenButton);
  window.addEventListener('pagehide', () => video.pause());
  syncTimeline();
  syncPlayback();
  syncVolume();
})();
