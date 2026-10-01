'use strict';
const { test, expect, LEVELS, openLevel, blocks, hud, expectedBlocks, play, pointerFor, savedCompleted } = require('./helpers');

// Level 2 (par 2): up and back down wastes two moves, then the real solution.
const WASTEFUL = ['2,0 U', '0,0 D', ...LEVELS[1].solution];

test.describe('going over par', () => {
  test('solving over par shows the retry message', async ({ page }, testInfo) => {
    await openLevel(page, 2);
    await play(page, WASTEFUL, { pointer: pointerFor(testInfo) });
    expect(await hud(page)).toMatchObject({ moves: 4, overPar: true, zonesLeft: 0 });
    await expect(page.locator('#message')).toBeVisible();
    await expect(page.locator('#message-text')).toContainText('2 moves');
    await expect(page.locator('#message-buttons button')).toHaveText(['Retry Level', 'Level Select']);
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 2 OF ${LEVELS.length}`);
  });

  test('Retry Level resets the level', async ({ page }, testInfo) => {
    await openLevel(page, 2);
    await play(page, WASTEFUL, { pointer: pointerFor(testInfo) });
    await page.locator('#message-buttons button', { hasText: 'Retry Level' }).click();
    await expect(page.locator('#message')).toBeHidden();
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
    expect(await blocks(page)).toEqual(expectedBlocks(2));
    expect(await hud(page)).toMatchObject({ moves: 0, overPar: false, zonesLeft: 1 });

    // And now solving it in par works.
    await play(page, LEVELS[1].solution, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#level-label')).toHaveText(`LEVEL 3 OF ${LEVELS.length}`);
    expect(await savedCompleted(page)).toEqual([1, 2]);
  });

  test('Level Select goes back to the menu', async ({ page }, testInfo) => {
    await openLevel(page, 2);
    await play(page, WASTEFUL, { pointer: pointerFor(testInfo) });
    await page.locator('#message-buttons button', { hasText: 'Level Select' }).click();
    await expect(page.locator('#message')).toBeHidden();
    await expect(page.locator('#level-select')).toBeVisible();
    await expect(page.locator('#level-select')).toHaveClass(/as-menu/);
    await expect(page.locator('#level-cancel')).toBeHidden();
    await expect(page.locator('#game')).toBeHidden();
  });

  test('replaying a completed level over par keeps it completed', async ({ page }, testInfo) => {
    await openLevel(page, 2, { completed: [1, 2] });
    await play(page, WASTEFUL, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#message')).toBeVisible();
    expect(await savedCompleted(page)).toEqual([1, 2]);
    await page.locator('#message-buttons button', { hasText: 'Level Select' }).click();
    await expect(page.locator('#level-grid [data-level="2"]')).toHaveAttribute('data-done', 'true');
    await expect(page.locator('#level-grid [data-level="3"]')).toHaveAttribute('data-locked', 'false');
  });

  test('the message buttons work from the keyboard', async ({ page }, testInfo) => {
    await openLevel(page, 2);
    await play(page, WASTEFUL, { pointer: pointerFor(testInfo) });
    await expect(page.locator('#message-buttons button').first()).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#message')).toBeHidden();
    expect((await hud(page)).moves).toBe(0);
  });
});
