import { METRICS, formatAverage, formatMetric, validateSnapshot, projectScenario, freshness } from './logic.js';
import { initCheers } from './cheer.js?v=4';
import { playMetricAnimation } from './effects.js?v=4';

const $ = selector => document.querySelector(selector);
const state = { data: null, status: null, mode: 'season', additionalAB: null, busy: false, selectedMetric: 'avg' };
try {
  const saved = sessionStorage.getItem('sato-selected-metric');
  if (Object.hasOwn(METRICS, saved)) state.selectedMetric = saved;
} catch { /* Selection still works when browser storage is unavailable. */ }

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function append(parent, ...children) { parent.append(...children); return parent; }
function dateLabel(value, includeTime = true) {
  const d = new Date(value.length === 10 ? `${value}T00:00:00+09:00` : value);
  return new Intl.DateTimeFormat('ja-JP', {
    timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric',
    ...(includeTime ? { hour: '2-digit', minute: '2-digit', hour12: false } : {}),
  }).format(d);
}

function renderMetrics(data) {
  const { player, races } = data;
  const root = $('#metrics'); root.replaceChildren();
  for (const [metric, config] of Object.entries(METRICS)) {
    const race = races[metric];
    const rival = data.contenders[metric].find(p => p.id === race.best_other_id);
    const card = el('article', `metric-card${race.is_leading ? ' is-leading' : ''}${state.selectedMetric === metric ? ' is-selected' : ''}`);
    card.dataset.metric = metric;
    const select = el('button', 'metric-select');
    select.type = 'button';
    select.setAttribute('aria-label', `${config.label}を選択してゴリラの演出を再生`);
    select.setAttribute('aria-pressed', String(state.selectedMetric === metric));
    select.addEventListener('click', () => {
      state.selectedMetric = metric;
      try { sessionStorage.setItem('sato-selected-metric', metric); } catch { /* Optional persistence. */ }
      for (const item of root.querySelectorAll('.metric-card')) {
        const selected = item.dataset.metric === metric;
        item.classList.toggle('is-selected', selected);
        item.querySelector('.metric-select').setAttribute('aria-pressed', String(selected));
      }
      playMetricAnimation(metric);
    });
    card.dataset.index = `0${Object.keys(METRICS).indexOf(metric) + 1} / 03`;
    const title = append(el('h2'), document.createTextNode(config.label), el('small', '', config.english));
    let rankText = race.rank === null ? '規定未到達' : `${race.rank}位`;
    if (race.tied) rankText = metric === 'avg' ? '同率首位' : '同数首位';
    else if (race.is_leading) rankText = '単独首位';
    append(card, append(el('div', 'metric-top'), title, el('span', `rank-tag${race.is_leading ? '' : ' behind'}`, rankText)));
    append(card, append(el('div', 'metric-number'), el('strong', '', formatMetric(metric, player[metric])), el('span', '', config.unit)));
    const gap = el('p', 'metric-gap');
    if (race.tied) gap.textContent = `${rival.name}と首位を分け合う`;
    else if (race.rank === null) gap.textContent = '打率順位は規定打席到達後に表示';
    else append(gap, document.createTextNode(race.is_leading ? '2位に ' : '首位まで '),
      el('strong', '', metric === 'avg' ? Math.abs(race.margin).toFixed(3) : String(Math.abs(race.margin))),
      document.createTextNode(metric === 'avg' ? '差' : `${config.unit}差`));
    card.append(gap, el('p', 'metric-detail', `${rival.name}［${rival.team}］ ${formatMetric(metric, rival.value)}${config.unit}`));
    const ratio = race.rank ? Math.min(100, player[metric] / Math.max(player[metric], rival.value, 0.001) * 100) : 0;
    const track = el('div', 'metric-track'); track.setAttribute('aria-hidden', 'true');
    const fill = el('span'); fill.style.width = `${ratio}%`; track.append(fill); card.append(track, select); root.append(card);
  }
  let strip = $('#season-strip');
  if (!strip) { strip = el('div', 'season-strip'); strip.id = 'season-strip'; root.after(strip); }
  const remaining = append(el('span', 'remaining'), document.createTextNode('阪神の残り試合 '), el('strong', '', String(player.team_remaining)), document.createTextNode(' / 143'));
  const qualification = append(el('span'), document.createTextNode('シーズン規定打席 '), el('strong', '', `${player.pa} / 443`),
    document.createTextNode(player.pa >= 443 ? ' · 到達済み' : ` · あと${443 - player.pa}打席`));
  strip.replaceChildren(remaining, qualification);
  const summary = $('#crown-summary');
  summary.replaceChildren(el('span', '', '現在の首位部門'),
    append(el('strong'), document.createTextNode(String(data.leading_categories)), el('small', '', '/ 3')),
    el('span', '', data.leading_categories === 3 ? '三部門で首位〈暫定〉' : '三つの頂点を追跡中'));
}

