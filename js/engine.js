/*
 * Safe Zone rules engine. Pure functions, no DOM: shared by the browser game, the level tools,
 * and the tests.
 *
 * A level map is a list of strings, one per row (short rows are padded with holes):
 *   '#' floor   'O' safe zone   'B' block on floor   '@' block on a safe zone   '.' hole
 *
 * Cells are addressed by index (r * cols + c). A block position list ("blocks") is always kept
 * sorted, since blocks are indistinguishable.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SafeZoneEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const DIRS = { U: [-1, 0], D: [1, 0], L: [0, -1], R: [0, 1] };
  const DIR_NAMES = ['U', 'D', 'L', 'R'];

  function parseLevel(map) {
    const rows = map.length;
    const cols = Math.max(...map.map(row => row.length));
    const floor = new Uint8Array(rows * cols);
    const isZone = new Uint8Array(rows * cols);
    const zones = [];
    const blocks = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const ch = map[r][c] || '.';
        const i = r * cols + c;
        if (!'#OB@.'.includes(ch)) throw new Error(`Bad map character '${ch}' at ${r},${c}`);
        if (ch !== '.') floor[i] = 1;
        if (ch === 'O' || ch === '@') { isZone[i] = 1; zones.push(i); }
        if (ch === 'B' || ch === '@') blocks.push(i);
      }
    }
    return { rows, cols, floor, isZone, zones, start: blocks };
  }

  const toIndex = (level, r, c) => r * level.cols + c;
  const toRC = (level, i) => [Math.floor(i / level.cols), i % level.cols];

  function isFloor(level, r, c) {
    return r >= 0 && r < level.rows && c >= 0 && c < level.cols && level.floor[r * level.cols + c] === 1;
  }

  /* Where a block at index `from` ends up sliding in `dir`; returns `from` if it cannot move. */
  function slide(level, blocks, from, dir) {
    const [dr, dc] = DIRS[dir];
    let [r, c] = toRC(level, from);
    for (;;) {
      const nr = r + dr, nc = c + dc;
      if (!isFloor(level, nr, nc) || blocks.includes(nr * level.cols + nc)) return r * level.cols + c;
      r = nr; c = nc;
    }
  }

  /* Applies a move {from, dir}; returns the new sorted block list, or null if nothing moves. */
  function applyMove(level, blocks, move) {
    if (!blocks.includes(move.from)) throw new Error(`No block at ${toRC(level, move.from)}`);
    const to = slide(level, blocks, move.from, move.dir);
    if (to === move.from) return null;
    return blocks.map(b => (b === move.from ? to : b)).sort((a, b) => a - b);
  }

  function zonesLeft(level, blocks) {
    return level.zones.filter(z => !blocks.includes(z)).length;
  }

  const isSolved = (level, blocks) => zonesLeft(level, blocks) === 0;

  /* Every move that actually moves a block: [{from, dir, to, blocks}]. */
  function neighbors(level, blocks) {
    const out = [];
    for (const from of blocks) {
      for (const dir of DIR_NAMES) {
        const to = slide(level, blocks, from, dir);
        if (to !== from) out.push({ from, dir, to, blocks: blocks.map(b => (b === from ? to : b)).sort((a, b) => a - b) });
      }
    }
    return out;
  }

  // Moves are written "row,col DIR", e.g. "2,0 R".
  function parseMove(level, text) {
    const m = /^\s*(\d+)\s*,\s*(\d+)\s*([UDLR])\s*$/.exec(text);
    if (!m) throw new Error(`Bad move '${text}'`);
    return { from: toIndex(level, +m[1], +m[2]), dir: m[3] };
  }

  function formatMove(level, move) {
    const [r, c] = toRC(level, move.from);
    return `${r},${c} ${move.dir}`;
  }

  const stateKey = blocks => blocks.join(',');

  /* Breadth-first search for a shortest solution. Returns a list of move strings, or null. */
  function solve(level, start = level.start) {
    start = [...start].sort((a, b) => a - b);
    const prev = new Map([[stateKey(start), null]]);
    let frontier = [start];
    while (frontier.length) {
      const next = [];
      for (const s of frontier) {
        if (isSolved(level, s)) {
          const path = [];
          for (let k = stateKey(s); prev.get(k); k = prev.get(k).key) path.push(formatMove(level, prev.get(k).move));
          return path.reverse();
        }
        for (const n of neighbors(level, s)) {
          const k = stateKey(n.blocks);
          if (!prev.has(k)) { prev.set(k, { key: stateKey(s), move: n }); next.push(n.blocks); }
        }
      }
      frontier = next;
    }
    return null;
  }

  /* Replays move strings from the start; throws on an illegal or non-moving move. */
  function replay(level, moves) {
    let blocks = [...level.start].sort((a, b) => a - b);
    for (const text of moves) {
      const next = applyMove(level, blocks, parseMove(level, text));
      if (!next) throw new Error(`Move '${text}' does not move anything`);
      blocks = next;
    }
    return blocks;
  }

  return {
    DIRS, DIR_NAMES, parseLevel, toIndex, toRC, isFloor, slide, applyMove, zonesLeft, isSolved,
    neighbors, parseMove, formatMove, solve, replay,
  };
});
