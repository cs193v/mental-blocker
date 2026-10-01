'use strict';
/*
 * The swipe sound. Headless Chromium allows audio without a gesture, so these tests log the
 * game's own play() calls rather than relying on the browser to block anything.
 */
const { test, expect, openLevel, swipe, pointerFor } = require('./helpers');

const SOUND_KEY = 'safezone.sound';

/* Logs every media play() by file name. */
async function recordAudio(page) {
  await page.addInitScript(() => {
    const log = window.__audio = { plays: [] };
    const { play } = HTMLMediaElement.prototype;
    HTMLMediaElement.prototype.play = function () {
      log.plays.push(this.src.split('/').pop());
      return play.call(this);
    };
  });
}

const plays = (page, file) => page.evaluate(f => window.__audio.plays.filter(p => p === f).length, file);

const soundButton = page => page.locator('#sound');

test.describe('sound', () => {
  test.beforeEach(async ({ page }) => { await recordAudio(page); });

  test('every slide plays the swipe sound once', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 2); // one block at 2,0
    const start = await plays(page, 'Swipe.wav');
    await swipe(page, 2, 0, 'R', { pointer });
    expect(await plays(page, 'Swipe.wav')).toBe(start + 1);
    await swipe(page, 2, 1, 'L', { pointer });
    expect(await plays(page, 'Swipe.wav')).toBe(start + 2);
  });

  test('the sound button turns sound off and on, and the choice is saved', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 2);
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');

    await soundButton(page).click();
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(key => localStorage.getItem(key), SOUND_KEY)).toBe('off');
    const muted = await plays(page, 'Swipe.wav');
    await swipe(page, 2, 0, 'R', { pointer });
    expect(await plays(page, 'Swipe.wav')).toBe(muted);

    await soundButton(page).click();
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(key => localStorage.getItem(key), SOUND_KEY)).toBe('on');
    await swipe(page, 2, 1, 'L', { pointer });
    expect(await plays(page, 'Swipe.wav')).toBe(muted + 1);
  });

  test('after a reload with sound off, nothing plays until sound is turned back on', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await page.goto('/');
    await page.evaluate(key => localStorage.setItem(key, 'off'), SOUND_KEY);
    await openLevel(page, 2); // reloads, with level 1 completed
    await expect(soundButton(page)).toHaveAttribute('aria-pressed', 'false');
    await swipe(page, 2, 0, 'R', { pointer });
    expect(await page.evaluate(() => window.__audio.plays)).toEqual([]);

    await soundButton(page).click();
    const before = await plays(page, 'Swipe.wav');
    await swipe(page, 2, 1, 'L', { pointer });
    expect(await plays(page, 'Swipe.wav')).toBe(before + 1);
  });
});
