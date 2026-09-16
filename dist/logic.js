export const METRICS = {
  avg: { label: '打率', english: 'BATTING AVERAGE', unit: '' },
  hr: { label: '本塁打', english: 'HOME RUNS', unit: '本' },
  rbi: { label: '打点', english: 'RUNS BATTED IN', unit: '打点' },
};

export function formatAverage(value, digits = 3) {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(digits).replace(/^0/, '');
}

export function formatMetric(metric, value, projected = false) {
  if (!Number.isFinite(value)) return '—';
  return metric === 'avg' ? formatAverage(value) : projected ? value.toFixed(1) : String(value);
}

export function validateSnapshot(data) {
  if (data?.schema_version !== 1 || data.season !== 2026 || data.player?.id !== '2000051') {
    throw new Error('想定外のデータ形式です');
  }
  const player = data.player;
  if (![player.ab, player.hits, player.hr, player.rbi, player.pa, player.team_games, player.team_remaining].every(Number.isFinite)
      || player.ab <= 0 || player.hits > player.ab || player.ab > player.pa || player.team_remaining < 0
      || !Number.isFinite(Date.parse(data.fetched_at)) || !Number.isFinite(Date.parse(data.source_updated_at))) {
    throw new Error('成績データに不整合があります');
  }
  for (const metric of Object.keys(METRICS)) {
    if (!data.races?.[metric] || !Array.isArray(data.rankings?.[metric]) || !Array.isArray(data.contenders?.[metric])
        || !data.contenders[metric].some(p => p.id !== player.id)) throw new Error('ランキングが不足しています');
  }
  return data;
}

export function hitsToLead(hits, ab, additionalAB, rivalHits, rivalAB) {
  if (![hits, ab, additionalAB, rivalHits, rivalAB].every(Number.isInteger)
      || ab < 0 || additionalAB < 0 || rivalAB <= 0) throw new Error('試算値が不正です');
  const finalAB = ab + additionalAB;
  for (let n = 0; n <= additionalAB; n++) {
    // Compare integer products: rounded screen values do not define a tie.
    if ((hits + n) * rivalAB > rivalHits * finalAB) return n;
  }
  return null;
}

export function projectScenario(data, additionalAB, mode) {
  if (!Number.isInteger(additionalAB) || additionalAB < 0 || additionalAB > 300
      || !['frozen', 'season'].includes(mode)) throw new Error('試算条件を確認してください');
  const sato = data.player;
  const others = metric => data.contenders[metric].filter(p => p.id !== sato.id);
  const averageRival = others('avg').reduce((best, p) => {
    const ab = p.ranking_ab || p.ab;
    const bestAB = best.ranking_ab || best.ab;
    return p.hits * bestAB > best.hits * ab ? p : best;
  });
  const neededHits = hitsToLead(sato.hits, sato.ab, additionalAB,
    averageRival.hits, averageRival.ranking_ab || averageRival.ab);
  const results = {
    avg: { rival: averageRival, target: averageRival.hits / (averageRival.ranking_ab || averageRival.ab),
      needed: neededHits, final: neededHits === null ? null : (sato.hits + neededHits) / (sato.ab + additionalAB),
      remainingAverage: neededHits !== null && additionalAB > 0 ? neededHits / additionalAB : null },
  };
  for (const metric of ['hr', 'rbi']) {
    const candidates = others(metric).map(p => ({ player: p, value: p[metric]
      + (mode === 'season' && p.team_games > 0 ? p[metric] / p.team_games * p.team_remaining : 0) }));
    const leader = candidates.reduce((a, b) => b.value > a.value ? b : a);
    const needed = Math.max(0, Math.floor(leader.value) + 1 - sato[metric]);
    results[metric] = { rival: leader.player, target: leader.value, needed, final: sato[metric] + needed,
      perGame: sato.team_remaining > 0 ? needed / sato.team_remaining : null };
  }
  return { mode, additionalAB, results };
}

export function freshness(data, status, now = Date.now()) {
  const warnings = [];
  if (status?.status === 'error') warnings.push('最新の取得に失敗しています。前回正常取得時の成績を表示しています。');
  if (status?.status === 'disabled') warnings.push('データの自動取得は停止中です。');
  if (status?.mode === 'preview' || (!status && data.mode === 'preview')) {
    warnings.push('確認版：初回取得時点のデータです。定期更新は公開設定後に開始します。');
  }
  const age = now - Date.parse(data.source_updated_at);
  if (age > 30 * 60 * 60 * 1000 && !data.season_complete) {
    warnings.push('取得元の更新から30時間以上経過しています。最新の試合が未反映の可能性があります。');
  }
  if (status && status.status === 'ok' && status.last_success_at
      && status.last_success_at !== data.fetched_at) {
    warnings.push('データの反映中です。少し待って再読み込みしてください。');
  }
  return warnings;
}
