'use strict';
const { test, expect, LEVELS, loadWithCompleted, openLevel, swipe, play, pointerFor, range } = require('./helpers');

// The level with the most rows (the first, if there is a tie).
const BIGGEST = LEVELS.map((d, i) => ({ n: i + 1, rows: d.map.length })).sort((a, b) => b.rows - a.rows || a.n - b.n)[0].n;

async function box(page, sel) {
  return page.locator(sel).evaluate(e => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
}

async function expectBoardFits(page, label) {
  const vw = await page.evaluate(() => ({ w: innerWidth, h: innerHeight }));
  const board = await box(page, '#board');
  const instructions = await box(page, '.instructions');
  const controls = await box(page, '.controls');
  expect(board.left, `${label}: left edge`).toBeGreaterThanOrEqual(0);
  expect(board.right, `${label}: right edge`).toBeLessThanOrEqual(vw.w);
  expect(board.top, `${label}: below the instructions`).toBeGreaterThanOrEqual(instructions.bottom);
  expect(board.bottom, `${label}: above the footer`).toBeLessThanOrEqual(controls.top);
  const scroll = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  expect(scroll.sw, `${label}: no horizontal scrollbar`).toBeLessThanOrEqual(scroll.cw);
}

test.describe('layout', () => {
  test('every level fits on screen without overlapping the header or footer', async ({ page }) => {
    await loadWithCompleted(page, range(1, LEVELS.length));
    for (const n of range(1, LEVELS.length)) {
      await page.locator('#level-grid [data-level]').first().waitFor();
      await openLevel(page, n, { goto: false });
      await expectBoardFits(page, `level ${n}`);
      await page.locator('#open-menu').click();
    }
  });

  test('the largest levels still fit on a phone held sideways', async ({ page }) => {
    await page.setViewportSize({ width: 740, height: 360 });
    await loadWithCompleted(page, range(1, LEVELS.length));
    await openLevel(page, BIGGEST, { goto: false });
    await expectBoardFits(page, `level ${BIGGEST} sideways`);
  });

  test('the board resizes with the window', async ({ page }) => {
    await openLevel(page, BIGGEST);
    const before = await box(page, '#board');
    await page.setViewportSize({ width: 320, height: 440 });
    await expect.poll(async () => (await box(page, '#board')).bottom - (await box(page, '#board')).top).toBeLessThan(before.bottom - before.top);
    await expectBoardFits(page, 'after resize');
  });

  test('screenshots for comparing with the original', async ({ page }, testInfo) => {
    const shot = async name => {
      const path = testInfo.outputPath(`${name}.png`);
      await page.screenshot({ path });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    };
    await loadWithCompleted(page, [1, 2, 3, 4, 5]);
    await shot('menu');
    await openLevel(page, 6, { goto: false });
    await swipe(page, 2, 2, 'D', { pointer: pointerFor(testInfo) });
    await swipe(page, 0, 0, 'D', { pointer: pointerFor(testInfo) });
    await shot('level-in-progress');
    await page.locator('#restart').click();
    // One move over par: the solution with 2,2 D taken the long way, via the zone above it.
    const detour = LEVELS[5].solution.flatMap(m => (m === '2,2 D' ? ['2,2 U', '1,2 D'] : [m]));
    await play(page, detour, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#message')).toBeVisible();
    await shot('over-par');
  });
});
