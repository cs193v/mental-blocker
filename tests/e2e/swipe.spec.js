'use strict';
/*
 * Pointer input. Every test runs as mouse drags on the desktop project and as real touch swipes
 * (CDP touch events) on the mobile project. Expected positions come from the engine.
 */
const { test, expect, openLevel, blocks, blockElements, hud, expectedBlocks, cellCenter, drag, swipe, tap, pointerFor } = require('./helpers');

test.describe('swiping', () => {
  for (const dir of ['U', 'D', 'L', 'R']) {
    test(`a swipe ${dir} moves the block where the rules say`, async ({ page }, testInfo) => {
      // Level 6, block at 2,2: all four directions move it (up stops under a hole, the rest at edges).
      await openLevel(page, 6);
      await swipe(page, 2, 2, dir, { pointer: pointerFor(testInfo) });
      expect(await blocks(page)).toEqual(expectedBlocks(6, [`2,2 ${dir}`]));
      expect((await hud(page)).moves).toBe(1);
    });
  }

  test('swipes that do not start on a block move nothing', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 6); // row 0 is "B..###": 0,1 is a hole; 1,2 is a zone; 2,3 is floor
    const start = await blocks(page);
    const board = await page.locator('#board').boundingBox();
    const zones = await page.locator('#zones-left').boundingBox();
    const starts = {
      floor: await cellCenter(page, 2, 3),
      zone: await cellCenter(page, 1, 2),
      hole: await cellCenter(page, 0, 1),
      background: { x: Math.max(4, board.x / 2), y: board.y + board.height + 40 },
      hud: { x: zones.x + zones.width / 2, y: zones.y + zones.height / 2 },
    };
    for (const [name, from] of Object.entries(starts)) {
      for (const [dx, dy] of [[60, 0], [-60, 0], [0, 60], [0, -60]]) {
        await drag(page, from, { x: from.x + dx, y: from.y + dy }, { pointer });
        expect(await blocks(page), `swipe from ${name}`).toEqual(start);
        expect((await hud(page)).moves, `swipe from ${name}`).toBe(0);
      }
    }
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
  });

  test('a tap, or a drag under the threshold, moves nothing', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 4);
    const from = await cellCenter(page, 1, 0);
    await drag(page, from, { x: from.x + 6, y: from.y + 3 }, { pointer });
    await tap(page, 1, 2, { pointer });
    expect(await blocks(page)).toEqual(expectedBlocks(4));
    expect((await hud(page)).moves).toBe(0);
  });

  test('a diagonal drag moves along its dominant axis', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 6);
    let from = await cellCenter(page, 2, 2);
    await drag(page, from, { x: from.x + 40, y: from.y + 15 }, { pointer }); // mostly right
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
    expect(await blocks(page)).toEqual(expectedBlocks(6, ['2,2 R']));

    from = await cellCenter(page, 2, 5);
    await drag(page, from, { x: from.x - 14, y: from.y + 42 }, { pointer }); // mostly down
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
    expect(await blocks(page)).toEqual(expectedBlocks(6, ['2,2 R', '2,5 D']));
  });

  test('a drag that ends over another block or off the board still moves by its direction', async ({ page }, testInfo) => {
    const pointer = pointerFor(testInfo);
    await openLevel(page, 4); // blocks at 1,0 and 1,2
    await swipe(page, 1, 2, 'L', { pointer, cells: 2 }); // ends over the block at 1,0
    expect(await blocks(page)).toEqual(expectedBlocks(4, ['1,2 L']));

    await openLevel(page, 6);
    const from = await cellCenter(page, 2, 2);
    await drag(page, from, { x: 2, y: from.y }, { pointer }); // to the very edge of the window
    await expect(page.locator('#board')).toHaveAttribute('data-phase', 'idle');
    expect(await blocks(page)).toEqual(expectedBlocks(6, ['2,2 L']));
  });

  test('a block stops right before a hole', async ({ page }, testInfo) => {
    await openLevel(page, 2); // "B#." : sliding right stops at 2,1
    await swipe(page, 2, 0, 'R', { pointer: pointerFor(testInfo) });
    expect(await blocks(page)).toEqual([[2, 1]]);
  });

  test('a block stops at the board edge', async ({ page }, testInfo) => {
    await openLevel(page, 2);
    await swipe(page, 2, 0, 'U', { pointer: pointerFor(testInfo) });
    expect(await blocks(page)).toEqual([[0, 0]]);
  });

  test('a block stops next to another block', async ({ page }, testInfo) => {
    await openLevel(page, 4);
    await swipe(page, 1, 0, 'R', { pointer: pointerFor(testInfo) });
    expect(await blocks(page)).toEqual([[1, 1], [1, 2]]);
  });

  test('a block slides over a safe zone without stopping', async ({ page }, testInfo) => {
    await openLevel(page, 5); // 0,1 sliding down crosses the zone at 1,1 and stops at 2,1
    await swipe(page, 0, 1, 'D', { pointer: pointerFor(testInfo) });
    expect(await blocks(page)).toEqual([[2, 1], [3, 0]]);
    expect((await hud(page)).zonesLeft).toBe(1);
  });

  test('a swipe on one block never moves another', async ({ page }, testInfo) => {
    await openLevel(page, 6);
    const before = await blockElements(page);
    await swipe(page, 0, 0, 'D', { pointer: pointerFor(testInfo) });
    const after = await blockElements(page);
    const changed = before.map((p, i) => p !== after[i]);
    expect(changed.filter(Boolean)).toHaveLength(1);
    expect(before[changed.indexOf(true)]).toBe('0,0');
    expect(await blocks(page)).toEqual(expectedBlocks(6, ['0,0 D']));
  });
});
