import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { randomUUID } from 'node:crypto';
import worker, { CheerCounter } from '../backend/worker.js';

function setup() {
  const db = new DatabaseSync(':memory:');
  const storage = {
    failUpdate: false,
    sql: { exec(sql, ...args) {
      if (storage.failUpdate && sql.startsWith('UPDATE totals')) throw new Error('simulated storage failure');
      const rows = db.prepare(sql).all(...args);
      return { toArray: () => rows, one: () => { assert.equal(rows.length, 1); return rows[0]; } };
    } },
    transactionSync(fn) {
      db.exec('BEGIN');
      try { const value = fn(); db.exec('COMMIT'); return value; }
      catch (error) { db.exec('ROLLBACK'); throw error; }
    },
  };
  return { storage, counter: new CheerCounter({ storage }), db };
}
const post = (id = randomUUID(), client = randomUUID()) => new Request('https://counter/api/cheers', {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cheer-Client': client }, body: JSON.stringify({ eventId: id }),
});

test('50 overlapping visitors produce exactly 50 cheers', async () => {
  const { counter, db } = setup();
  const responses = await Promise.all(Array.from({ length: 50 }, () => counter.fetch(post())));
  assert.ok(responses.every(r => r.status === 200));
  assert.equal(counter.total(), 50); db.close();
});
test('concurrent network retries with the same event ID count once', async () => {
  const { counter, db } = setup(); const id = randomUUID();
  const results = await Promise.all([counter.fetch(post(id)), counter.fetch(post(id.toUpperCase()))]);
  const bodies = await Promise.all(results.map(r => r.json()));
  assert.equal(counter.total(), 1); assert.equal(bodies.filter(x => x.duplicate).length, 1); db.close();
});
test('total and deduplication survive an object restart', async () => {
  const { counter, storage, db } = setup(); const id = randomUUID();
  await counter.fetch(post(id));
  const restarted = new CheerCounter({ storage });
  assert.equal((await (await restarted.fetch(post(id))).json()).duplicate, true);
  assert.equal(restarted.total(), 1); db.close();
});
test('failed write rolls back the receipt and permits a safe retry', async () => {
  const { counter, storage, db } = setup(); const id = randomUUID();
  storage.failUpdate = true;
  await assert.rejects(counter.fetch(post(id)), /storage failure/);
  assert.equal(counter.total(), 0);
  storage.failUpdate = false;
  assert.equal((await (await counter.fetch(post(id))).json()).total, 1); db.close();
});
test('rapid new events are rejected without counting; receipt retries still succeed', async () => {
  const { counter, db } = setup(); const id = randomUUID(), client = 'same-client';
  await counter.fetch(post(id, client));
  assert.equal((await counter.fetch(post(randomUUID(), client))).status, 429);
  assert.equal((await counter.fetch(post(id, client))).status, 200);
  assert.equal(counter.total(), 1); db.close();
});
test('invalid IDs, arrays and extra count fields cannot manipulate totals', async () => {
  const { counter, db } = setup();
  for (const body of [null, { eventId: [randomUUID()] }, { eventId: randomUUID(), total: 500 }, { eventId: 'bad' }]) {
    const r = await counter.fetch(new Request('https://counter/api/cheers', { method: 'POST', body: JSON.stringify(body) }));
    assert.equal(r.status, 400);
  }
  assert.equal(counter.total(), 0); db.close();
});
test('HTTP boundary enforces origin and format and preserves the persistent total', async () => {
  const { counter, db } = setup();
  const env = { ALLOWED_ORIGIN: 'https://yorunagi-lab.github.io', CHEERS: { idFromName: x => x, get: () => counter } };
  const send = (origin, body, contentType = 'application/json') => worker.fetch(new Request('https://counter/api/cheers', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': contentType, 'CF-Connecting-IP': '192.0.2.4' }, body,
  }), env);
  assert.equal((await send('https://other.invalid', JSON.stringify({ eventId: randomUUID() }))).status, 403);
  assert.equal((await send(env.ALLOWED_ORIGIN, '{}', 'text/plain')).status, 415);
  assert.equal((await send(env.ALLOWED_ORIGIN, 'x'.repeat(129))).status, 413);
  const ok = await send(env.ALLOWED_ORIGIN, JSON.stringify({ eventId: randomUUID() }));
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), env.ALLOWED_ORIGIN);
  assert.equal((await ok.json()).total, 1);
  assert.equal((await worker.fetch(new Request('https://counter/api/cheers'), env)).status, 200);
  assert.equal(counter.total(), 1); db.close();
});
