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
  const overlay = $('#cheer-overlay'), stage = $('#gorilla-stage');
  let endpoint = null, mode = 'loading', localCount = 0, persistent = true, busy = false, shownTotal = null, refreshing = false;
  try {
    const raw = Number(localStorage.getItem(STORAGE_KEY));
    localCount = Number.isSafeInteger(raw) && raw >= 0 ? raw : 0;
    localStorage.setItem(STORAGE_KEY, String(localCount));
  } catch { persistent = false; }
  total.textContent = number(localCount);
  button.disabled = true;
  let mascot = fetch('./gorilla.svg', { signal: AbortSignal.timeout(5000) }).then(r => {
    if (!r.ok) throw new Error('Mascot unavailable');
    return r.text();
  }).then(text => {
    const svg = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    if (svg.localName !== 'svg') throw new Error('Invalid mascot');
    stage.replaceChildren(document.importNode(svg, true));
  }).catch(() => {
    const image = new Image(); image.src = './gorilla.svg'; image.alt = ''; image.style.width = '100%'; stage.replaceChildren(image);
  });

  for (let i = 0; i < 20; i++) {
    const piece = document.createElement('i');
    piece.style.setProperty('--x', `${Math.round(Math.cos(i * 2.399) * (150 + i * 9))}px`);
    piece.style.setProperty('--y', `${-140 - (i % 6) * 47}px`);
    piece.style.setProperty('--r', `${i * 43}deg`);
    piece.style.setProperty('--delay', `${(i % 4) * .035}s`);
    $('#cheer-confetti').append(piece);
  }

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
  async function sendCount(eventId) {
    // The same receipt ID makes one network retry safe after an uncertain response.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventId }), credentials: 'omit', signal: AbortSignal.timeout(8000) });
        if (r.status === 429) { const error = new Error('rate-limited'); error.permanent = true; throw error; }
        if (!r.ok) { const error = new Error(`HTTP ${r.status}`); error.permanent = r.status < 500; throw error; }
        return validateCheerResponse(await r.json());
      } catch (error) {
        if (attempt || error.permanent) throw error;
        await pause(500);
      }
    }
  }
  async function animate() {
    await mascot;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    overlay.hidden = false;
    overlay.classList.toggle('is-reduced', reduced);
    overlay.classList.toggle('is-playing', !reduced);
    await pause(reduced ? 1000 : 2700);
    overlay.hidden = true;
    overlay.classList.remove('is-playing', 'is-reduced');
  }
  async function register() {
    if (mode === 'shared') {
      try {
        const result = await sendCount(crypto.randomUUID());
        setSharedCount(result.total);
        message.textContent = 'エールを届けました。みんなの累計に加わりました。';
        $('#cheer-count-note').textContent = 'みんなが送ったエールの累計';
      } catch (error) {
        message.textContent = error.message === 'rate-limited' ? '少し間をあけて、もう一度エールを。' : '送信結果を確認できませんでした。累計を再確認します。';
        await getCount();
      }
    } else if (mode === 'local') {
      localCount++;
      try { localStorage.setItem(STORAGE_KEY, String(localCount)); } catch { persistent = false; }
      total.textContent = number(localCount);
      $('#cheer-count-note').textContent = persistent ? 'この端末で押した回数' : 'この画面を開いてからの回数';
      message.textContent = messages[(localCount - 1) % messages.length];
    } else message.textContent = '演出だけを再生しました。回数の記録は再読込後にお試しください。';
  }
  button.addEventListener('click', async () => {
    if (busy) return;
    busy = true; button.disabled = true;
    message.textContent = mode === 'shared' ? 'エールを送っています…' : 'LET’S GO, TERU!';
    try { await Promise.all([animate(), register()]); }
    finally { busy = false; button.disabled = false; }
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
  }).finally(() => { button.disabled = false; });
}
