'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Store = require('../../js/storage.js');

function fakeStorage(initial = {}) {
  const data = { ...initial };
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v); } };
}

test('missing key means no progress', () => {
  assert.deepEqual([...Store.load(fakeStorage())], []);
});

test('corrupt or wrongly shaped data means no progress', () => {
  for (const bad of ['{oops', '"text"', '[1,2]', '{"completed":"1"}', 'null']) {
    assert.deepEqual([...Store.load(fakeStorage({ [Store.KEY]: bad }))], [], bad);
  }
});

test('junk entries are dropped', () => {
  const s = fakeStorage({ [Store.KEY]: '{"completed":[1,"2",3.5,-1,0,4]}' });
  assert.deepEqual([...Store.load(s)].sort(), [1, 4]);
});

test('a throwing or missing storage means no progress, and saving does not throw', () => {
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual([...Store.load(throwing)], []);
  assert.doesNotThrow(() => Store.save(throwing, new Set([1])));
  assert.deepEqual([...Store.load(null)], []);
  assert.doesNotThrow(() => Store.save(null, new Set([1])));
});

test('save then load round-trips', () => {
  const s = fakeStorage();
  Store.save(s, new Set([3, 1, 2]));
  assert.equal(s.data[Store.KEY], '{"completed":[1,2,3]}');
  assert.deepEqual([...Store.load(s)].sort(), [1, 2, 3]);
});

test('a level is unlocked when it is level 1 or the previous one is completed', () => {
  const done = new Set([1, 2, 5]);
  assert.equal(Store.isUnlocked(1, new Set()), true);
  assert.equal(Store.isUnlocked(2, new Set()), false);
  assert.equal(Store.isUnlocked(3, done), true);
  assert.equal(Store.isUnlocked(4, done), false);
  assert.equal(Store.isUnlocked(6, done), true);
});

test('sound is on unless it was saved as off', () => {
  assert.equal(Store.loadSoundOn(fakeStorage()), true);
  assert.equal(Store.loadSoundOn(fakeStorage({ [Store.SOUND_KEY]: 'on' })), true);
  assert.equal(Store.loadSoundOn(fakeStorage({ [Store.SOUND_KEY]: 'junk' })), true);
  assert.equal(Store.loadSoundOn(fakeStorage({ [Store.SOUND_KEY]: 'off' })), false);
});

test('the sound choice round-trips, and a throwing or missing storage means sound on', () => {
  const s = fakeStorage();
  Store.saveSoundOn(s, false);
  assert.equal(s.data[Store.SOUND_KEY], 'off');
  assert.equal(Store.loadSoundOn(s), false);
  Store.saveSoundOn(s, true);
  assert.equal(Store.loadSoundOn(s), true);
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.equal(Store.loadSoundOn(throwing), true);
  assert.doesNotThrow(() => Store.saveSoundOn(throwing, false));
  assert.equal(Store.loadSoundOn(null), true);
  assert.doesNotThrow(() => Store.saveSoundOn(null, false));
});
