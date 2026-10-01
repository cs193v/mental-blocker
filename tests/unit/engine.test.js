'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../../js/engine.js');

// Slides the block at (r, c) and returns where it lands as [r, c], or null if it can't move.
function slideRC(map, r, c, dir) {
  const level = E.parseLevel(map);
  const next = E.applyMove(level, level.start, { from: E.toIndex(level, r, c), dir });
  if (!next) return null;
  const moved = next.find(i => !level.start.includes(i));
  return E.toRC(level, moved);
}

test('parseLevel reads floor, zones, blocks and pads short rows with holes', () => {
  const level = E.parseLevel(['#O', 'B@#', '.']);
  assert.equal(level.rows, 3);
  assert.equal(level.cols, 3);
  assert.deepEqual(level.zones, [1, 4]);
  assert.deepEqual(level.start, [3, 4]);
  assert.equal(E.isFloor(level, 0, 2), false, 'short row is padded');
  assert.equal(E.isFloor(level, 2, 0), false, 'hole');
  assert.equal(E.isFloor(level, 1, 2), true);
  assert.throws(() => E.parseLevel(['#X']), /Bad map character/);
});

test('a block stops at the edge of the board', () => {
  assert.deepEqual(slideRC(['B###'], 0, 0, 'R'), [0, 3]);
  assert.deepEqual(slideRC(['#', '#', 'B'], 2, 0, 'U'), [0, 0]);
});

test('a block stops right before a hole', () => {
  assert.deepEqual(slideRC(['B##.##'], 0, 0, 'R'), [0, 2]);
});

test('a block stops next to another block', () => {
  assert.deepEqual(slideRC(['B###B'], 0, 0, 'R'), [0, 3]);
  assert.deepEqual(slideRC(['B###B'], 0, 4, 'L'), [0, 1]);
});

test('safe zones do not stop a block', () => {
  assert.deepEqual(slideRC(['BO#O#'], 0, 0, 'R'), [0, 4]);
});

test('a move that goes nowhere returns null', () => {
  assert.equal(slideRC(['B##'], 0, 0, 'L'), null, 'against the edge');
  assert.equal(slideRC(['BB#'], 0, 0, 'R'), null, 'against a block');
  assert.equal(slideRC(['.B#'], 0, 1, 'L'), null, 'against a hole');
});

test('applyMove rejects a move from an empty cell', () => {
  const level = E.parseLevel(['B##']);
  assert.throws(() => E.applyMove(level, level.start, { from: 2, dir: 'L' }), /No block/);
});

test('solved only when every zone is covered; extra blocks are fine', () => {
  const level = E.parseLevel(['OO#B']);
  assert.equal(E.isSolved(level, [0, 1]), true);
  assert.equal(E.isSolved(level, [0, 1, 3]), true, 'extra block');
  assert.equal(E.isSolved(level, [0, 3]), false);
  assert.equal(E.zonesLeft(level, [0, 3]), 1);
  assert.equal(E.zonesLeft(level, [2, 3]), 2);
});

test('parseMove and formatMove round-trip', () => {
  const level = E.parseLevel(['###', '###']);
  const move = E.parseMove(level, '1,2 L');
  assert.deepEqual(move, { from: 5, dir: 'L' });
  assert.equal(E.formatMove(level, move), '1,2 L');
  assert.throws(() => E.parseMove(level, '1 2 X'), /Bad move/);
});

test('solve finds shortest solutions and reports unsolvable levels', () => {
  assert.deepEqual(E.solve(E.parseLevel(['B#O'])), ['0,0 R']);
  assert.equal(E.solve(E.parseLevel(['B#.O'])), null);
});

test('replay throws on a move that does not move', () => {
  const level = E.parseLevel(['B#O']);
  assert.throws(() => E.replay(level, ['0,0 L']), /does not move/);
});
