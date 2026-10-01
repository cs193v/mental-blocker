'use strict';
/* Levels solved through the real UI with their encoded solutions. */
const { test, expect, LEVELS, recordPhases, openLevel, hud, play, pointerFor, savedCompleted, range } = require('./helpers');

// The early levels, plus the last one for the "all levels complete" ending.
const SAMPLE = [1, 2, 3, 4, 5, 6, LEVELS.length];

test.describe('encoded solutions work in the browser', () => {
  SAMPLE.forEach(n => {
    const def = LEVELS[n - 1];
    test(`level ${n} (par ${def.solution.length})`, async ({ page }, testInfo) => {
      await recordPhases(page);
      await openLevel(page, n);
      await play(page, def.solution, { pointer: pointerFor(testInfo) });

      expect(await page.evaluate(() => window.__phases)).toContain('solved');
      expect((await hud(page)).moves).toBe(def.solution.length);
      await expect.poll(() => savedCompleted(page)).toEqual(range(1, n));

      if (n < LEVELS.length) {
        // The next level loads by itself, and is unlocked in the menu.
        await expect(page.locator('#level-label')).toHaveText(`LEVEL ${n + 1} OF ${LEVELS.length}`);
        await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
        expect((await hud(page)).moves).toBe(0);
        await page.locator('#open-menu').click();
        await expect(page.locator(`#level-grid [data-level="${n + 1}"]`)).toHaveAttribute('data-locked', 'false');
        await expect(page.locator(`#level-grid [data-level="${n}"]`)).toHaveAttribute('data-done', 'true');
      } else {
        await expect(page.locator('#message')).toBeVisible();
        await expect(page.locator('#message-text')).toContainText(`solved all ${LEVELS.length} levels`);
        await page.locator('#message-buttons button', { hasText: 'Level Select' }).click();
        await expect(page.locator('#level-select')).toBeVisible();
        await expect(page.locator('#level-grid [data-done="true"]')).toHaveCount(LEVELS.length);
      }
    });
  });
});