function renderBoards(data) {
  const root = $('#leaderboards'); root.replaceChildren();
  const urls = { avg: data.source.urls.average, hr: data.source.urls.home_runs, rbi: data.source.urls.rbi };
  for (const [metric, config] of Object.entries(METRICS)) {
    const board = el('article', 'leaderboard');
    const source = el('a', '', '全順位 ↗'); source.href = urls[metric]; source.target = '_blank'; source.rel = 'noopener noreferrer';
    board.append(append(el('h3'), document.createTextNode(config.label), source));
    const list = el('ol', 'ranking-list');
    const rows = data.rankings[metric];
    const boundaryRank = rows[Math.min(4, rows.length - 1)].rank;
    const visible = rows.filter(p => p.rank <= boundaryRank || p.id === data.player.id);
    for (const player of visible) {
      const row = el('li', `ranking-row${player.id === data.player.id ? ' is-sato' : ''}`);
      const label = append(el('div', 'player'), document.createTextNode(player.name), el('small', '', player.team));
      const difference = data.player[metric] - player.value;
      const delta = player.id === data.player.id ? '佐藤' : `${difference > 0 ? '−' : difference < 0 ? '+' : '±'}${metric === 'avg' ? Math.abs(difference).toFixed(3) : Math.abs(difference)}`;
      const value = append(el('div', 'value'), document.createTextNode(formatMetric(metric, player.value)), el('small', '', delta));
      row.append(el('span', 'place', String(player.rank)), label, value); list.append(row);
    }
    board.append(list, el('p', 'ranking-footnote', metric === 'avg' ? '安打・打数から算出。表示の丸め前で順位を判定。' : '右端は佐藤選手との差。同数の選手は同順位。'));
    if (visible.some(p => p.special_rule)) board.append(el('p', 'ranking-footnote', '規定未到達特例は、不足打席を凡退扱いした打率で表示。'));
    root.append(board);
  }
}

