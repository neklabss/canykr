'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { createStore, PREFIX } = require('../src/session-store.js');

// chrome.storage.session benzeri bellek içi sahte depo.
function fakeStorage() {
  const map = new Map();
  return {
    map,
    async get(key) {
      if (key === null) return Object.fromEntries(map);
      return map.has(key) ? { [key]: structuredClone(map.get(key)) } : {};
    },
    async set(obj) { for (const [k, v] of Object.entries(obj)) map.set(k, structuredClone(v)); },
    async remove(key) { map.delete(key); }
  };
}

function setup(ttlMs = 1000) {
  let t = 1_000_000;
  const storage = fakeStorage();
  const store = createStore({ storage, now: () => t, ttlMs });
  return { storage, store, advance: (ms) => { t += ms; } };
}

const DATA = { tckn: 'x', ad: 'a', soyad: 's', dogumYili: '1990' };

test('take tek kullanımlıktır ve kaydı siler', async () => {
  const { storage, store } = setup();
  await store.put(7, DATA);
  assert.equal(await store.has(7), true);
  assert.deepEqual(await store.take(7), DATA);
  assert.equal(await store.take(7), null);
  assert.equal(storage.map.size, 0);
});

test('TTL dolunca veri verilmez ve silinir', async () => {
  const { storage, store, advance } = setup(1000);
  const { expiresAt } = await store.put(1, DATA);
  assert.equal(expiresAt, 1_001_000);
  advance(999);
  assert.equal(await store.has(1), true);
  advance(1);
  assert.equal(await store.has(1), false);
  assert.equal(await store.take(1), null);
  assert.equal(storage.map.size, 0, 'süresi geçmiş kayıt take ile silinir');
});

test('sekmeler birbirinden yalıtılır; drop yalnızca ilgili sekmeyi siler', async () => {
  const { store } = setup();
  await store.put(1, DATA);
  await store.put(2, { ...DATA, ad: 'b' });
  await store.drop(1);
  assert.equal(await store.has(1), false);
  assert.equal((await store.take(2)).ad, 'b');
});

test('sweep yalnızca süresi geçmiş kendi kayıtlarını siler', async () => {
  const { storage, store, advance } = setup(1000);
  await storage.set({ 'baska-anahtar': 1 });
  await store.put(1, DATA);
  advance(500);
  await store.put(2, DATA);
  advance(600);
  assert.equal(await store.sweep(), 1);
  assert.equal(await store.has(1), false);
  assert.equal(await store.has(2), true);
  assert.ok(storage.map.has('baska-anahtar'));
  advance(1000);
  assert.equal(await store.sweep(), 0);
  assert.deepEqual([...storage.map.keys()].filter((k) => k.startsWith(PREFIX)), []);
});

test('aynı sekmeye yeni put eskisini ve süresini yeniler', async () => {
  const { store, advance } = setup(1000);
  await store.put(3, DATA);
  advance(900);
  await store.put(3, { ...DATA, ad: 'yeni' });
  advance(900);
  assert.equal((await store.take(3)).ad, 'yeni');
});
