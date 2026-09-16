import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { latestGame, gameTrend, validateHistory, nextCombo, comboLevel } from '../dist/insight-data.js';
import { shareText } from '../dist/sharing.js';
const snapshot = JSON.parse(fs.readFileSync(new URL('../dist/data.json', import.meta.url)));
const fixture = (player, games) => ({ player, recent: { games } });

test('latest game shows the change between displayed averages, including a hitless game', () => {
  const data = fixture({ ab: 476, hits: 150, hr: 35, rbi: 92 }, [{ ab: 5, hits: 0, hr: 0, rbi: 0, date: '2026-09-15' }]);
  const game = latestGame(data);
  assert.equal(game.previousAVG, 150 / 471);
  assert.equal(game.currentAVG, 150 / 476);
  assert.equal(game.change, -.003);
});

test('zero AB and first recorded at-bats do not produce NaN or a made-up comparison', () => {
  assert.equal(latestGame(fixture({ ab: 4, hits: 1, hr: 0, rbi: 1 }, [{ ab: 0, hits: 0, hr: 0, rbi: 1 }])).change, 0);
  const first = latestGame(fixture({ ab: 4, hits: 1, hr: 0, rbi: 0 }, [{ ab: 4, hits: 1, hr: 0, rbi: 0 }]));
  assert.equal(first.change, null); assert.equal(first.previousAVG, null);
});

test('cumulative trend reconstructs each end-of-game total without inventing earlier games', () => {
  const data = fixture({ ab: 12, hits: 5, hr: 2, rbi: 5 }, [
    { date: '2026-09-03', ab: 4, hits: 2, hr: 1, rbi: 3 },
    { date: '2026-09-02', ab: 4, hits: 1, hr: 0, rbi: 0 },
  ]);
  assert.deepEqual(gameTrend(data), [
    { date: '2026-09-02', avg: 3 / 8, hr: 1, rbi: 2 },
    { date: '2026-09-03', avg: 5 / 12, hr: 2, rbi: 5 },
  ]);
  data.recent.games[0].hits = 8;
  assert.throws(() => gameTrend(data), /不整合/);
});

test('real history is valid; duplicate days and non-finite gaps are rejected', () => {
  const history = JSON.parse(fs.readFileSync(new URL('../dist/history.json', import.meta.url)));
  assert.ok(validateHistory(history, snapshot.season));
  const bad = structuredClone(history); bad.days.push(bad.days[0]);
  assert.throws(() => validateHistory(bad, snapshot.season));
  history.days[0].races.avg.margin = NaN;
  assert.throws(() => validateHistory(history, snapshot.season));
});

test('combos reset after a pause, unlock gold at 30, and continue beyond 100', () => {
  assert.equal(nextCombo(9, 1000, 2499), 10);
  assert.equal(nextCombo(29, 1000, 2500), 1);
  assert.equal(comboLevel(29).gold, false);
  assert.deepEqual(comboLevel(30), { gold: true, milestone: true, next: 100 });
  assert.equal(comboLevel(100).next, 200);
  assert.equal(comboLevel(101).milestone, false);
});

test('share copy uses actual snapshot stats and dates, with no claim of live data', () => {
  const text = shareText(snapshot);
  assert.ok(text.includes(`${snapshot.player.hr}本塁打`));
  assert.ok(text.includes(`${snapshot.player.rbi}打点`));
  assert.ok(text.includes('取得元更新'));
  assert.ok(text.includes(`${snapshot.season}年`));
  assert.ok(!text.includes('リアルタイム'));
});