function setupScenario(data) {
  const root = $('#scenario-section'); root.replaceChildren();
  const heading = append(el('div', 'section-heading'),
    append(el('div'), el('p', 'eyebrow', '02 / WHAT DOES IT TAKE?'), el('h2', '', '三冠をつかむ条件')),
    el('p', '', '条件を変えて試算'));
  heading.querySelector('h2').id = 'scenario-heading'; root.append(heading);
  const shell = el('div', 'scenario-shell');
  const controls = el('div', 'scenario-controls');
  const selectGroup = el('div');
  const selectLabel = el('label', '', 'ライバルの残り試合'); selectLabel.htmlFor = 'scenario-mode';
  const select = el('select'); select.id = 'scenario-mode';
  for (const [value, text] of [['season', '今季のペースで成績を伸ばす'], ['frozen', '現在の成績で止まる']]) {
    const option = el('option', '', text); option.value = value; select.append(option);
  }
  select.value = state.mode;
  select.addEventListener('change', () => { state.mode = select.value; renderScenario(); });
  selectGroup.append(selectLabel, select); controls.append(selectGroup);
  const rangeGroup = el('div', 'range-control');
  const rangeLabel = el('label', 'slider-label'); rangeLabel.htmlFor = 'remaining-ab';
  const rangeValue = el('strong'); rangeValue.id = 'remaining-ab-value';
  rangeLabel.append(document.createTextNode('佐藤選手の残り打数'), rangeValue);
  const range = el('input'); range.type = 'range'; range.id = 'remaining-ab'; range.min = '0'; range.step = '1';
  range.max = String(Math.min(300, Math.max(80, data.player.team_remaining * 8)));
  if (state.additionalAB === null) state.additionalAB = Math.round(data.player.ab / data.player.team_games * data.player.team_remaining);
  state.additionalAB = Math.min(Number(range.max), state.additionalAB);
  if (data.player.team_remaining === 0) { state.additionalAB = 0; range.disabled = true; }
  range.value = String(state.additionalAB);
  range.addEventListener('input', () => { state.additionalAB = Number(range.value); renderScenario(); });
  rangeGroup.append(rangeLabel, range, el('p', 'input-hint', `初期値は今季の打数 ÷ 阪神の消化試合 × 残り${data.player.team_remaining}試合。四球・死球などは打数に含みません。`));
  controls.append(rangeGroup);
  const results = el('div', 'scenario-results'); results.id = 'scenario-results'; results.setAttribute('aria-live', 'polite');
  shell.append(controls, results); root.append(shell);
  const quick = el('div', 'quick-sim'); quick.append(el('p', '', '次の4打数、通算打率はどう変わる？'));
  const options = el('div', 'quick-options');
  for (let hits = 0; hits <= 4; hits++) options.append(append(el('span'), document.createTextNode(`${hits}安打`), el('strong', '', formatAverage((data.player.hits + hits) / (data.player.ab + 4)))));
  quick.append(options); root.append(quick); renderScenario();
}

function renderScenario() {
  const data = state.data;
  $('#remaining-ab-value').textContent = `${state.additionalAB}打数`;
  const result = projectScenario(data, state.additionalAB, state.mode);
  const root = $('#scenario-results'); root.replaceChildren(el('h3', '', '各部門で単独首位になるための追加成績'));
  const list = el('div', 'scenario-result-list');
  for (const [metric, config] of Object.entries(METRICS)) {
    const value = result.results[metric]; const cell = el('div', 'scenario-result');
    cell.append(el('p', 'label', config.label));
    const need = value.needed === null ? '届かず' : `${value.needed}${metric === 'avg' ? '安打' : config.unit}`;
    cell.append(el('strong', '', need));
    let detail;
    if (metric === 'avg') detail = value.needed === null ? '全打数で安打でも、この条件では届きません。'
      : `残り${state.additionalAB}打数で${value.needed}安打${value.remainingAverage !== null ? `（${formatAverage(value.remainingAverage)}）` : ''}。最終打率 ${formatAverage(value.final)}。`;
    else detail = value.needed === 0 ? '相手がこの想定にとどまれば、現在の成績で上回ります。'
      : `最終${value.final}${config.unit}。${value.perGame !== null ? `残り1試合あたり約${value.perGame.toFixed(2)}${config.unit}。` : '追加のチーム試合は残っていません。'}`;
    cell.append(el('p', 'detail', detail), el('p', 'target', `${value.rival.name} 想定 ${formatMetric(metric, value.target, state.mode === 'season' && metric !== 'avg')}${config.unit}`));
    list.append(cell);
  }
  root.append(list, el('p', 'scenario-explanation', state.mode === 'season'
    ? '相手の本塁打・打点は「今季成績 ÷ 所属球団の消化試合 × 残り試合」で延長。打率は現在値を維持する仮定です。単独首位の必要数であり、獲得確率・確定条件ではありません。'
    : '相手がこれ以上成績を伸ばさない仮定です。同率・同数を上回る最低値を表示します。実際のタイトル獲得を保証する数字ではありません。'));
}

