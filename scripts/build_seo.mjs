import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { METRICS, formatAverage, formatMetric, validateSnapshot, freshness } from '../dist/logic.js';
import { latestGame } from '../dist/insight-data.js';

export const SITE = 'https://yorunagi-lab.github.io/sato-triple-crown/';
export const TITLE = '佐藤輝明の三冠王への道｜2026年の打率・本塁打・打点';
export const DESCRIPTION = '佐藤輝明の三冠王（3冠王）への挑戦を追う2026年の非公式ファンサイト。打率・本塁打・打点の成績と順位、ライバルとの差、最新出場、残り試合の試算、成績の推移を確認できます。';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const esc = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const time = (value, includeTime = true) => new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
  ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
}).format(new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value));
const safeSource = value => {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'baseballdata.jp' || url.username || url.password) throw new Error('Unexpected source link');
  return esc(url.href);
};
export function replaceBlock(html, name, content) {
  const start = `<!-- seo:${name}:start -->`, end = `<!-- seo:${name}:end -->`;
  if (html.split(start).length !== 2 || html.split(end).length !== 2 || html.indexOf(end) < html.indexOf(start)) throw new Error(`Missing or duplicate SEO block: ${name}`);
  return html.slice(0, html.indexOf(start)) + start + '\n' + content + '\n' + html.slice(html.indexOf(end));
}

function metrics(data) {
  const { player, races } = data;
  const cards = Object.entries(METRICS).map(([metric, config], index) => {
    const race = races[metric], rival = data.contenders[metric].find(p => p.id === race.best_other_id);
    if (!rival) throw new Error('Missing rival');
    const rank = race.tied ? (metric === 'avg' ? '同率首位' : '同数首位') : race.is_leading ? '単独首位' : race.rank === null ? '規定未到達' : `${race.rank}位`;
    const gap = race.tied ? `${esc(rival.name)}と首位を分け合う` : race.rank === null ? '打率順位は規定打席到達後に表示'
      : `${race.is_leading ? '2位に' : '首位まで'} <strong>${metric === 'avg' ? Math.abs(race.margin).toFixed(3) : Math.abs(race.margin)}</strong>${metric === 'avg' ? '差' : config.unit + '差'}`;
    const ratio = race.rank ? Math.min(100, player[metric] / Math.max(player[metric], rival.value, .001) * 100) : 0;
    return `<article class="metric-card${race.is_leading ? ' is-leading' : ''}${metric === 'avg' ? ' is-selected' : ''}" data-metric="${metric}" data-index="0${index + 1} / 03">
      <div class="metric-top"><h2>${config.label}<small>${config.english}</small></h2><span class="rank-tag${race.is_leading ? '' : ' behind'}">${rank}</span></div>
      <div class="metric-number"><strong>${formatMetric(metric, player[metric])}</strong><span>${config.unit}</span></div>
      <p class="metric-gap">${gap}</p><p class="metric-detail">${esc(rival.name)}［${esc(rival.team)}］ ${formatMetric(metric, rival.value)}${config.unit}</p>
      <div class="metric-track" aria-hidden="true"><span style="width:${ratio}%"></span></div>
    </article>`;
  }).join('\n');
  return `<section class="metrics" id="metrics" aria-label="佐藤輝明の打率・本塁打・打点と暫定順位">${cards}</section>
    <div class="season-strip" id="season-strip"><span class="remaining">阪神の残り試合 <strong>${player.team_remaining}</strong> / ${data.season_games}</span><span>シーズン規定打席 <strong>${player.pa} / 443</strong>${player.pa >= 443 ? ' · 到達済み' : ` · あと${443 - player.pa}打席`}</span></div>`;
}

function boards(data) {
  const sourceKeys = { avg: 'average', hr: 'home_runs', rbi: 'rbi' };
  return `<div class="leaderboards" id="leaderboards">${Object.entries(METRICS).map(([metric, config]) => {
    const rows = data.rankings[metric];
    if (!rows.length) throw new Error('Empty ranking');
    const boundary = rows[Math.min(4, rows.length - 1)].rank;
    const visible = rows.filter(p => p.rank <= boundary || p.id === data.player.id);
    const list = visible.map(player => {
      const delta = data.player[metric] - player.value, target = player.id === data.player.id;
      const label = target ? '佐藤' : `${delta > 0 ? '−' : delta < 0 ? '+' : '±'}${metric === 'avg' ? Math.abs(delta).toFixed(3) : Math.abs(delta)}`;
      return `<li class="ranking-row${target ? ' is-sato' : ''}"><span class="place">${player.rank}</span><div class="player">${esc(player.name)}<small>${esc(player.team)}</small></div><div class="value">${formatMetric(metric, player.value)}<small>${label}</small></div></li>`;
    }).join('');
    return `<article class="leaderboard"><h3>${config.label}<a href="${safeSource(data.source.urls[sourceKeys[metric]])}" target="_blank" rel="noopener noreferrer">全順位 ↗</a></h3><ol class="ranking-list">${list}</ol><p class="ranking-footnote">${metric === 'avg' ? '安打・打数から算出。表示の丸め前で順位を判定。' : '右端は佐藤選手との差。同数の選手は同順位。'}</p>${visible.some(p => p.special_rule) ? '<p class="ranking-footnote">規定未到達特例は、不足打席を凡退扱いした打率で表示。</p>' : ''}</article>`;
  }).join('\n')}</div>`;
}

