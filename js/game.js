/* Safe Zone: rendering, input, animation and screen flow. The rules live in engine.js. */
(function () {
  'use strict';

  const E = window.SafeZoneEngine;
  const LEVELS = window.SAFE_ZONE_LEVELS;
  const Store = window.SafeZoneStorage;
  const Sound = window.SafeZoneAudio;

  const $ = sel => document.querySelector(sel);
  const gameScreen = $('#game');
  const board = $('#board');
  const boardArea = $('.board-area');
  const levelSelect = $('#level-select');
  const levelGrid = $('#level-grid');
  const message = $('#message');
  const soundButton = $('#sound');

  const TILE = '#867d73'; // zones fade in as floor, then turn white
  const SWIPE_THRESHOLD = 12; // px of travel before a press on a block becomes a swipe
  const MAX_CELL = 54, MIN_CELL = 22; // 22 lets the 8-row levels fit a phone held sideways

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const ms = t => (reducedMotion.matches ? 0 : t);
  const wait = t => new Promise(resolve => setTimeout(resolve, t));

  const storage = (() => { try { return window.localStorage; } catch (e) { return null; } })();
  const completed = Store.load(storage);

  // Current level. `token` changes whenever a level (re)starts so stale async steps can bail out.
  let game = null;
  let token = 0;
  let gesture = null;

  const CHECK_SVG =
    '<svg class="check" viewBox="0 0 40 40" aria-hidden="true">' +
    '<circle cx="20" cy="20" r="12" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M14.6 20.4l3.7 3.7 7.2-7.9" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const LOCK_SVG =
    '<svg class="lock" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="5.5" width="8" height="6" rx="1" ' +
    'fill="currentColor"/><path d="M4 5.5V4a2 2 0 0 1 4 0v1.5" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
  const DONE_SVG =
    '<svg class="done" viewBox="0 0 14 14" aria-hidden="true"><path d="M2.5 7.4l3 3 6-6.6" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- Level lifecycle ---------- */

  function startLevel(n, { fullIntro = true } = {}) {
    hideOverlays();
    gameScreen.hidden = false;
    const def = LEVELS[n - 1];
    const level = E.parseLevel(def.map);
    game = { n, def, level, par: def.solution.length, moves: 0, blocks: [], token: ++token };
    gesture = null;
    buildBoard();
    layout();
    updateHud();
    playIntro(fullIntro);
  }

  function buildBoard() {
    const { level, def } = game;
    board.getAnimations().forEach(a => a.cancel());
    board.replaceChildren();
    board.className = `color-${def.color}`;
    for (let r = 0; r < level.rows; r++) {
      for (let c = 0; c < level.cols; c++) {
        if (!E.isFloor(level, r, c)) continue;
        const zone = level.isZone[E.toIndex(level, r, c)] === 1;
        const tile = document.createElement('div');
        tile.className = zone ? 'tile zone' : 'tile';
        tile.dataset.kind = zone ? 'zone' : 'floor';
        place(tile, r, c);
        board.append(tile);
      }
    }
    for (const at of level.start) {
      const el = document.createElement('div');
      el.className = 'block';
      el.innerHTML = CHECK_SVG;
      const block = { el, at };
      place(el, ...E.toRC(level, at));
      game.blocks.push(block);
      board.append(el);
    }
    refreshBlocks();
  }

  function place(el, r, c) {
    el.dataset.r = r;
    el.dataset.c = c;
    el.style.setProperty('--r', r);
    el.style.setProperty('--c', c);
  }

  // Real pixels per pixel of the phone-sized design: --px in style.css, which grows with the window.
  const designPx = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--px')) || 1;

  function layout() {
    if (!game) return;
    const { rows, cols } = game.level;
    const area = boardArea.getBoundingClientRect();
    const unit = designPx();
    const fit = Math.min((area.width - 24 * unit) / cols, (area.height - 24 * unit) / rows, MAX_CELL * unit);
    const cell = Math.max(MIN_CELL, Math.floor(fit));
    board.style.setProperty('--cell', `${cell}px`);
    board.style.setProperty('--gap', `${Math.max(3, Math.round(cell * 0.09))}px`);
    board.style.width = `${cols * cell}px`;
    board.style.height = `${rows * cell}px`;
  }

  const cellSize = () => parseFloat(board.style.getPropertyValue('--cell'));
  const blockPositions = () => game.blocks.map(b => b.at).sort((a, b) => a - b);

  function setPhase(phase) { board.dataset.phase = phase; }
  const phase = () => board.dataset.phase;

  function updateHud() {
    const { level, n, moves, par } = game;
    const left = E.zonesLeft(level, blockPositions());
    $('#level-label').textContent = `LEVEL ${n} OF ${LEVELS.length}`;
    const movesEl = $('#moves');
    movesEl.dataset.moves = moves;
    movesEl.dataset.par = par;
    movesEl.classList.toggle('over-par', moves >= par);
    $('#moves-count').textContent = moves;
    $('#moves-par').textContent = par;
    $('#moves-unit').textContent = par === 1 ? 'move' : 'moves';
    const zonesEl = $('#zones-left');
    zonesEl.textContent = left;
    zonesEl.dataset.zonesLeft = left;
  }

  function refreshBlocks() {
    for (const b of game.blocks) {
      if (game.level.isZone[b.at] === 1) b.el.classList.add('on-zone');
    }
  }

  /* Tiles fade in column by column, then the blocks appear, as in the original. */
  async function playIntro(fullIntro) {
    const t = game.token;
    setPhase('intro');
    const anims = [];
    let last = 0;
    if (fullIntro) {
      for (const tile of board.querySelectorAll('.tile')) {
        const delay = ms(+tile.dataset.c * 55 + (game.level.rows - 1 - +tile.dataset.r) * 22);
        last = Math.max(last, delay);
        const frames = tile.classList.contains('zone')
          ? [{ opacity: 0, backgroundColor: TILE }, { opacity: 1, backgroundColor: TILE, offset: 0.55 }, { opacity: 1 }]
          : [{ opacity: 0 }, { opacity: 1 }];
        anims.push(tile.animate(frames, { duration: ms(tile.classList.contains('zone') ? 380 : 220), delay, easing: 'ease-out', fill: 'backwards' }));
      }
    }
    for (const b of game.blocks) {
      anims.push(b.el.animate([{ opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1 }],
        { duration: ms(240), delay: fullIntro ? last + ms(260) : 0, easing: 'ease-out', fill: 'backwards' }));
    }
    await Promise.all(anims.map(a => a.finished.catch(() => {})));
    if (t === game.token) setPhase('idle');
  }

  /* ---------- Moves ---------- */

  async function tryMove(block, dir) {
    if (!game || phase() !== 'idle' || overlayOpen()) return;
    clearBump();
    Sound.playSwipe();
    const from = block.at;
    const to = E.slide(game.level, blockPositions(), from, dir);
    if (to === from) {
      bump(block, dir);
      game.moves++;
      updateHud();
      return;
    }

    const t = game.token;
    setPhase('animating');
    block.at = to;
    const [r0, c0] = E.toRC(game.level, from), [r1, c1] = E.toRC(game.level, to);
    const cell = cellSize(), half = parseFloat(board.style.getPropertyValue('--gap')) / 2;
    const px = (r, c) => `translate(${c * cell + half}px, ${r * cell + half}px)`;
    const distance = Math.abs(r1 - r0) + Math.abs(c1 - c0);
    const anim = block.el.animate([{ transform: px(r0, c0) }, { transform: px(r1, c1) }],
      { duration: ms(Math.min(90 + distance * 55, 380)), easing: 'cubic-bezier(0.25, 0.7, 0.35, 1)', fill: 'forwards' });
    place(block.el, r1, c1);
    await anim.finished.catch(() => {});
    anim.cancel();
    if (t !== game.token) return;

    refreshBlocks();
    if (E.isSolved(game.level, blockPositions())) solved();
    else setPhase('idle');
    game.moves++;
    updateHud();
  }

  /* A move that goes nowhere: a small nudge. */
  function bump(block, dir) {
    const [dr, dc] = E.DIRS[dir];
    const k = cellSize() * 0.1;
    block.el.classList.add('bump');
    block.el.animate([{ translate: '0 0' }, { translate: `${dc * k}px ${dr * k}px` }, { translate: '0 0' }],
      { duration: ms(160), easing: 'ease-out' });
  }

  function clearBump() {
    board.querySelectorAll('.block.bump').forEach(el => el.classList.remove('bump'));
  }

  async function solved() {
    const { n, moves, par } = game;
    const t = game.token;
    setPhase('solved');
    const inPar = moves <= par;
    completed.add(n);
    Store.save(storage, completed);
    await wait(inPar ? 900 : 700);
    if (t !== game.token) return;
    if (!inPar) { showOverPar(); return; }
    if (n < LEVELS.length) {
      await board.animate([{ opacity: 1 }, { opacity: 0 }], { duration: ms(320), easing: 'ease-in', fill: 'forwards' })
        .finished.catch(() => {});
      await wait(ms(180));
      if (t === game.token) startLevel(n + 1);
    } else {
      showAllComplete();
    }
  }

  function restart() {
    if (!game) return;
    Object.assign(game, { blocks: [], token: ++token });
    gesture = null;
    buildBoard();
    layout();
    updateHud();
    playIntro(false);
  }

  /* ---------- Input: a block moves only when it is swiped ---------- */

  const blockFromElement = el => el && game.blocks.find(b => b.el === el);

  boardArea.addEventListener('pointerdown', e => {
    if (!game || (e.pointerType === 'mouse' && e.button !== 0)) return;
    gesture = null;
    if (overlayOpen() || phase() !== 'idle') return;
    clearBump();
    const block = blockFromElement(e.target.closest('.block'));
    if (!block) return;
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, block, done: false };
    boardArea.setPointerCapture(e.pointerId);
    e.preventDefault();
  });

  function swipeDirection(e) {
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_THRESHOLD) return null;
    return Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : (dy > 0 ? 'D' : 'U');
  }

  boardArea.addEventListener('pointermove', e => {
    if (!gesture || gesture.id !== e.pointerId || gesture.done) return;
    const dir = swipeDirection(e);
    if (!dir) return;
    gesture.done = true;
    tryMove(gesture.block, dir);
  });

  boardArea.addEventListener('pointerup', e => {
    if (!gesture || gesture.id !== e.pointerId) return;
    const g = gesture;
    const dir = swipeDirection(e);
    gesture = null;
    if (!g.done && dir) tryMove(g.block, dir);
  });

  boardArea.addEventListener('pointercancel', () => { gesture = null; });

  $('#restart').addEventListener('click', () => { if (phase() !== 'solved' && !overlayOpen()) restart(); });
  $('#open-menu').addEventListener('click', () => { if (phase() !== 'solved' && !overlayOpen()) openLevelSelect('modal'); });
  soundButton.addEventListener('click', toggleSound);
  $('#level-cancel').addEventListener('click', () => startLevel(game.n));
  levelSelect.addEventListener('click', e => {
    if (e.target === levelSelect && levelSelect.classList.contains('as-modal')) closeLevelSelect();
  });
  window.addEventListener('resize', layout);

  /* ---------- Sound ---------- */

  function toggleSound() {
    Sound.setSoundOn(!Sound.isSoundOn());
    refreshSoundButton();
  }

  function refreshSoundButton() {
    soundButton.setAttribute('aria-pressed', Sound.isSoundOn());
  }

  /* ---------- Overlays ---------- */

  const overlayOpen = () => !levelSelect.hidden || !message.hidden;

  function hideOverlays() {
    levelSelect.hidden = true;
    message.hidden = true;
  }

  /* `mode` is 'menu' (the start screen: opaque, no Cancel) or 'modal' (over the game). */
  function openLevelSelect(mode) {
    message.hidden = true;
    levelSelect.classList.toggle('as-menu', mode === 'menu');
    levelSelect.classList.toggle('as-modal', mode === 'modal');
    $('#level-cancel').hidden = mode !== 'modal';
    if (mode === 'menu') gameScreen.hidden = true;
    renderLevelGrid();
    levelSelect.hidden = false;
    if (mode === 'modal' && game) levelGrid.querySelector(`[data-level="${game.n}"]`).focus();
  }

  function closeLevelSelect() {
    levelSelect.hidden = true;
    if (!gameScreen.hidden) $('#open-menu').focus({ preventScroll: true });
  }

  function renderLevelGrid() {
    levelGrid.replaceChildren();
    LEVELS.forEach((_, i) => {
      const n = i + 1;
      const locked = !Store.isUnlocked(n, completed);
      const done = completed.has(n);
      const tile = document.createElement('button');
      tile.type = 'button';
      tile.className = 'level-tile';
      tile.dataset.level = n;
      tile.dataset.locked = locked;
      tile.dataset.done = done;
      tile.textContent = n;
      tile.setAttribute('aria-label', `Level ${n}${locked ? ', locked' : done ? ', completed' : ''}`);
      if (locked) {
        tile.setAttribute('aria-disabled', 'true');
        tile.insertAdjacentHTML('beforeend', LOCK_SVG);
      } else if (done) {
        tile.insertAdjacentHTML('beforeend', DONE_SVG);
      }
      tile.addEventListener('click', () => {
        if (locked) {
          tile.classList.remove('shake');
          void tile.offsetWidth; // restart the animation
          tile.classList.add('shake');
          return;
        }
        startLevel(n);
      });
      levelGrid.append(tile);
    });
  }

  function showMessage(text, buttons) {
    $('#message-text').textContent = text;
    const box = $('#message-buttons');
    box.replaceChildren();
    for (const { label, color, action } of buttons) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `button ${color}`;
      b.textContent = label;
      b.addEventListener('click', action);
      box.append(b);
    }
    message.hidden = false;
    box.firstChild.focus({ preventScroll: true });
  }

  function showOverPar() {
    const { par } = game;
    showMessage(
      `Nice job! But to level up, you need to solve this level in no fewer than ${par} ${par === 1 ? 'move' : 'moves'}. Try again?`,
      [
        { label: 'Retry Level', color: 'teal', action: () => startLevel(game.n, { fullIntro: false }) },
        { label: 'Level Select', color: 'red', action: () => openLevelSelect('menu') },
      ]);
  }

  function showAllComplete() {
    showMessage(`Congratulations! You solved all ${LEVELS.length} levels in the fewest possible moves.`, [
      { label: 'Level Select', color: 'teal', action: () => openLevelSelect('menu') },
    ]);
  }

  refreshSoundButton();
  openLevelSelect('menu');
})();
