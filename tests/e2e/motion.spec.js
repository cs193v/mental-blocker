'use strict';
/* With full animations: timing-dependent behaviour that reduced motion would hide. */
const { test, expect, LEVELS, loadWithCompleted, recordPhases, openLevel, blocks, hud, expectedBlocks, cellCenter, slowAnimations, swipe, play, pointerFor, range } = require('./helpers');

test.use({ contextOptions: { reducedMotion: 'no-preference' } });

const phase = page => page.locator('#board').getAttribute('data-phase');

test.describe('with animations', () => {
  test('a block visibly slides between cells', async ({ page }, testInfo) => {
    await openLevel(page, 6);
    await slowAnimations(page, 0.1); // the 255ms slide now takes ~2.5s
    const start = await cellCenter(page, 2, 2);
    const end = await cellCenter(page, 2, 5);
    await swipe(page, 2, 2, 'R', { pointer: pointerFor(testInfo), settleAfter: false });
    expect(await phase(page)).toBe('animating');
    const mid = await page.locator('#board .block[data-r="2"][data-c="5"]').boundingBox();
    const midX = mid.x + mid.width / 2;
    expect(midX).toBeGreaterThan(start.x);
    expect(midX).toBeLessThan(end.x);
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle', { timeout: 10000 });
    const done = await page.locator('#board .block[data-r="2"][data-c="5"]').boundingBox();
    expect(Math.abs(done.x + done.width / 2 - end.x)).toBeLessThan(1);
  });

  test('a swipe made while a block is still sliding is ignored', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 6);
    await slowAnimations(page, 0.1);
    await swipe(page, 2, 2, 'R', { pointer, settleAfter: false }); // three cells: a long slide
    expect(await phase(page)).toBe('animating');
    await swipe(page, 0, 0, 'D', { pointer, settleAfter: false });
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle', { timeout: 10000 });
    expect(await blocks(page)).toEqual(expectedBlocks(6, ['2,2 R']));
    expect((await hud(page)).moves).toBe(1);
  });

  test('the board goes intro, idle, animating, ..., solved, then the next intro', async ({ page }, testInfo) => {
    await recordPhases(page);
    await openLevel(page, 2);
    await play(page, LEVELS[1].solution, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 3 OF ${LEVELS.length}`);
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
    expect(await page.evaluate(() => window.__phases)).toEqual(
      ['intro', 'idle', 'animating', 'idle', 'animating', 'solved', 'intro', 'idle']);
  });

  test('input during the intro is ignored', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await loadWithCompleted(page, range(1, 5));
    await slowAnimations(page, 0.2);
    await page.locator('#level-grid [data-level="6"]').click();
    expect(await phase(page)).toBe('intro');
    await swipe(page, 2, 2, 'D', { pointer, settleAfter: false });
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle', { timeout: 15000 });
    expect(await blocks(page)).toEqual(expectedBlocks(6));
    expect((await hud(page)).moves).toBe(0);
  });

  test('restart and the menu are ignored while a solved level is finishing', async ({ page }, testInfo) => {
    await openLevel(page, 1);
    await play(page, LEVELS[0].solution, { pointer: pointerFor(testInfo) });
    expect(await phase(page)).toBe('solved');
    await page.locator('#restart').click();
    await page.locator('#open-menu').click();
    await expect(page.locator('#level-select')).toBeHidden();
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 2 OF ${LEVELS.length}`);
  });
});
