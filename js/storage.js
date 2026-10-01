/*
 * Level progress, saved in localStorage as {"completed": [1, 2, ...]}, and the sound on/off choice,
 * saved separately as "on" or "off". Every failure (storage disabled, quota, corrupt data) degrades
 * to the defaults (no saved progress, sound on) rather than an error.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SafeZoneStorage = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const KEY = 'safezone.v1';
  const SOUND_KEY = 'safezone.sound';

  function parseProgress(text) {
    try {
      const data = JSON.parse(text);
      if (data && Array.isArray(data.completed)) {
        return new Set(data.completed.filter(n => Number.isInteger(n) && n >= 1));
      }
    } catch (e) { /* corrupt: fall through */ }
    return new Set();
  }

  function load(storage) {
    try { return storage ? parseProgress(storage.getItem(KEY)) : new Set(); } catch (e) { return new Set(); }
  }

  function save(storage, completed) {
    try {
      if (storage) storage.setItem(KEY, JSON.stringify({ completed: [...completed].sort((a, b) => a - b) }));
    } catch (e) { /* progress still lives in memory for this session */ }
  }

  const isUnlocked = (n, completed) => n === 1 || completed.has(n - 1);

  function loadSoundOn(storage) {
    try { return !storage || storage.getItem(SOUND_KEY) !== 'off'; } catch (e) { return true; }
  }

  function saveSoundOn(storage, on) {
    try {
      if (storage) storage.setItem(SOUND_KEY, on ? 'on' : 'off');
    } catch (e) { /* the choice still holds for this session */ }
  }

  return { KEY, SOUND_KEY, parseProgress, load, save, isUnlocked, loadSoundOn, saveSoundOn };
});
