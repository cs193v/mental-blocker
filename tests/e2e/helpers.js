/*
 * Shared end-to-end helpers. Tests drive the game only through real input (mouse, CDP touch,
 * keyboard) and read state only from the DOM hooks (data-* attributes and classes).
 */
'use strict';
const { test: base, expect } = require('@playwright/test');
const E = require('../../js/engine.js');
const LEVELS = require('../../js/levels.js');

const KEY = 'safezone.v1';

/* Every test fails if the page throws or logs a console error. */
const test = base.extend({
  page: async ({ page }, use) => {
    const errors = [];
    page.on('pageerror', e => errors.push(`pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error') errors.push(`console.error: ${m.text()}`); });
    await use(page);
    expect(errors, 'the page logged no errors').toEqual([]);
  },
});

/* Loads the game with the given raw saved progress (null clears it). */
async function load(page, raw) {
  await page.goto('/');
  await page.evaluate(([key, value]) => {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  }, [KEY, raw]);
  await page.reload();
}

const loadWithCompleted = (page, completed) => load(page, JSON.stringify({ completed }));
const range = (a, b) => Array.from({ length: Math.max(0, b - a + 1) }, (_, i) => a + i);

/* Records every value #board[data-phase] takes, into window.__phases. */
async function recordPhases(page) {
  await page.addInitScript(() => {
    window.__phases = [];
    document.addEventListener('DOMContentLoaded', () => {
      const board = document.querySelector('#board');
      new MutationObserver(() => {
        const p = board.dataset.phase;
        if (window.__phases[window.__phases.length - 1] !== p) window.__phases.push(p);
      }).observe(board, { attributes: true, attributeFilter: ['data-phase'] });
    });
  });
}

/* Opens level n from the menu the way a player would: earlier levels are marked completed. */
async function openLevel(page, n, { completed = range(1, n - 1), goto = true } = {}) {
  if (goto) await loadWithCompleted(page, completed);
  await page.locator(`#level-grid [data-level="${n}"]`).click();
  await expect(page.locator('#level-label')).toHaveText(`LEVEL ${n} OF ${LEVELS.length}`);
  await waitIdle(page);
}

async function waitIdle(page) {
  await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
}

/* Waits until no block is mid-slide. */
async function settle(page) {
  await page.waitForFunction(() => {
    const p = document.querySelector('#board').dataset.phase;
    return p !== 'animating' && p !== 'intro';
  });
}

/* Block positions from the DOM, as sorted [r, c] pairs. */
async function blocks(page) {
  const list = await page.$$eval('#board .block', els => els.map(e => [+e.dataset.r, +e.dataset.c]));
  return list.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/* Block positions per DOM element, in DOM order (to check which block moved). */
const blockElements = page => page.$$eval('#board .block', els => els.map(e => `${e.dataset.r},${e.dataset.c}`));

async function hud(page) {
  return page.evaluate(() => ({
    level: document.querySelector('#level-label').textContent,
    moves: +document.querySelector('#moves').dataset.moves,
    par: +document.querySelector('#moves').dataset.par,
    movesText: document.querySelector('#moves').textContent,
    overPar: document.querySelector('#moves').classList.contains('over-par'),
    zonesLeft: +document.querySelector('#zones-left').dataset.zonesLeft,
    zonesText: document.querySelector('#zones-left').textContent,
  }));
}

/* What the engine says the blocks should be after `moves` on level n, as sorted [r, c] pairs. */
function expectedBlocks(n, moves = []) {
  const level = E.parseLevel(LEVELS[n - 1].map);
  return E.replay(level, moves).map(i => E.toRC(level, i)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

/* Screen coordinates of the centre of cell (r, c), and the cell size. */
function cellCenter(page, r, c) {
  return page.locator('#board').evaluate((board, [r, c]) => {
    const rect = board.getBoundingClientRect();
    const cell = parseFloat(board.style.getPropertyValue('--cell'));
    return { x: rect.left + (c + 0.5) * cell, y: rect.top + (r + 0.5) * cell, cell };
  }, [r, c]);
}

const DIR_VECTORS = { U: [0, -1], D: [0, 1], L: [-1, 0], R: [1, 0] };

const cdpSessions = new WeakMap();
async function cdp(page) {
  if (!cdpSessions.has(page)) cdpSessions.set(page, await page.context().newCDPSession(page));
  return cdpSessions.get(page);
}

/* Slows every Web Animation on the page (1 = normal), so timing tests don't depend on machine speed. */
async function slowAnimations(page, rate) {
  const session = await cdp(page);
  await session.send('Animation.enable');
  await session.send('Animation.setPlaybackRate', { playbackRate: rate });
}

/* A drag from `from` to `to` in `steps` moves, by mouse or by real (CDP) touch events. */
async function drag(page, from, to, { pointer = 'mouse', steps = 6 } = {}) {
  const points = range(1, steps).map(i => ({ x: from.x + ((to.x - from.x) * i) / steps, y: from.y + ((to.y - from.y) * i) / steps }));
  if (pointer === 'touch') {
    const session = await cdp(page);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
    for (const p of points) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [p] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } else {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (const p of points) await page.mouse.move(p.x, p.y);
    await page.mouse.up();
  }
}

/* Swipes from the centre of cell (r, c) in `dir` (U/D/L/R) by `cells` cells. */
async function swipe(page, r, c, dir, { pointer = 'mouse', cells = 0.9, settleAfter = true } = {}) {
  const from = await cellCenter(page, r, c);
  const [dx, dy] = DIR_VECTORS[dir];
  await drag(page, from, { x: from.x + dx * from.cell * cells, y: from.y + dy * from.cell * cells }, { pointer });
  if (settleAfter) await settle(page);
}

/* Taps or clicks the centre of cell (r, c). */
async function tap(page, r, c, { pointer = 'mouse' } = {}) {
  const p = await cellCenter(page, r, c);
  if (pointer === 'touch') await page.touchscreen.tap(p.x, p.y);
  else await page.mouse.click(p.x, p.y);
}

/* Plays a list of "r,c D" moves by swiping. */
async function play(page, moves, opts = {}) {
  for (const m of moves) {
    const [, r, c, dir] = /^(\d+),(\d+) ([UDLR])$/.exec(m);
    await swipe(page, +r, +c, dir, opts);
  }
}

const pointerFor = testInfo => (testInfo.project.name === 'mobile' ? 'touch' : 'mouse');

const savedProgress = page => page.evaluate(key => localStorage.getItem(key), KEY);
const savedCompleted = async page => {
  const raw = await savedProgress(page);
  return raw ? JSON.parse(raw).completed : [];
};

module.exports = {
  test, expect, E, LEVELS, KEY, load, loadWithCompleted, range, recordPhases, openLevel, waitIdle, settle,
  blocks, blockElements, hud, expectedBlocks, cellCenter, slowAnimations, drag, swipe, tap, play, pointerFor,
  savedProgress, savedCompleted,
};