function renderForm(data) {
  const root = $('#form-section'); root.replaceChildren();
  const grid = el('div', 'form-grid'); const left = el('div');
  left.append(append(el('div', 'section-heading'), append(el('div'), el('p', 'eyebrow', '03 / RECENT FORM'), el('h2', '', '直近の一打、一打。'))));
  const summary = el('div', 'form-summary');
  for (const [label, value, detail] of [
    ['直近5試合', formatAverage(data.recent.last5.avg), `${data.recent.last5.hits}安打 / ${data.recent.last5.ab}打数`],
    ['直近10試合', formatAverage(data.recent.last10.avg), `${data.recent.last10.hr}本塁打 / ${data.recent.last10.rbi}打点`],
    ['直近の試合', `${data.recent.games[0].hits}安打`, `${dateLabel(data.data_through, false)} 対${data.recent.games[0].opponent}`],
  ]) summary.append(append(el('div'), el('span', '', label), el('strong', '', value), el('small', '', detail)));
  left.append(summary);
  const strip = el('div', 'game-strip'); strip.setAttribute('role', 'img');
  strip.setAttribute('aria-label', '直近10試合の安打数。' + data.recent.games.slice().reverse().map(g => `${dateLabel(g.date, false)} ${g.hits}安打 ${g.hr}本塁打`).join('、'));
  const max = Math.max(3, ...data.recent.games.map(g => g.hits));
  for (const game of data.recent.games.slice().reverse()) {
    const bar = el('div', `game-bar${game.hr ? ' is-hr' : ''}`); bar.setAttribute('aria-hidden', 'true');
    const space = el('div', 'bar-space'); const fill = el('div', 'bar-fill'); fill.style.height = `${game.hits / max * 100}%`;
    space.append(fill); bar.append(el('strong', '', String(game.hits)), space, el('span', '', game.date.slice(5).replace('-', '/'))); strip.append(bar);
  }
  left.append(strip, append(el('p', 'chart-caption'), document.createTextNode('直近10試合の安打数'), el('span', '', '本塁打を記録')));
  const right = el('div'); right.append(append(el('div', 'section-heading'), append(el('div'), el('p', 'eyebrow', 'SEASON 2026'), el('h2', '', 'シーズン成績'))));
  const stats = el('dl', 'season-stats');
  for (const [label, value] of [['OPS', formatAverage(data.player.ops)], ['出塁率', formatAverage(data.player.obp)], ['長打率', formatAverage(data.player.slg)],
    ['安打', data.player.hits], ['打数', data.player.ab], ['打席', data.player.pa]]) stats.append(append(el('div'), el('dt', '', label), el('dd', '', String(value))));
  right.append(stats, el('p', 'qual-note', `${data.player.games}試合出場。阪神は${data.player.team_games}試合を消化。成績対象：${dateLabel(data.data_through, false)}の出場試合まで。`));
  grid.append(left, right); root.append(grid);
}

function renderMethodology(data) {
  const root = $('#methodology'); root.replaceChildren();
  const messages = [
    `データ取得：${dateLabel(data.fetched_at)}（日本時間）。取得元の更新：${dateLabel(data.source_updated_at)}。成績の対象日は佐藤選手の最新出場日を示します。試合速報ではありません。`,
    '順位は取得データに基づく暫定順位です。打率は安打÷打数の丸め前の値を比較し、本塁打・打点は同数を同順位としています。表示の小数3桁が同じでも、実際の順位が異なる場合があります。',
    '規定打席は所属球団の消化試合数×3.1を四捨五入。143試合のシーズン規定打席は443です。規定未到達者も、不足打席を凡退扱いしてなお首位となる場合は特例計算の候補に含めます。正式なタイトルはNPBの発表で確認してください。',
    '試算は全競合選手を比較し、部門ごとに最も高い想定成績を採用します。追加安打数は単独首位に必要な最低値です。本塁打・打点・安打は別々の計算であり、三つの数字が同時に生じる打撃結果を予測するものではありません。打率の試算は規定打席到達を前提とします。',
    `定期更新を有効にした場合の目安：${data.schedule_jst.join(' / ')}（日本時間）。開始は遅れる場合があります。取得元の更新時刻にも依存します。画面は5分ごとに公開済みデータを再読込します。`,
    '取得・整合性検証に失敗した場合は前回の正常データを表示します。取得元の更新から30時間以上経過した場合も注意を表示します。応援回数は画面のラベルをご確認ください。「この端末」はブラウザ内の記録、「みんなのエール」は共有集計です。共有回数はサーバーが受け付けた分だけ増えます。通信結果が不明な場合は累計を再確認します。選手への直接送信ではありません。',
  ];
  for (const message of messages) root.append(el('p', '', message));
}

