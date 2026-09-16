const KEY = 'sato-effects-enabled-v1';
let enabled = true;
try { enabled = localStorage.getItem(KEY) !== 'off'; } catch { /* In-memory setting still works. */ }
const listeners = new Set();
export const effectsEnabled = () => enabled;
export const onEffectsChange = listener => listeners.add(listener);

export function initPreferences() {
  const button = document.querySelector('#effects-toggle');
  const note = document.querySelector('#effects-note');
  function render() {
    button.setAttribute('aria-pressed', String(enabled));
    button.querySelector('strong').textContent = enabled ? 'ON' : 'OFF';
    note.textContent = enabled ? 'タップでゴリラが登場' : '演出はお休み。応援の回数は記録します';
    document.querySelectorAll('.metric-select').forEach(select => {
      select.setAttribute('aria-label', select.getAttribute('aria-label').replace(/を選択.*$/, enabled ? 'を選択してゴリラの演出を再生' : 'を選択'));
    });
  }
  function change(value) {
    enabled = value; render();
    for (const listener of listeners) listener(enabled);
  }
  button.addEventListener('click', () => {
    change(!enabled);
    try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); }
    catch { note.textContent += '（設定の保存はできません）'; }
  });
  window.addEventListener('storage', event => { if (event.key === KEY || event.key === null) change(event.newValue !== 'off'); });
  render();
}
