'use strict';
const { test, expect, E, LEVELS, openLevel, hud } = require('./helpers');

test.describe('header and footer', () => {
  for (const n of [1, 6, 15, 21]) {
    test(`level ${n} starts with the right level, moves and zones`, async ({ page }) => {
      await openLevel(page, n);
      const def = LEVELS[n - 1];
      const zones = E.parseLevel(def.map).zones.length;
      expect(await hud(page)).toEqual({
        level: `LEVEL ${n} OF ${LEVELS.length}`,
        moves: 0,
        par: def.solution.length,
        movesText: `0/${def.solution.length} ${def.solution.length === 1 ? 'move' : 'moves'}`,
        overPar: false,
        zonesLeft: zones,
        zonesText: String(zones),
      });
      await expect(page.locator('.hud-zones .hud-label')).toHaveText('SAFE ZONES LEFT');
      await expect(page.locator('.instructions')).toHaveText('SLIDE A BLOCK ONTO EACH WHITE SAFE ZONE');
    });
  }

  test('choosing a level from the in-game menu starts it', async ({ page }) => {
    await openLevel(page, 6);
    await page.locator('#open-menu').click();
    await page.locator('#level-grid [data-level="3"]').click();
    await expect(page.locator('#level-select')).toBeHidden();
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 3 OF ${LEVELS.length}`);
    expect((await hud(page)).moves).toBe(0);
  });
});
