import { baseballScene, animateBaseballScene } from './baseball-scenes.js?v=6';

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
let serial = 0, mascotTemplate = null, metricTimer = null, stopMetricMotion = () => {};
const mascotReady = fetch('./gorilla.svg?v=6', { signal: AbortSignal.timeout(5000) })
  .then(r => { if (!r.ok) throw new Error('Mascot unavailable'); return r.text(); })
  .then(text => {
    const root = new DOMParser().parseFromString(text, 'image/svg+xml').documentElement;
    if (root.localName !== 'svg') throw new Error('Invalid mascot');
    mascotTemplate = root;
  }).catch(() => { /* The regular image remains available as a fallback. */ });

function addMascot(node, id) {
  if (!node.isConnected || !mascotTemplate) return;
  const clone = document.importNode(mascotTemplate, true);
  const ids = new Map();
  for (const element of clone.querySelectorAll('[id]')) {
    ids.set(element.id, `cheer-${id}-${element.id}`);
    element.id = ids.get(element.id);
  }
  for (const element of clone.querySelectorAll('*')) for (const attr of [...element.attributes]) {
    let value = attr.value;
    for (const [oldId, newId] of ids) value = value.replaceAll(`url(#${oldId})`, `url(#${newId})`);
    if (value !== attr.value) element.setAttribute(attr.name, value);
  }
  node.querySelector('.cheer-mascot').replaceChildren(clone);
}

export function spawnCheerGorilla() {
  const layer = document.querySelector('#cheer-overlay');
  if (!layer) return;
  const reduced = reducedMotion();
  // Bound only the number of live decorations. Every tap still counts.
  const cap = reduced ? 18 : 72;
  while (layer.childElementCount >= cap) layer.firstElementChild.remove();
  const pop = document.createElement('div'), id = ++serial;
  pop.className = `cheer-pop${reduced ? ' is-reduced' : ''}`;
  const viewport = window.visualViewport;
  const width = viewport?.width || innerWidth, height = viewport?.height || innerHeight;
  const size = Math.min(width * .46, 120 + Math.random() * 90);
  pop.style.width = `${size}px`;
  pop.style.left = `${Math.random() * Math.max(0, width - size)}px`;
  pop.style.top = `${Math.random() * Math.max(0, height - size - 38) + 18}px`;
  pop.style.setProperty('--lean', `${Math.random() * 20 - 10}deg`);
  pop.style.setProperty('--drum-speed', `${.25 + Math.random() * .13}s`);
  pop.innerHTML = '<div class="cheer-mascot"><img src="./gorilla.svg?v=6" alt=""></div><span class="pop-word">DON!</span><i class="pop-spark spark-one"></i><i class="pop-spark spark-two"></i><i class="pop-spark spark-three"></i>';
  layer.append(pop);
  if (mascotTemplate) addMascot(pop, id); else mascotReady.then(() => addMascot(pop, id));
  setTimeout(() => pop.remove(), reduced ? 1200 : 4800);
}

export function playMetricAnimation(metric) {
  if (!['avg', 'hr', 'rbi'].includes(metric)) return;
  const layer = document.querySelector('#metric-effects');
  if (!layer) return;
  clearTimeout(metricTimer);
  stopMetricMotion();
  const scene = document.createElement('div');
  const reduced = reducedMotion();
  scene.className = `metric-film film-${metric}${reduced ? ' is-reduced' : ''}`;
  const titles = { avg: 'HIT / 3 ANGLES', hr: 'HOME RUN', rbi: 'RUN BATTED IN' };
  scene.innerHTML = `<div class="film-heading"><b>SATO 8</b><span>${titles[metric]}</span></div><div class="film-screen">${baseballScene(metric)}</div>`;
  layer.replaceChildren(scene);
  stopMetricMotion = animateBaseballScene(scene, reduced);
  metricTimer = setTimeout(() => { stopMetricMotion(); scene.remove(); }, reduced ? 1300 : metric === 'avg' ? 3950 : 4350);
}
