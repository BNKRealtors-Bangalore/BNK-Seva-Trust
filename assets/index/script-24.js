/* Sitaram Sitaram • audio-only, autoplay-first music player.
   Browsers may block unmuted autoplay; retry synchronously on the first
   visitor gesture. User-initiated pause/stop persists for this tab's session.
   Loop at (duration - 3 seconds), without modifying the MP3 on disk. */
(() => {
  'use strict';
  const player = document.querySelector('.bnk-music-player');
  const audio = document.getElementById('bnkMusicAudio');
  const playButton = document.getElementById('bnkMusicPlay');
  const stopButton = document.getElementById('bnkMusicStop');
  const volumeDownButton = document.getElementById('bnkMusicVolumeDown');
  const volumeUpButton = document.getElementById('bnkMusicVolumeUp');
  const status = document.getElementById('bnkMusicStatus');
  if (!player || !audio || !playButton || !stopButton || !volumeDownButton || !volumeUpButton || !status) return;

  const PAUSE_KEY = 'bnk-sitaram-paused-in-session';
  const VOLUME_KEY = 'bnk-sitaram-volume';
  const TRIM_SECONDS = 5;
  let pausedByVisitor = false;
  let boundaryTimer = null;
  let attemptingPlay = false;
  let audioUnavailable = false;

  try { pausedByVisitor = sessionStorage.getItem(PAUSE_KEY) === '1'; }
  catch (_) { /* Session storage can be unavailable in private/restricted modes. */ }

  try {
    const storedVolume = sessionStorage.getItem(VOLUME_KEY);
    const savedVolume = storedVolume === null ? NaN : Number(storedVolume);
    if (Number.isFinite(savedVolume)) audio.volume = Math.min(1, Math.max(0, savedVolume));
    else audio.volume = 0.4;
  } catch (_) {
    audio.volume = 0.4;
  }

  const setVisitorPause = (paused) => {
    pausedByVisitor = paused;
    try {
      if (paused) sessionStorage.setItem(PAUSE_KEY, '1');
      else sessionStorage.removeItem(PAUSE_KEY);
    } catch (_) { /* Playback still works if storage is unavailable. */ }
  };

  const show = (message) => { status.textContent = message; };
  const volumePercent = () => Math.round(audio.volume * 100);
  const volumeMessage = () => `Volume ${volumePercent()}%`;
  const persistVolume = () => {
    try { sessionStorage.setItem(VOLUME_KEY, String(audio.volume)); }
    catch (_) { /* Volume still updates if storage is unavailable. */ }
  };
  const syncVolumeControls = () => {
    const percent = volumePercent();
    volumeDownButton.disabled = percent <= 0;
    volumeUpButton.disabled = percent >= 100;
    volumeDownButton.setAttribute('aria-label', `Lower music volume, currently ${percent}%`);
    volumeUpButton.setAttribute('aria-label', `Raise music volume, currently ${percent}%`);
  };
  const changeVolume = (delta) => {
    audio.volume = Math.min(1, Math.max(0, Number((audio.volume + delta).toFixed(2))));
    persistVolume();
    syncVolumeControls();
    show(volumeMessage());
  };
  const isPlaying = () => !audio.paused && !audio.ended;
  const sync = () => {
    const playing = isPlaying();
    player.classList.toggle('is-playing', playing);
    playButton.setAttribute('aria-label', (playing ? 'Pause' : 'Play') + ' Sitaram Sitaram');
    playButton.title = (playing ? 'Pause' : 'Play') + ' music';
    if (playing) show(`Now playing • ${volumeMessage()}`);
  };

  // Intentionally do not set audio.loop: its native loop would play the
  // last three seconds, whereas our custom loop restarts before them.
  audio.loop = false;
  audio.preload = 'auto';

  const loopCutoff = () => {
    const duration = audio.duration;
    if (!Number.isFinite(duration) || duration <= 0) return null;
    // For exceptionally short files, just loop normally.
    return duration > TRIM_SECONDS ? duration - TRIM_SECONDS : duration;
  };
  const clearBoundaryTimer = () => {
    if (boundaryTimer !== null) {
      clearTimeout(boundaryTimer);
      boundaryTimer = null;
    }
  };
  const jumpToBeginning = () => {
    if (pausedByVisitor) return;
    try { audio.currentTime = 0; }
    catch (_) { /* May not yet be seekable. */ }
  };
  const scheduleBoundary = () => {
    clearBoundaryTimer();
    if (!isPlaying() || pausedByVisitor) return;
    const cutoff = loopCutoff();
    if (cutoff === null) return;
    const secondsRemaining = cutoff - audio.currentTime;
    if (secondsRemaining <= 0.025) {
      jumpToBeginning();
      // Seek fires 'seeked' to schedule the next pass. For browsers that
      // do not fire it on a 0-second seek, schedule explicitly as well.
      if (audio.currentTime < 0.1) {
        boundaryTimer = setTimeout(scheduleBoundary, 100);
      }
      return;
    }
    boundaryTimer = setTimeout(() => {
      boundaryTimer = null;
      if (pausedByVisitor || !isPlaying()) return;
      if (audio.currentTime >= (loopCutoff() ?? Infinity) - 0.025) jumpToBeginning();
      scheduleBoundary();
    }, Math.max(20, Math.ceil(1000 * secondsRemaining / (audio.playbackRate || 1))));
  };

  const attemptPlayback = (reason = 'automatic') => {
    if (pausedByVisitor || audioUnavailable || isPlaying() || attemptingPlay) return;
    // The play() call must happen directly inside the user's click/tap/key
    // event to satisfy the browser's user-activation requirement.
    let result;
    try { result = audio.play(); }
    catch (error) { playbackFailure(error, reason); return; }
    attemptingPlay = true;
    if (result && typeof result.then === 'function') {
      result.then(() => {
        attemptingPlay = false;
        sync();
        scheduleBoundary();
      }).catch((error) => {
        attemptingPlay = false;
        playbackFailure(error, reason);
      });
    } else {
      attemptingPlay = false;
      sync();
      scheduleBoundary();
    }
  };

  const playbackFailure = (error, reason) => {
    sync();
    if (error && error.name === 'NotAllowedError') {
      show(reason === 'automatic' ? 'Tap anywhere to start music' : 'Tap Play to start music');
    } else if (error && error.name === 'AbortError') {
      // A rapid pause/stop cancels an in-flight play request; it is normal.
      if (pausedByVisitor) show('Paused');
    } else {
      audioUnavailable = true;
      show('Check audio/sitaram-sitaram.mp3');
      console.warn('BNK Sitaram player could not load the MP3:', error);
    }
  };

  const firstGesture = (event) => {
    if (pausedByVisitor || audioUnavailable || isPlaying()) return;
    // The player's own buttons handle their action; a first click on Stop
    // must not accidentally cause music to start in the capture phase.
    if (event.target?.closest?.('#bnkMusicPlay, #bnkMusicStop, #bnkMusicVolumeDown, #bnkMusicVolumeUp')) return;
    if (event.type === 'keydown' && (
      event.key === 'Tab' || event.key === 'Shift' || event.key === 'Control' ||
      event.key === 'Alt' || event.key === 'Meta' || event.repeat
    )) return;
    attemptPlayback('visitor-interaction');
  };
  // Capture ensures play() executes while user activation is still active.
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(type => {
    document.addEventListener(type, firstGesture, { capture: true, passive: true });
  });

  playButton.addEventListener('click', () => {
    if (isPlaying()) {
      setVisitorPause(true);
      clearBoundaryTimer();
      audio.pause();
      sync();
      show('Paused • tap Play to resume');
      return;
    }
    setVisitorPause(false); // Explicit Play overrides a previous pause.
    audioUnavailable = false;
    show('Loading music…');
    attemptPlayback('play-button');
  });

  stopButton.addEventListener('click', () => {
    setVisitorPause(true);
    clearBoundaryTimer();
    audio.pause();
    try { audio.currentTime = 0; } catch (_) {}
    sync();
    show('Stopped • tap Play to restart');
  });

  volumeDownButton.addEventListener('click', () => changeVolume(-0.1));
  volumeUpButton.addEventListener('click', () => changeVolume(0.1));
  audio.addEventListener('volumechange', syncVolumeControls);

  audio.addEventListener('playing', () => { sync(); scheduleBoundary(); });
  audio.addEventListener('pause', () => { clearBoundaryTimer(); sync(); });
  audio.addEventListener('loadedmetadata', scheduleBoundary);
  audio.addEventListener('durationchange', scheduleBoundary);
  audio.addEventListener('ratechange', scheduleBoundary);
  audio.addEventListener('seeked', scheduleBoundary);
  audio.addEventListener('timeupdate', () => {
    if (isPlaying() && !pausedByVisitor) {
      const cutoff = loopCutoff();
      if (cutoff !== null && audio.currentTime >= cutoff - 0.025) jumpToBeginning();
    }
  });
  audio.addEventListener('ended', () => {
    clearBoundaryTimer();
    if (!pausedByVisitor && !audioUnavailable) {
      // Fallback for background tabs that throttle JS timers.
      try { audio.currentTime = 0; } catch (_) {}
      attemptPlayback('auto-loop');
    } else sync();
  });
  audio.addEventListener('error', () => {
    audioUnavailable = true;
    clearBoundaryTimer();
    sync();
    show('Check audio/sitaram-sitaram.mp3');
  });

  if (pausedByVisitor) {
    show('Paused for this visit • tap Play');
    sync();
  } else {
    // Attempt immediately. If the browser refuses sound on page load,
    // the first visitor interaction above retries playback automatically.
    attemptPlayback('automatic');
  }
  syncVolumeControls();
})();
