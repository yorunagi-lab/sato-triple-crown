import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { hitsToLead, projectScenario, freshness, validateSnapshot } from '../dist/logic.js';
const data = JSON.parse(fs.readFileSync(new URL('../dist/data.json', import.meta.url), 'utf8'));

test('batting title compares exact fractions, even if displayed AVG is the same', () => {
  assert.equal(hitsToLead(100, 300, 3, 1, 3), 2);
  assert.equal(hitsToLead(100, 300, 0, 1, 3), null);
  assert.equal(hitsToLead(101, 300, 0, 1, 3), 0);
});
test('unreachable batting target returns no fabricated answer', () => {
  assert.equal(hitsToLead(10, 100, 4, 40, 100), null);
});
test('live data validates; counts and forecast changes are coherent', () => {
  validateSnapshot(data);
  const current = projectScenario(data, 60, 'frozen');
  const extended = projectScenario(data, 60, 'season');
  assert(extended.results.hr.needed >= current.results.hr.needed);
  assert(extended.results.rbi.needed >= current.results.rbi.needed);
  assert.equal(extended.results.avg.needed, current.results.avg.needed);
});
test('forecast considers every rival and uses team games, not player appearances', () => {
  const copy = structuredClone(data);
  const rivalA = { id: 'a', name: 'A', hr: 33, rbi: 77, team_games: 131, team_remaining: 12 };
  const rivalB = { id: 'b', name: 'B', hr: 32, rbi: 75, team_games: 120, team_remaining: 23 };
  copy.contenders.hr = [copy.player, rivalA, rivalB];
  copy.contenders.rbi = [copy.player, rivalA, rivalB];
  const result = projectScenario(copy, 60, 'season');
  assert.equal(result.results.hr.rival.id, 'b');
  assert.equal(result.results.rbi.rival.id, 'b');
});
test('invalid scenario inputs are rejected', () => {
  for (const n of [-1, 2.5, NaN, 301]) assert.throws(() => projectScenario(data, n, 'season'));
  assert.throws(() => projectScenario(data, 60, 'guaranteed'));
});
test('stale source, failed fetch, mismatched snapshots and preview are visible', () => {
  assert(freshness(data, { status: 'error' }, Date.parse(data.source_updated_at) + 31 * 3600000).length >= 2);
  assert(freshness(data, { status: 'ok', mode: 'preview' }, Date.parse(data.source_updated_at)).length >= 1);
  assert(freshness(data, { status: 'ok', last_success_at: 'different' }, Date.parse(data.source_updated_at)).length >= 1);
});
