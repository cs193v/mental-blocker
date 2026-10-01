'use strict';
const { test, expect, LEVELS, KEY, load, loadWithCompleted, range, openLevel, play, pointerFor, savedCompleted } = require('./helpers');

const tile = (page, n) => page.locator(`#level-grid [data-level="${n}"]`);

async function lockedLevels(page) {
  return page.$$eval('#level-grid .level-tile', els => els.filter(e => e.dataset.locked === 'true').map(e => +e.dataset.level));
}

test.describe('menu', () => {
  test(`a fresh load shows the ${LEVELS.length} levels in 3 rows of 7, with no Cancel`, async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#level-select')).toBeVisible();
    await expect(page.locator('#level-select-title')).toHaveText('Select a Level');
    await expect(page.locator('#game')).toBeHidden();
    await expect(page.locator('#level-cancel')).toBeHidden();

    const tiles = page.locator('#level-grid .level-tile');
    await expect(tiles).toHaveCount(LEVELS.length);
    await expect(tiles).toHaveText(range(1, LEVELS.length).map(String));

    const boxes = await tiles.evaluateAll(els => els.map(e => e.getBoundingClientRect()).map(r => ({ x: Math.round(r.x), y: Math.round(r.y) })));
    const rows = [...new Set(boxes.map(b => b.y))];
    const cols = [...new Set(boxes.map(b => b.x))];
    expect(rows).toHaveLength(3);
    expect(cols).toHaveLength(7);
    // Numbered left to right, top to bottom.
    boxes.forEach((b, i) => {
      expect(b.y).toBe(rows[Math.floor(i / 7)]);
      expect(b.x).toBe(cols[i % 7]);
    });
  });

  test('only level 1 is unlocked at first', async ({ page }) => {
    await page.goto('/');
    expect(await lockedLevels(page)).toEqual(range(2, LEVELS.length));
    await expect(tile(page, 5)).toHaveAttribute('aria-disabled', 'true');
    await expect(tile(page, 1)).not.toHaveAttribute('aria-disabled', 'true');

    await tile(page, 1).click();
    await expect(page.locator('#game')).toBeVisible();
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 1 OF ${LEVELS.length}`);
  });

  test('clicking a locked level shakes it and stays on the menu', async ({ page }) => {
    await page.goto('/');
    await tile(page, 5).click({ force: true }); // aria-disabled tiles are still clickable for a real user
    await expect(tile(page, 5)).toHaveClass(/shake/);
    await expect(page.locator('#level-select')).toBeVisible();
    await expect(page.locator('#game')).toBeHidden();
  });

  test('completed levels unlock the next one and show a done mark', async ({ page }) => {
    await loadWithCompleted(page, [1, 2, 3, 4, 5]);
    expect(await lockedLevels(page)).toEqual(range(7, LEVELS.length));
    for (const n of range(1, 5)) {
      await expect(tile(page, n)).toHaveAttribute('data-done', 'true');
      await expect(tile(page, n).locator('.done')).toBeVisible();
    }
    await expect(tile(page, 6)).toHaveAttribute('data-done', 'false');
    await expect(tile(page, 7).locator('.lock')).toBeVisible();
  });

  test('unlocking depends on the previous level only', async ({ page }) => {
    await loadWithCompleted(page, [1, 7]);
    expect(await lockedLevels(page)).toEqual([3, 4, 5, 6, 7, ...range(9, LEVELS.length)]);
  });

  for (const [what, raw] of [['corrupt JSON', '{oops'], ['the wrong shape', '{"completed":"everything"}']]) {
    test(`saved progress with ${what} counts as no progress`, async ({ page }) => {
      await load(page, raw);
      expect(await lockedLevels(page)).toEqual(range(2, LEVELS.length));
    });
  }

  test('a localStorage that throws still lets you play, with progress kept for the session', async ({ page }, testInfo) => {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('denied', 'SecurityError'); } });
    });
    await page.goto('/');
    expect(await lockedLevels(page)).toEqual(range(2, LEVELS.length));
    await openLevel(page, 1, { goto: false });
    await play(page, LEVELS[0].solution, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 2 OF ${LEVELS.length}`);
    await page.locator('#open-menu').click();
    expect(await lockedLevels(page)).toEqual(range(3, LEVELS.length));
  });

  test('progress survives a reload', async ({ page }, testInfo) => {
    await page.goto('/');
    await openLevel(page, 1, { goto: false });
    await play(page, LEVELS[0].solution, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 2 OF ${LEVELS.length}`);
    expect(await savedCompleted(page)).toEqual([1]);

    await page.reload();
    await expect(page.locator('#level-select')).toBeVisible();
    expect(await lockedLevels(page)).toEqual(range(3, LEVELS.length));
    await expect(tile(page, 1)).toHaveAttribute('data-done', 'true');
    expect(await page.evaluate(k => localStorage.getItem(k), KEY)).toBe('{"completed":[1]}');
  });

  test('the menu works from the keyboard', async ({ page }) => {
    await loadWithCompleted(page, [1, 2]);
    await page.keyboard.press('Tab');
    await expect(tile(page, 1)).toBeFocused();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(tile(page, 3)).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 3 OF ${LEVELS.length}`);
  });
});