function renderStatus() {
  const banner = $('#status-message');
  const warnings = freshness(state.data, state.status);
  banner.textContent = warnings.join(' '); banner.hidden = warnings.length === 0;
  banner.classList.toggle('error', state.status?.status === 'error');
}

function render(data) {
  state.data = data;
  $('#data-time').textContent = `佐藤の最新出場 ${dateLabel(data.data_through, false)} · 最終取得 ${dateLabel(data.fetched_at)} JST`;
  renderMetrics(data); renderBoards(data); setupScenario(data); renderForm(data); renderMethodology(data); renderStatus();
}

async function fetchJSON(file) {
  const response = await fetch(`${file}?t=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  return response.json();
}

async function load({ quiet = false } = {}) {
  if (state.busy) return;
  state.busy = true; $('#refresh-button').disabled = true;
  try {
    const [dataResult, statusResult] = await Promise.allSettled([fetchJSON('./data.json'), fetchJSON('./fetch-status.json')]);
    if (dataResult.status !== 'fulfilled') throw dataResult.reason;
    const data = validateSnapshot(dataResult.value);
    state.status = statusResult.status === 'fulfilled' ? statusResult.value : null;
    if (!quiet || !state.data || data.fetched_at !== state.data.fetched_at) render(data);
    else renderStatus();
    if (statusResult.status !== 'fulfilled') {
      const banner = $('#status-message'); banner.textContent += ' 取得状態の確認ができません。成績の更新日時を確認してください。'; banner.hidden = false;
    }
  } catch (error) {
    const banner = $('#status-message'); banner.hidden = false; banner.classList.add('error');
    banner.textContent = state.data ? '再読込に失敗しました。画面には前回読み込んだ成績を残しています。' : '成績を読み込めませんでした。通信状態を確認して「データ再読込」を押してください。';
    if (!state.data) $('#data-time').textContent = 'データ読込エラー';
    console.error('Snapshot loading failed', error);
  } finally { state.busy = false; $('#refresh-button').disabled = false; }
}

$('#refresh-button').addEventListener('click', () => load());
initCheers();
setInterval(() => { if (!document.hidden) load({ quiet: true }); }, 5 * 60 * 1000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) load({ quiet: true }); });

// Optional WebMCP integration shares exactly the visible simulator's state.
if (document.modelContext?.registerTool) {
  const controller = new AbortController();
  window.addEventListener('pagehide', () => controller.abort(), { once: true });
  const tool = {
    name: 'configure_triple_crown_scenario', title: '三冠の試算条件を変更',
    description: '佐藤輝明の残り打数とライバルのペースを変更し、画面の試算結果を返します。実成績は変更しません。',
    inputSchema: { type: 'object', properties: { additional_at_bats: { type: 'integer', minimum: 0, maximum: 300 },
      rival_mode: { type: 'string', enum: ['frozen', 'season'] } }, required: ['additional_at_bats', 'rival_mode'], additionalProperties: false },
    annotations: { readOnlyHint: false, untrustedContentHint: true },
    execute(input) {
      if (!state.data) throw new Error('成績の読み込みを待ってください');
      const range = $('#remaining-ab');
      if (Object.keys(input).some(k => !['additional_at_bats', 'rival_mode'].includes(k))
          || input.additional_at_bats > Number(range.max) || (range.disabled && input.additional_at_bats !== 0)) throw new Error('画面の入力範囲を超えています');
      const result = projectScenario(state.data, input.additional_at_bats, input.rival_mode);
      state.additionalAB = input.additional_at_bats; state.mode = input.rival_mode;
      range.value = String(state.additionalAB); $('#scenario-mode').value = state.mode; renderScenario();
      return { additional_at_bats: state.additionalAB, rival_mode: state.mode,
        needed: Object.fromEntries(Object.entries(result.results).map(([key, val]) => [key, val.needed])) };
    },
  };
  try { Promise.resolve(document.modelContext.registerTool(tool, { signal: controller.signal })).catch(() => {}); } catch { /* Unsupported experimental API must not affect the page. */ }
}

load();
