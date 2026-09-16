import { METRICS, formatAverage, formatMetric } from './logic.js';
import { gameTrend, latestGame, validateHistory } from './insight-data.js?v=9';

const $ = selector => document.querySelector(selector);
const node = (tag, cls, text) => {
  const e = document.createElement(tag); if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text; return e;
};
const dayLabel = date => `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}`;
const signed = (value, metric) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${metric === 'avg' ? Math.abs(value).toFixed(3) : Math.abs(value)}`;
const teams = { '中': '中日', '巨': '巨人', '広': '広島', 'ヤ': 'ヤクルト', 'D': 'DeNA' };
let selectedMetric = 'avg', selectedView = 'player';

export function renderLatest(data) {
  const root = $('#latest-game');
  const game = latestGame(data);
  if (!game) { root.hidden = true; return; }
  root.hidden = false;
  const heading = node('div', 'latest-heading');
  heading.append(node('p', 'eyebrow', 'LATEST GAME'), node('h2', '', `${dayLabel(game.date)} の最新出場`),
    node('span', 'latest-opponent', `vs ${teams[game.opponent] || game.opponent}`));
  const stats = node('dl', 'latest-stats');
  for (const [key, label] of [['ab', '打数'], ['hits', '安打'], ['hr', '本塁打'], ['rbi', '打点']]) {
    const cell = node('div'); cell.append(node('dt', '', label), node('dd', '', String(game[key]))); stats.append(cell);
  }
  const change = node('p', 'latest-change');
  change.append(node('span', '', '打率 '), node('b', '', `${formatAverage(game.previousAVG)} → ${formatAverage(game.currentAVG)}`),
    node('span', `change-pill${game.change > 0 ? ' positive' : ''}`, game.change === null ? '比較なし' : `${signed(game.change, 'avg')}`));
  const note = node('p', 'feature-note', '出場前 → 出場後（表示桁で比較）。速報ではなく、取得元への反映後に更新します。');
  const content = node('div', 'latest-content'); content.append(heading, stats, change, note); root.replaceChildren(content);
}

function svgElement(tag, attrs, text) {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, value);
  if (text !== undefined) e.textContent = text;
  return e;
}

function chart(points, metric, gap) {
  const svg = svgElement('svg', { viewBox: '0 0 720 235', class: 'trend-chart', role: 'img', 'aria-labelledby': 'trend-chart-title' });
  svg.append(svgElement('title', { id: 'trend-chart-title' }, `${METRICS[metric].label}${gap ? 'のライバルとの差' : 'の推移'}。各記録の数値は下の表で確認できます。`));
  const values = points.map(p => p.value);
  const min = Math.min(...values, ...(gap ? [0] : [])), max = Math.max(...values, ...(gap ? [0] : []));
  const padding = Math.max((max - min) * .18, metric === 'avg' ? .002 : 1);
  const low = gap ? min - padding : Math.max(0, min - padding), high = max + padding;
  const left = 74, right = 690, top = 22, bottom = 190;
  const start = Date.parse(points[0].date), end = Date.parse(points.at(-1).date);
  const x = i => start === end ? (left + right) / 2 : left + (Date.parse(points[i].date) - start) * (right - left) / (end - start);
  const y = value => bottom - (value - low) / (high - low) * (bottom - top);
  const fmt = v => gap ? signed(metric === 'avg' ? Number(v.toFixed(3)) : Number(v.toFixed(1)), metric) : formatMetric(metric, metric === 'avg' ? v : Number(v.toFixed(1)));
  for (const value of [low, (low + high) / 2, high]) {
    svg.append(svgElement('line', { x1: left, x2: right, y1: y(value), y2: y(value), class: 'chart-grid' }),
      svgElement('text', { x: left - 12, y: y(value) + 4, 'text-anchor': 'end', class: 'chart-label' }, fmt(value)));
  }
  if (gap) svg.append(svgElement('line', { x1: left, x2: right, y1: y(0), y2: y(0), class: 'chart-zero' }));
  if (points.length > 1) {
    const coordinates = points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ');
    svg.append(svgElement('polygon', { points: `${left},${bottom} ${coordinates} ${right},${bottom}`, class: 'chart-area' }),
      svgElement('polyline', { points: coordinates, class: 'chart-line' }));
  }
  points.forEach((p, i) => {
    const dot = svgElement('circle', { cx: x(i), cy: y(p.value), r: i === points.length - 1 ? 5 : 3, class: 'chart-dot' });
    dot.append(svgElement('title', {}, `${dayLabel(p.date)}：${fmt(p.value)}`)); svg.append(dot);
  });
  [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])].forEach(i =>
    svg.append(svgElement('text', { x: x(i), y: 219, 'text-anchor': 'middle', class: 'chart-label' }, dayLabel(points[i].date))));
  return svg;
}

export function renderHistory(data, rawHistory, unavailable = false) {
  const root = $('#history-section');
  let history = null;
  try { history = validateHistory(rawHistory, data.season); } catch { unavailable = true; }
  const heading = node('div', 'section-heading');
  const title = node('div'); title.append(node('p', 'eyebrow', 'THE CHASE, DAY BY DAY'), node('h2', '', '三冠への、足あと。'));
  heading.append(title);
  const controls = node('div', 'trend-controls');
  const metrics = node('div', 'segmented'); metrics.setAttribute('role', 'group'); metrics.setAttribute('aria-label', '推移の部門');
  for (const [metric, config] of Object.entries(METRICS)) {
    const button = node('button', '', config.label); button.type = 'button'; button.dataset.trendMetric = metric;
    button.setAttribute('aria-pressed', String(metric === selectedMetric));
    button.addEventListener('click', () => { selectedMetric = metric; draw(); button.focus(); }); metrics.append(button);
  }
  const views = node('div', 'segmented trend-views'); views.setAttribute('role', 'group'); views.setAttribute('aria-label', '推移の種類');
  for (const [value, label] of [['player', '佐藤の成績'], ['gap', 'ライバルとの差']]) {
    const button = node('button', '', label); button.type = 'button'; button.dataset.trendView = value;
    button.setAttribute('aria-pressed', String(value === selectedView));
    button.addEventListener('click', () => { selectedView = value; draw(); button.focus(); }); views.append(button);
  }
  controls.append(metrics, views);
  const panel = node('div', 'trend-panel');
  function draw() {
    metrics.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.trendMetric === selectedMetric)));
    views.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.trendView === selectedView)));
    panel.replaceChildren();
    const metric = selectedMetric, gap = selectedView === 'gap';
    const records = gap ? history?.days || [] : gameTrend(data);
    if (!records.length) {
      panel.append(node('p', 'feature-note', gap ? '推移の記録を読み込めませんでした。「更新を確認」で再試行できます。' : '試合別成績の反映を待っています。')); return;
    }
    const points = records.map(p => ({ date: p.date, value: gap ? p.races[metric].margin : p[metric] })).filter(p => Number.isFinite(p.value));
    if (!points.length) { panel.append(node('p', 'feature-note', 'まだ打率を計算できる打数がありません。')); return; }
    const latest = points.at(-1);
    const summary = node('div', 'trend-summary');
    summary.append(node('span', '', `${gap ? '他選手の最高成績との差' : '直近出場終了時の累計'} / ${dayLabel(latest.date)}`),
      node('strong', '', `${gap ? signed(latest.value, metric) : formatMetric(metric, latest.value)}${METRICS[metric].unit}`));
    panel.append(summary, chart(points, metric, gap));
    if (gap && records.length === 1) panel.append(node('p', 'history-start', '記録を開始しました。2日分そろうと、変化が線でつながります。'));
    const notes = gap
      ? `記録開始 ${dayLabel(history.started_at)}。各日（日本時間）の最終正常取得値を保存。＋は佐藤がリード、−は他選手がリード。相手は各日時点の他選手のトップで、入れ替わる場合があります。`
      : `直近${records.length}出場の終了時点。現在の累計と実際の試合別成績から逆算。打率は縦軸を拡大しています。`;
    panel.append(node('p', 'feature-note', notes));
    if (gap) {
      const last = records.at(-1);
      panel.append(node('p', 'feature-note', `直近の取得元更新：${dayLabel(last.source_updated_at)} ${last.source_updated_at.slice(11, 16)} JST。記録日と試合日は異なります。${unavailable ? ' 再取得できなかったため前回読み込んだ記録を表示しています。' : ''}`));
    }
    const details = node('details', 'trend-details'); details.append(node('summary', '', '日別の数値を見る'));
    const wrap = node('div', 'trend-table-wrap'), table = node('table', 'trend-table');
    table.append(node('caption', 'sr-only', `${METRICS[metric].label} ${gap ? 'ライバルとの差' : '試合別推移'}`));
    const header = node('tr');
    for (const label of gap ? ['記録日', '差', '相手 / 成績'] : ['出場日', METRICS[metric].label]) { const th = node('th', '', label); th.scope = 'col'; header.append(th); }
    const thead = node('thead'); thead.append(header); table.append(thead);
    const body = node('tbody');
    for (const p of [...records].reverse()) {
      const row = node('tr'); row.append(node('td', '', dayLabel(p.date)), node('td', '', gap ? signed(p.races[metric].margin, metric) : formatMetric(metric, p[metric])));
      if (gap) row.append(node('td', '', `${p.races[metric].rival_name} / ${formatMetric(metric, p.races[metric].rival_value)}`));
      body.append(row);
    }
    table.append(body); wrap.append(table); details.append(wrap); panel.append(details);
  }
  root.replaceChildren(heading, controls, panel); draw();
}
