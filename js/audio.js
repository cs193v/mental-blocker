/*
 * Sound: the swipe effect. Browsers only allow audio after a user gesture, so the first press or
 * key press unlocks it. This is a plain <audio> element rather than Web Audio, so the game still
 * works when index.html is opened from disk.
 */
(function () {
  'use strict';

  const Store = window.SafeZoneStorage;

  const GESTURES = ['pointerdown', 'pointerup', 'keydown'];

  const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  let soundOn = Store.loadSoundOn(storage);
  let unlocked = false; // the swipe has been played once from a gesture

  // play() rejects when the browser blocks it or a pause() interrupts it; neither is an error here.
  const playQuietly = el => el.play().catch(() => {});

  const swipe = new Audio('audio/Swipe.wav');
  swipe.preload = 'auto';

  function unlock() {
    if (unlocked || !soundOn) return;
    // Playing the swipe once inside a gesture lets iOS play it later from pointermove.
    playQuietly(swipe);
    if (swipe.paused) return; // blocked: try again on the next gesture
    swipe.pause();
    unlocked = true;
    GESTURES.forEach(type => document.removeEventListener(type, unlock, true));
  }

  GESTURES.forEach(type => document.addEventListener(type, unlock, true));

  function playSwipe() {
    if (!soundOn) return;
    swipe.currentTime = 0;
    playQuietly(swipe);
  }

  /* Turns sound on or off and remembers the choice. */
  function setSoundOn(on) {
    soundOn = on;
    Store.saveSoundOn(storage, on);
    if (on) unlock();
    else swipe.pause();
  }

  window.SafeZoneAudio = { playSwipe, isSoundOn: () => soundOn, setSoundOn };
})();