function latest(data) {
  const game = latestGame(data);
  if (!game) return '<section id="latest-game" class="latest-game" aria-label="最新出場と成績の変化" hidden></section>';
  const opponents = { 中: '中日', 巨: '巨人', 広: '広島', ヤ: 'ヤクルト', D: 'DeNA' };
  const delta = game.change === null ? '比較なし' : `${game.change > 0 ? '+' : game.change < 0 ? '−' : '±'}${Math.abs(game.change).toFixed(3)}`;
  return `<section id="latest-game" class="latest-game" aria-label="最新出場と成績の変化"><div class="latest-content">
    <div class="latest-heading"><p class="eyebrow">LATEST GAME</p><h2>${time(game.date, false)} の最新出場</h2><span class="latest-opponent">vs ${esc(opponents[game.opponent] || game.opponent)}</span></div>
    <dl class="latest-stats">${[['ab', '打数'], ['hits', '安打'], ['hr', '本塁打'], ['rbi', '打点']].map(([key, label]) => `<div><dt>${label}</dt><dd>${game[key]}</dd></div>`).join('')}</dl>
    <p class="latest-change"><span>打率 </span><b>${formatAverage(game.previousAVG)} → ${formatAverage(game.currentAVG)}</b><span class="change-pill${game.change > 0 ? ' positive' : ''}">${delta}</span></p>
    <p class="feature-note">出場前 → 出場後（表示桁で比較）。速報ではなく、取得元への反映後に更新します。</p>
  </div></section>`;
}

export function buildPage(template, data, status, now = Date.now()) {
  validateSnapshot(data);
  const leading = data.leading_categories;
  const graph = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebSite', '@id': SITE + '#website', url: SITE, name: '佐藤輝明 三冠王への道', inLanguage: 'ja', description: DESCRIPTION },
    { '@type': 'WebPage', '@id': SITE + '#webpage', url: SITE, name: TITLE, description: DESCRIPTION, inLanguage: 'ja',
      isPartOf: { '@id': SITE + '#website' }, about: { '@type': 'Person', name: '佐藤輝明' },
      primaryImageOfPage: { '@type': 'ImageObject', url: SITE + 'og-image.png', width: 1200, height: 630 } },
  ] };
  const metadata = `<title>${TITLE}</title>
  <meta name="description" content="${esc(DESCRIPTION)}">
  <meta name="robots" content="index,follow,max-image-preview:large">
  <link rel="canonical" href="${SITE}">
  <link rel="sitemap" type="application/xml" href="./sitemap.xml">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="ja_JP">
  <meta property="og:title" content="${TITLE}">
  <meta property="og:description" content="${esc(DESCRIPTION)}">
  <meta property="og:url" content="${SITE}">
  <meta property="og:image" content="${SITE}og-image.png">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="佐藤輝明、三冠王への道。打率・本塁打・打点を追う非公式ファンサイト。">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${TITLE}">
  <meta name="twitter:description" content="${esc(DESCRIPTION)}">
  <meta name="twitter:image" content="${SITE}og-image.png">
  <script type="application/ld+json">${JSON.stringify(graph).replaceAll('<', '\\u003c')}</script>`;
  const warnings = freshness(data, status, now);
  const blocks = {
    metadata,
    crown: `<div class="crown-summary" id="crown-summary"><span>現在の首位部門</span><strong>${leading}<small>/ 3</small></strong><span>${leading === 3 ? '三部門で首位〈暫定〉' : '三つの頂点を追跡中'}</span></div>`,
    time: `<span id="data-time">佐藤の最新出場 ${time(data.data_through, false)} · 最終取得 ${time(data.fetched_at)} JST</span>`,
    status: `<p id="status-message" class="notice${status?.status === 'error' ? ' error' : ''}" role="status"${warnings.length ? '' : ' hidden'}>${esc(warnings.join(' '))}</p>`,
    latest: latest(data), metrics: metrics(data), boards: boards(data),
    methodology: `<div id="methodology"><p>データ取得：${time(data.fetched_at)}（日本時間）。取得元の更新：${time(data.source_updated_at)}。成績対象は${time(data.data_through, false)}の最新出場まで。試合速報ではありません。</p><p>順位は取得データに基づく暫定順位です。打率は安打÷打数の丸め前の値を比較し、本塁打・打点の同数は同順位として扱います。</p><p>取得元の更新後に成績を反映します。取得・整合性検証に失敗した場合は前回の正常な成績を保持します。正式なタイトルはNPBの発表で確認してください。</p></div>`,
  };
  for (const [name, html] of Object.entries(blocks)) template = replaceBlock(template, name, html);
  return template;
}

export const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${SITE}</loc></url>
</urlset>
`;

function writeIfChanged(file, value) {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf8') === value) return;
  const tmp = file + '.tmp'; fs.writeFileSync(tmp, value); fs.renameSync(tmp, file);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dist = path.join(root, 'dist'), file = path.join(dist, 'index.html');
  const data = JSON.parse(fs.readFileSync(path.join(dist, 'data.json'), 'utf8'));
  const status = JSON.parse(fs.readFileSync(path.join(dist, 'fetch-status.json'), 'utf8'));
  // Compute and validate everything before replacing the public page.
  const page = buildPage(fs.readFileSync(file, 'utf8'), data, status);
  writeIfChanged(file, page); writeIfChanged(path.join(dist, 'sitemap.xml'), sitemap);
  console.log(`Search-readable HTML built from verified snapshot: ${data.fetched_at}`);
}
