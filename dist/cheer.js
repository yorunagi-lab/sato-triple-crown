import { spawnCheerGorilla } from './effects.js?v=7';

const STORAGE_KEY = 'sato-cheers-local-v1';
const $ = selector => document.querySelector(selector);
const messages = ['その一振りに、もうひと押し。', '三つの頂点へ。LET’S GO, TERU!', '今日も、次の一打を信じて。'];
const number = value => new Intl.NumberFormat('ja-JP').format(value);
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

export function validateCheerResponse(value) {
  if (!value || !Number.isSafeInteger(value.total) || value.total < 0) throw new Error('Invalid cheer count');
  return value;
}

export function initCheers() {
  const button = $('#cheer-button'), total = $('#cheer-total'), message = $('#cheer-message');
  let endpoint = null, mode = 'loading', localCount = 0, persistent = true, shownTotal = null, refreshing = false;
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    localCount = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
    localStorage.setItem(STORAGE_KEY, String(localCount));
  } catch { persistent = false; }
  total.textContent = number(localCount);
  // Visual feedback never waits for storage, the network or another animation.
  let waitingForConfig = 0, queue = [], sending = false, flushTimer = null, unconfirmed = false;
  let streak = 0, lastTap = 0;

  function setSharedCount(count) {
    // Read responses may arrive after a newer POST. A public counter only increases.
    shownTotal = Math.max(shownTotal ?? 0, count);
    total.textContent = number(shownTotal);
  }
  async function getCount() {
    if (!endpoint || refreshing) return;
    refreshing = true;
    try {
      const r = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.timeout(8000), credentials: 'omit' });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      setSharedCount(validateCheerResponse(await r.json()).total);
      $('#cheer-count-note').textContent = 'みんなが送ったエールの累計';
    } catch {
      $('#cheer-count-note').textContent = shownTotal === null ? '集計を読み込めませんでした。時間をおいてお試しください。' : '前回確認した累計を表示しています';
    } finally { refreshing = false; }
  }
  async function sendCount(eventIds) {
    // Reusing all receipt IDs makes a batched network retry safe after an uncertain response.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventIds }), credentials: 'omit', keepalive: true, signal: AbortSignal.timeout(8000) });
        if (r.status === 429 && !attempt) {
          await pause(Math.min(10, Math.max(1, Number(r.headers.get('Retry-After')) || 1)) * 1000);
          continue;
        }
        if (r.status === 429) { const error = new Error('rate-limited'); error.permanent = true; throw error; }
        if (!r.ok) { const error = new Error(`HTTP ${r.status}`); error.permanent = r.status < 500; throw error; }
        return validateCheerResponse(await r.json());
      } catch (error) {
        if (attempt || error.permanent) throw error;
        await pause(500);
      }
    }
  }
  function scheduleFlush() {
    if (!sending && !flushTimer && queue.length) flushTimer = setTimeout(flush, 220);
  }
  async function flush() {
    flushTimer = null;
    if (sending || !queue.length) return;
    sending = true;
    const batch = queue.splice(0, 40);
    try {
      const result = await sendCount(batch);
      setSharedCount(result.total);
      message.textContent = unconfirmed ? '集計結果を確認できていないエールがあります。' : queue.length ? '連打のエールを集計しています…' : 'エールを届けました。続けて応援できます。';
      $('#cheer-count-note').textContent = 'みんなが送ったエールの累計';
    } catch (error) {
      unconfirmed = true;
      message.textContent = error.message === 'rate-limited' ? '一部のエールが混雑で集計されませんでした。演出は続けられます。' : '一部の送信結果を確認できませんでした。累計を再確認します。';
      await getCount();
    } finally {
      sending = false;
      scheduleFlush();
    }
  }
  function register(count = 1) {
    if (mode === 'shared') {
      for (let i = 0; i < count; i++) queue.push(crypto.randomUUID());
      scheduleFlush();
    } else if (mode === 'local') {
      localCount += count;
      try { localStorage.setItem(STORAGE_KEY, String(localCount)); } catch { persistent = false; }
      total.textContent = number(localCount);
      $('#cheer-count-note').textContent = persistent ? 'この端末で押した回数' : 'この画面を開いてからの回数';
    } else if (mode === 'loading') waitingForConfig += count;
  }
  button.addEventListener('click', () => {
    spawnCheerGorilla();
    const now = performance.now();
    streak = now - lastTap < 1500 ? streak + 1 : 1;
    lastTap = now;
    register();
    const cheer = streak > 1 ? `${number(streak)}連打。ゴリラも応援中。` : messages[(Math.max(1, localCount) - 1) % messages.length];
    message.textContent = mode === 'loading' ? '回数の保存先を確認しています…' : mode === 'unavailable' ? '演出だけを再生しています。回数の記録は再読込後にお試しください。' : mode === 'shared' ? `${cheer} 集計中…` : cheer;
  });
  window.addEventListener('storage', event => {
    if (mode !== 'local' || event.key !== STORAGE_KEY) return;
    const count = Number(event.newValue);
    if (Number.isSafeInteger(count) && count >= 0) { localCount = count; total.textContent = number(count); }
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && mode === 'shared') getCount(); });
  const observer = new IntersectionObserver(entries => {
    if (entries.some(e => e.isIntersecting) && mode === 'shared') getCount();
  }, { threshold: .15 });
  observer.observe($('#cheer-section'));
  setInterval(() => {
    if (mode !== 'shared' || document.hidden) return;
    const rect = $('#cheer-section').getBoundingClientRect();
    if (rect.top < innerHeight && rect.bottom > 0) getCount();
  }, 60000);

  fetch('./cheer-config.json', { cache: 'no-store', signal: AbortSignal.timeout(8000) }).then(r => {
    if (!r.ok) throw new Error('Cheer configuration unavailable'); return r.json();
  }).then(async config => {
    if (config.endpoint) {
      const url = new URL(config.endpoint);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('HTTPS endpoint required');
      endpoint = url.href; mode = 'shared';
      $('#cheer-count-label').textContent = 'みんなのエール'; total.textContent = '—';
      $('#cheer-count-note').textContent = '累計を読み込んでいます';
      await getCount();
    } else {
      mode = 'local';
      $('#cheer-count-note').textContent = persistent ? 'この端末で押した回数' : 'この画面を開いてからの回数';
    }
  }).catch(() => {
    mode = 'unavailable'; total.textContent = '—';
    $('#cheer-count-note').textContent = '回数を読み込めません。演出は楽しめます。';
  }).finally(() => {
    if (waitingForConfig && mode !== 'unavailable') register(waitingForConfig);
    waitingForConfig = 0;
  });
}
