// Pure calculations shared by the screen, image card and regression tests.
export function gameTrend(data) {
  const totals = Object.fromEntries(['ab', 'hits', 'hr', 'rbi'].map(k => [k, data.player[k]]));
  const rows = [];
  for (const game of data.recent.games) {
    if (!['ab', 'hits', 'hr', 'rbi'].every(k => Number.isInteger(game[k]) && game[k] >= 0 && totals[k] >= game[k])
        || game.hits > game.ab || totals.hits > totals.ab) throw new Error('試合別成績に不整合があります');
    rows.push({ date: game.date, avg: totals.ab ? totals.hits / totals.ab : null, hr: totals.hr, rbi: totals.rbi });
    for (const key of Object.keys(totals)) totals[key] -= game[key];
  }
  if (totals.hits > totals.ab) throw new Error('試合前成績に不整合があります');
  return rows.reverse();
}

export function latestGame(data) {
  const game = data.recent.games[0];
  if (!game) return null;
  gameTrend(data); // Reject inconsistent logs before deriving a comparison.
  const previousAB = data.player.ab - game.ab;
  const previousAVG = previousAB > 0 ? (data.player.hits - game.hits) / previousAB : null;
  const currentAVG = data.player.hits / data.player.ab;
  // Compare the displayed 3-decimal averages, so the visible subtraction agrees.
  const change = previousAVG === null ? null : (Math.round(currentAVG * 1000) - Math.round(previousAVG * 1000)) / 1000;
  return { ...game, previousAVG, currentAVG, change };
}

export function validateHistory(history, season) {
  if (history?.schema_version !== 1 || history.season !== season || !Array.isArray(history.days)
      || !Number.isFinite(Date.parse(history.started_at))) throw new Error('推移の形式が不正です');
  let previous = '';
  for (const day of history.days) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day.date) || !day.date.startsWith(String(season)) || day.date <= previous
        || !Number.isFinite(Date.parse(day.recorded_at)) || !Number.isFinite(Date.parse(day.source_updated_at))) throw new Error('推移の日付が不正です');
    for (const key of ['avg', 'hr', 'rbi']) {
      const race = day.races?.[key];
      if (!Number.isFinite(day.values?.[key]) || !Number.isFinite(race?.margin) || !Number.isFinite(race?.rival_value)
          || typeof race?.rival_name !== 'string') throw new Error('推移の値が不正です');
    }
    previous = day.date;
  }
  return history;
}

export function nextCombo(previous, lastTap, now) {
  return now >= lastTap && now - lastTap < 1500 ? previous + 1 : 1;
}

export function comboLevel(streak) {
  return { gold: streak >= 30, milestone: streak > 0 && (streak % 100 === 0 || streak === 10 || streak === 30),
    next: streak < 10 ? 10 : streak < 30 ? 30 : (Math.floor(streak / 100) + 1) * 100 };
}
