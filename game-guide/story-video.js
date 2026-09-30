(() => {
  'use strict';
  const byId = (id) => document.getElementById(id);
  const opener = byId('storyVideoOpen');
  const modal = byId('storyVideoModal');
  const panel = byId('storyVideoPanel');
  const screen = byId('storyVideoScreen');
  const video = byId('storyVideo');
  const closeButton = byId('storyVideoClose');
  const fullscreenButton = byId('storyVideoFullscreen');
  const status = byId('storyVideoStatus');
  const loader = byId('storyVideoLoading');
  const playButton = byId('storyVideoPlay');
  const playLabel = byId('storyVideoPlayLabel');
  const seek = byId('storyVideoSeek');
  const currentTime = byId('storyVideoCurrentTime');
  const totalTime = byId('storyVideoDuration');
  const muteButton = byId('storyVideoMute');
  const volume = byId('storyVideoVolume');
  const volumeValue = byId('storyVideoVolumeValue');
  const speed = byId('storyVideoSpeed');
  if (![opener, modal, panel, screen, video, closeButton, fullscreenButton, status,
    loader, playButton, playLabel, seek, currentTime, totalTime, muteButton, volume,
    volumeValue, speed].every(Boolean)) return;

  let previousFocus = null;
  let pointerStartedOnBackdrop = false;
  let playbackAttempt = 0;
  let wantsPlayback = false;
  let draggingSeek = false;
  let chosenRate = 1;
  let chosenVolume = video.volume;
  let lastNonzeroVolume = chosenVolume || 1;
  let audioContext = null;
  let gainNode = null;
  let volumeSupported = true;
  const initialVolume = video.volume;
  try {
    video.volume = 0.5;
    volumeSupported = Math.abs(video.volume - 0.5) < 0.01;
    video.volume = initialVolume;
  } catch { volumeSupported = false; }

  video.autoplay = false;
  video.removeAttribute('autoplay');
  video.controls = false;
  const setStatus = (message) => { if (status.textContent !== message) status.textContent = message; };
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
    seek.style.setProperty('--range-progress', `${length ? Math.min(100, Math.max(0, position / length * 100)) : 0}%`);
  };
  const syncPlayback = () => {
    const playing = wantsPlayback || (!video.paused && !video.ended);
    const label = playing ? '일시정지' : video.ended ? '다시 재생' : '재생';
    playButton.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-label', label);
    playButton.title = label;
    playLabel.textContent = label;
    playButton.disabled = Boolean(video.error);
    fullscreenButton.disabled = video.readyState < 1 || Boolean(video.error);
  };
  const refreshLoading = () => {
    const loading = modal.open && !video.error &&
      (video.readyState < 2 || video.seeking || (wantsPlayback && video.readyState < 3));
    loader.hidden = !loading;
    screen.setAttribute('aria-busy', String(loading));
  };
  const describePlayback = () => {
    if (!modal.open || video.error) return;
    if (video.ended) setStatus('재생이 끝났습니다.');
    else if (wantsPlayback || !video.paused) setStatus('');
    else if (video.currentTime > 0) setStatus('재생 버튼을 누르면 이어집니다.');
    else setStatus('재생 버튼을 눌러 시작하세요.');
  };
  const syncVolume = () => {
    if (volumeSupported && !gainNode) chosenVolume = video.volume;
    const effective = video.muted ? 0 : chosenVolume;
    if (gainNode) gainNode.gain.value = effective;
    if (chosenVolume > 0) lastNonzeroVolume = chosenVolume;
    const muted = effective === 0;
    muteButton.classList.toggle('is-muted', muted);
    muteButton.setAttribute('aria-label', muted ? '음소거 해제' : '음소거');
    muteButton.setAttribute('aria-pressed', String(muted));
    muteButton.title = muted ? '음소거 해제' : '음소거';
    const percent = Math.round(effective * 100);
    volume.value = String(percent);
    volumeValue.textContent = `${percent}%`;
    volume.setAttribute('aria-valuetext', `${percent}%`);
    volume.style.setProperty('--range-progress', `${percent}%`);
  };
  const resumeAudio = () => {
    if (audioContext && audioContext.state !== 'running') {
      void audioContext.resume().catch(() => {
        if (modal.open) setStatus('소리가 나지 않으면 재생 버튼을 다시 눌러 주세요.');
      });
    }
  };
  const ensureVolumeGain = () => {
    if (gainNode) return true;
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    const url = new URL(video.currentSrc || video.src || window.TTOK_STORY_VIDEO_SRC || 'assets/story-background.mp4', document.baseURI);
    // iOS의 읽기 전용 volume은 같은 출처 영상에 한해 Web Audio로 조절한다.
    // CORS가 확인되지 않은 외부 영상은 오디오 그래프에 연결하지 않는다.
    if (!AudioContextType || url.origin !== location.origin || location.protocol === 'file:') return false;
    try {
      audioContext = new AudioContextType();
      gainNode = audioContext.createGain();
      gainNode.gain.value = video.muted ? 0 : chosenVolume;
      gainNode.connect(audioContext.destination);
      audioContext.createMediaElementSource(video).connect(gainNode);
      resumeAudio();
      return true;
    } catch {
      gainNode = null;
      if (audioContext) void audioContext.close().catch(() => {});
      audioContext = null;
      return false;
    }
  };
  const applyVolume = (value) => {
    const next = Math.min(1, Math.max(0, value));
    if (!volumeSupported && !ensureVolumeGain()) {
      volume.disabled = true;
      volume.title = '이 기기에서는 본체 음량 버튼을 사용해 주세요.';
      setStatus('음량은 기기 옆면의 음량 버튼으로 조절해 주세요.');
      syncVolume();
      return;
    }
    chosenVolume = next;
    if (volumeSupported) video.volume = next;
    video.muted = next === 0;
    resumeAudio();
    syncVolume();
  };
  const applyRate = () => {
    video.defaultPlaybackRate = chosenRate;
    video.playbackRate = chosenRate;
    if ('preservesPitch' in video) video.preservesPitch = true;
    if ('webkitPreservesPitch' in video) video.webkitPreservesPitch = true;
    speed.value = String(chosenRate);
  };
  const pausePlayback = () => {
    ++playbackAttempt;
    wantsPlayback = false;
    video.pause();
    syncPlayback();
    refreshLoading();
    describePlayback();
  };
  const requestPlayback = async () => {
    if (!modal.open || video.error) return;
    const attempt = ++playbackAttempt;
    wantsPlayback = true;
    if (video.ended) video.currentTime = 0;
    applyRate();
    resumeAudio();
    syncPlayback();
    refreshLoading();
    setStatus('');
    try { await video.play(); }
    catch (error) {
      if (playbackAttempt !== attempt || !modal.open) return;
      wantsPlayback = false;
      if (!video.error && error.name !== 'AbortError') {
        setStatus(error.name === 'NotAllowedError' ? '아래 재생 버튼을 다시 눌러 주세요.' : '재생하지 못했습니다. 재생 버튼을 다시 눌러 주세요.');
      }
    }
    if (!modal.open || !wantsPlayback) video.pause();
    syncPlayback();
    refreshLoading();
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
      } else if (video.webkitDisplayingFullscreen && video.webkitExitFullscreen) video.webkitExitFullscreen();
    } catch { /* 이미 전체화면이 종료되었어도 팝업은 닫는다. */ }
  };
  const openVideo = () => {
    if (modal.open) return;
    previousFocus = document.activeElement;
    // 팝업 열기는 재생 요청과 분리한다. 다시 열어도 반드시 일시정지 상태다.
    ++playbackAttempt;
    wantsPlayback = false;
    video.pause();
    modal.showModal();
    document.documentElement.classList.add('story-video-is-open');
    opener.setAttribute('aria-expanded', 'true');
    closeButton.focus({ preventScroll: true });
    const source = String(window.TTOK_STORY_VIDEO_SRC || 'assets/story-background.mp4').trim();
    if (!video.getAttribute('src') || video.error || video.getAttribute('src') !== source) {
      draggingSeek = false;
      video.preload = 'auto';
      video.src = source;
      video.load();
    }
    syncTimeline(); syncPlayback(); syncVolume(); refreshLoading(); describePlayback();
  };
  const closeVideo = () => {
    draggingSeek = false;
    pausePlayback();
    if (modal.open) modal.close();
  };
  modal.addEventListener('close', () => {
    // 빠르게 닫고 다시 연 경우 이전 close 이벤트가 새 팝업을 닫지 않게 한다.
    if (modal.open) return;
    pausePlayback();
    void exitFullscreen();
    loader.hidden = true;
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
    if (wantsPlayback || (!video.paused && !video.ended)) pausePlayback();
    else void requestPlayback();
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
    if (video.muted || chosenVolume === 0) applyVolume(chosenVolume || lastNonzeroVolume);
    else { video.muted = true; syncVolume(); }
  });
  volume.addEventListener('input', () => applyVolume(Number(volume.value) / 100));
  speed.addEventListener('change', () => { chosenRate = Number(speed.value); applyRate(); });
  video.addEventListener('ratechange', () => { chosenRate = video.playbackRate; speed.value = String(chosenRate); });
  video.addEventListener('volumechange', syncVolume);
  video.addEventListener('play', () => {
    if (!modal.open) { pausePlayback(); return; }
    wantsPlayback = true; syncPlayback(); refreshLoading(); describePlayback();
  });
  video.addEventListener('pause', () => {
    wantsPlayback = false; syncPlayback(); refreshLoading(); describePlayback();
  });
  video.addEventListener('ended', () => {
    wantsPlayback = false; syncPlayback(); syncTimeline(); refreshLoading(); describePlayback();
  });
  ['timeupdate', 'durationchange', 'emptied'].forEach(name => video.addEventListener(name, syncTimeline));
  video.addEventListener('loadedmetadata', () => { applyRate(); syncTimeline(); syncPlayback(); refreshLoading(); });
  ['loadeddata', 'canplay', 'seeked'].forEach(name => video.addEventListener(name, () => {
    refreshLoading(); describePlayback();
  }));
  ['loadstart', 'waiting', 'stalled', 'seeking'].forEach(name => video.addEventListener(name, refreshLoading));
  video.addEventListener('playing', () => {
    if (!modal.open) { pausePlayback(); return; }
    refreshLoading(); setStatus('');
  });
  video.addEventListener('error', () => {
    wantsPlayback = false;
    loader.hidden = true;
    screen.setAttribute('aria-busy', 'false');
    syncPlayback(); syncTimeline();
    if (modal.open) setStatus('영상을 불러오지 못했습니다. 팝업을 닫고 다시 열어 주세요.');
  });
  fullscreenButton.addEventListener('click', async () => {
    if (isFullscreen() || modal.classList.contains('is-expanded')) {
      await exitFullscreen(); modal.classList.remove('is-expanded'); syncFullscreenButton(); return;
    }
    try {
      if (panel.requestFullscreen && document.fullscreenEnabled) await panel.requestFullscreen();
      else if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
      else if (panel.webkitRequestFullscreen) panel.webkitRequestFullscreen();
      else modal.classList.add('is-expanded');
    } catch { if (modal.open) modal.classList.add('is-expanded'); }
    if (!modal.open) { await exitFullscreen(); return; }
    syncFullscreenButton();
  });
  document.addEventListener('fullscreenchange', syncFullscreenButton);
  document.addEventListener('webkitfullscreenchange', syncFullscreenButton);
  video.addEventListener('webkitbeginfullscreen', syncFullscreenButton);
  video.addEventListener('webkitendfullscreen', syncFullscreenButton);
  window.addEventListener('pagehide', pausePlayback);
  syncTimeline(); syncPlayback(); syncVolume();
})();
