// Original vector scenes: side, umpire eye-level and overhead cameras.
// All markup is static artwork, never interpolated from visitor input.
const ink = '#141c13', fur = '#404d3b', skin = '#a6b399', gold = '#f5cf60';
const ball = '<circle r="7" fill="#fffbea" stroke="#b4baa6" stroke-width="1.2"/><path d="M-3-6Q2 0-3 6M3-6Q-2 0 3 6" fill="none" stroke="#c36651" stroke-width="1"/>';
const sideFace = `<path d="M-36-31L-29-51L-12-40L4-54L20-33Q37-21 36-2L52 8L53 28Q41 47 7 44Q-36 46-43 15Q-53-14-36-31Z" fill="${fur}" stroke="${ink}" stroke-width="4"/>
  <path d="M8-12Q31-19 34-1L49 8L47 28Q33 43 9 33L-2 16Z" fill="${skin}" stroke="${ink}" stroke-width="3"/><ellipse cx="-25" cy="5" rx="12" ry="17" fill="#829075" stroke="${ink}" stroke-width="4"/>
  <path d="M9-9L30-5" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><circle cx="25" cy="3" r="4" fill="${ink}"/><path d="M35 9L47 12L43 20H34Z" fill="${ink}"/><path d="M22 28L41 28" stroke="${ink}" stroke-width="3"/>
  <path d="M-44-29Q-10-40 34-22L33-9Q-13-25-42-15Z" fill="${gold}" stroke="${ink}" stroke-width="3"/><path d="M-42-22L-62-35L-56-11L-71 0L-41-10Z" fill="${gold}" stroke="${ink}" stroke-width="3"/>`;
const svg = (body, cls = '') => `<svg class="baseball-scene ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 340" fill="none">${body}</svg>`;
// Side camera from the third-base side: the left-handed batter stands beyond
// the plate. The plate point faces screen-left (catcher), pitcher is screen-right.
const field = `<g class="scene-scenery side-field">
  <path d="M232 311L560 219M232 311L560 339" stroke="#e5e2c8" stroke-width="2"/>
  <path class="side-batter-box" d="M121 264H313L341 298H134Z" stroke="#ede7c9" stroke-width="2"/>
  <path class="side-home-plate" d="M232 311L249 301H274V321H249Z" fill="#fff5d9" stroke="#c5bea3" stroke-width="1.5"/>
  <path d="M421 258L535 238" stroke="#adba90" stroke-width="2"/>
</g>`;
function battingRig(view, torso = '') {
  const arm = name => `<g data-arm="${name}"><path class="arm-outline"/><path class="arm-upper"/><path class="arm-forearm"/></g>`;
  return `<g class="batting-rig" data-view="${view}">${arm('back')}${torso}${arm('front')}<path class="held-bat"/><path class="bat-grip"/><g class="bat-hands"><g data-hand="back"><ellipse rx="11" ry="10"/><path d="M-5-3H5M-5 2H5"/></g><g data-hand="front"><ellipse rx="11" ry="10"/><path d="M-5-3H5M-5 2H5"/></g></g></g>`;
}
function sideBatter() {
  return `<g class="batter-side">
    <ellipse cx="188" cy="282" rx="92" ry="12" fill="#bfc6a1" opacity=".1"/>
    <g class="batter-weight"><path d="M149 218L137 272L111 280L111 289H161L181 230L204 266L231 288H268L266 278L237 253L216 207Z" fill="#34402d" stroke="${ink}" stroke-width="5"/>
    <path d="M152 111Q119 136 133 204L149 229Q182 244 218 213Q236 167 209 122Z" fill="${fur}" stroke="${ink}" stroke-width="5"/>
    <path d="M186 132Q221 145 213 202L181 221L170 166Z" fill="#8b9c7b"/>
    <text x="150" y="203" fill="${gold}" font-family="Arial" font-weight="900" font-size="34" transform="rotate(-9 150 203)">8</text>
    ${battingRig('side')}
    <g transform="translate(173 103) scale(.88)">${sideFace}</g>
    </g></g>`;
}
function contact(x, y, cls = '') {
  return `<g class="contact-flash ${cls}" transform="translate(${x} ${y})"><path d="M0-33L7-11L26-23L16-4L40 3L15 11L24 33L4 19L-11 36L-12 13L-35 16L-20 0L-33-19L-10-12Z" fill="${gold}"/><circle r="12" fill="#fffde4"/></g>`;
}
function sideHit() {
  return svg(`${field}<g class="avg-side-batter" transform="translate(34 -4)">${sideBatter()}</g><path class="hit-trail" d="M358 168L540 98" stroke="${gold}" stroke-width="3" stroke-dasharray="260"/>${contact(358,168)}<g class="hit-ball-side">${ball}</g>`);
}
function plateHit() {
  // Eye-level camera in the umpire's slot, immediately behind the catcher.
  // Shallow field perspective, a small distant pitcher and cropped foreground
  // catcher establish depth; the nearby left-handed batter fills screen-right.
  const torso = `<g class="plate-torso"><path d="M374 126Q402 119 418 145Q434 174 417 216Q389 241 356 212Q343 181 354 151Z" fill="${fur}" stroke="${ink}" stroke-width="5"/>
    <path d="M371 142Q348 162 358 197L376 216Q386 184 381 157Z" fill="#8b9c7b"/>
    <path d="M402 141Q419 163 411 190" stroke="#58694c" stroke-width="8" stroke-linecap="round"/>
    <text x="394" y="218" text-anchor="middle" fill="${gold}" font-family="Arial" font-weight="900" font-size="31" transform="rotate(9 394 218)">8</text></g>`;
  return svg(`<g class="scene-scenery plate-field">
    <path class="field-horizon" d="M12 151Q280 141 548 151M12 169Q280 156 548 169" stroke="#9aaa7a" stroke-width="2"/>
    <path d="M22 151V168M87 149V165M150 147V162M214 145V160M345 145V160M410 147V162M474 149V165M538 151V168" stroke="#7e8d64" stroke-width="1.5"/>
    <path d="M8 206Q268 187 552 206" stroke="#b2b995" stroke-width="2"/>
    <path d="M280 310L-20 224M280 310L580 224" stroke="#e5e2c8" stroke-width="2.5"/>
    <ellipse class="pitcher-mound" cx="268" cy="190" rx="31" ry="5" fill="#ba9e67" fill-opacity=".3" stroke="#cdb17b" stroke-width="2"/><path d="M261 187H275" stroke="#f3efd7" stroke-width="3"/>
    <path class="batter-box" d="M318 276H446L530 331H320ZM242 276H114L30 331H240Z" stroke="#ede7c9" stroke-width="2"/>
    <path class="home-plate" d="M263 294H297L307 304L280 317L254 304Z" fill="#fff5d9" stroke="#c5bea3" stroke-width="1.5"/>
    </g>
    <g class="distant-pitcher" fill="#7f9073" stroke="${ink}" stroke-width="1.7" stroke-linejoin="round">
      <path d="M270 151L263 175L253 186L263 188L278 169L290 186H300L296 180L285 152Z"/>
      <path d="M270 127Q279 122 287 131L291 156Q275 162 267 153Z" fill="#b8c0ab"/>
      <path d="M275 131L264 142L256 143L257 149L269 147L281 135Z"/>
      <path d="M285 131L300 143L295 151L287 147L278 138Z"/>
      <ellipse cx="278" cy="118" rx="9" ry="10" fill="#a6b399"/>
      <path d="M267 115Q270 103 282 108L287 115Z" fill="#687e50"/><path d="M266 115H288" stroke="#d8bd68" stroke-width="3"/>
      <ellipse cx="293" cy="148" rx="6" ry="7" fill="#a1814c"/>
    </g>
    <g class="plate-batter" transform="translate(-92 -42) scale(1.3)">
      <path class="plate-legs" d="M359 208L350 249L332 262V274H366L386 232L403 260L421 282H452V273L429 250L414 211Z" fill="#34402d" stroke="${ink}" stroke-width="5"/>
      <path d="M336 269H361M425 277H448" stroke="#627354" stroke-width="5" stroke-linecap="round"/>
      ${battingRig('plate', torso)}
      <g class="plate-head" transform="translate(385 116) rotate(16) scale(-.8 .8)">${sideFace}</g>
    </g>
    <path class="plate-speed" d="M270 230L237 179M279 229L266 176" stroke="${gold}" stroke-width="2"/>
    ${contact(272,234)}<g class="hit-ball-plate">${ball}</g>
    <g class="catcher-foreground">
      <path d="M111 340Q147 320 180 321H236Q271 325 309 340" fill="#344231" stroke="#718164" stroke-width="3"/>
      <path d="M240 329L260 299L282 278" fill="none" stroke="#52644a" stroke-width="19" stroke-linecap="round"/>
      <g class="catcher-mitt" transform="translate(284 271) rotate(-15)">
        <path d="M-16 10Q-28-3-19-18Q-14-25-8-16Q-5-29 2-21Q10-26 15-16Q26-14 24-2L14 17Q0 24-16 10Z" fill="#b18b4c" stroke="#3d3624" stroke-width="3"/>
        <path d="M-11-8Q0-15 13-6L8 10Q-3 16-11-8Z" fill="#5f5135"/><path d="M-18-12L-12-8M-7-20L-5-12M4-21L5-13M15-15L11-9M19-1L13 0" stroke="#e0c184" stroke-width="2"/>
      </g>
      <path class="catcher-helmet" d="M151 340L152 318Q155 285 208 284Q256 286 264 320L267 340Z" fill="#344332" stroke="#87967a" stroke-width="3"/>
      <path d="M203 286Q192 310 194 340M216 286Q230 311 227 340" stroke="#596d4d" stroke-width="8"/>
      <path d="M156 322Q207 309 260 324M158 331Q207 322 264 333" stroke="#202c20" stroke-width="6"/>
    </g>`, 'umpire-scene');
}
function topHit() {
  return svg(`<g class="top-left-handed" transform="translate(560 0) scale(-1 1)"><g class="scene-scenery"><path d="M280 26L519 214L280 340L41 214Z" stroke="#c1bb89" stroke-width="2"/><path d="M280 295L29 105M280 295L531 105" stroke="#f3eccc" stroke-width="2"/><path d="M268 286H292V299L280 309L268 299Z" fill="#fff2d4"/></g>
    <g class="top-batter"><g transform="translate(213 240)"><path d="M-40-4L-53 43L-31 50L-9 14L21 45L43 33L32-14Z" fill="#34402d" stroke="${ink}" stroke-width="5"/><ellipse cy="-13" rx="49" ry="54" fill="${fur}" stroke="${ink}" stroke-width="5"/>
    <text x="0" y="20" text-anchor="middle" fill="${gold}" font-family="Arial" font-weight="900" font-size="27">8</text></g>${battingRig('top')}
    <g transform="translate(213 240)"><path d="M-41-48Q0-70 36-47L31-24Q0-35-35-21Z" fill="#56654a" stroke="${ink}" stroke-width="4"/><path d="M-33-41Q0-54 34-42L32-33Q0-43-31-31Z" fill="${gold}"/></g></g>
    <path class="hit-trail" d="M359 221L449 32" stroke="${gold}" stroke-width="3" stroke-dasharray="260"/>${contact(359,221)}<g class="hit-ball-top">${ball}</g></g>`);
}
function stadium() {
  let seats = '';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 18; col++) {
    seats += `<rect x="${17+col*30}" y="${52+row*17}" width="20" height="9" rx="2" fill="${(col+row)%3 ? '#65764b' : '#c5af56'}"/>`;
  }
  return `<g class="scene-scenery stadium-lines"><path d="M0 40Q280 7 560 40V132Q280 103 0 132Z" fill="none" stroke="#62744d" stroke-width="2"/>${seats}<path d="M0 124Q280 103 560 124V147H0Z" fill="none"/><path d="M0 143H560" stroke="${gold}" stroke-width="3"/><text x="280" y="135" text-anchor="middle" fill="#b3bd97" font-family="Arial" font-size="10" letter-spacing="5">THE TRIPLE CROWN CHASE</text><path d="M38 40V12M521 40V12" stroke="#7d8966" stroke-width="4"/><path d="M26 10H51M510 10H535" stroke="#fff1b1" stroke-width="7"/></g>`;
}
function homeRun() {
  return svg(`${stadium()}<g class="scene-scenery"><path d="M249 269L556 177M249 269L0 318" stroke="#e5dfc0" stroke-width="2"/></g>
    <g class="hr-hitter" transform="translate(-12 19) scale(.9)">${sideBatter()}</g>
    <path class="hr-flight-path" d="M280 174Q363-100 470 94" stroke="${gold}" stroke-width="3" stroke-dasharray="370" stroke-linecap="round"/>
    <g class="hr-ball">${ball}</g><g class="hr-hit-flash">${contact(280,174)}</g>
    <g class="stand-impact"><circle cx="470" cy="94" r="21" fill="${gold}" opacity=".18"/><path d="M470 61V72M470 118V130M437 94H449M490 94H504M445 69L452 76M489 112L498 120M496 68L488 76" stroke="${gold}" stroke-width="4" stroke-linecap="round"/><path d="M444 105L443 86L435 78M443 87L451 78M485 109V90L478 84M485 91L494 80" stroke="#fff0b1" stroke-width="4" stroke-linecap="round"/></g>
    <g class="hr-result"><text x="422" y="202" text-anchor="middle" fill="${gold}" font-family="Arial" font-size="23" font-weight="900" font-style="italic">HOME RUN</text><text x="422" y="224" text-anchor="middle" fill="#f9f2cf" font-size="12">スタンドへ、その一振り。</text></g>`, 'home-run-scene');
}
function sandClouds() {
  return '<defs><radialGradient id="sato-sand-haze"><stop stop-color="#e6cc94" stop-opacity=".8"/><stop offset=".55" stop-color="#d5b57a" stop-opacity=".6"/><stop offset="1" stop-color="#be995f" stop-opacity="0"/></radialGradient></defs><g class="sand-clouds">' + Array.from({ length: 20 }, (_, i) => {
    const x = 72 + i * 7, y = 271 - (i % 3) * 4;
    const delay = .84 + i * .041;
    return `<g transform="translate(${x} ${y})"><ellipse class="dust-puff" rx="${9 + i % 5 * 2}" ry="${6 + i % 4 * 2}" fill="url(#sato-sand-haze)" style="--delay:${delay}s;--duration:${1.7 + i % 4 * .17}s;--dx:${-25 - i % 6 * 12}px;--dy:${-14 - i % 5 * 9}px"/></g>`;
  }).join('') + '</g>';
}
function sandGrains() {
  return '<g class="sand-grains">' + Array.from({ length: 22 }, (_, i) => {
    const forward = i > 13;
    return `<g transform="translate(${forward ? 439 + i % 4 * 4 : 150 + i % 6 * 14} ${268 + i % 3 * 3})"><circle class="sand-grain" r="${1.4 + i % 3}" fill="#eddaa3" style="--delay:${(forward ? 1.72 : 1.1) + i % 7 * .045}s;--dx:${forward ? 18 + i % 6 * 8 : -25 - i % 7 * 9}px;--lift:${-15 - i % 5 * 9}px"/></g>`;
  }).join('') + '</g>';
}
function sliding() {
  return svg(`<g class="scene-scenery"><path d="M0 299L459 275L560 205M459 275L552 340" stroke="#f5eccc" stroke-width="3"/></g><path d="M422 258L464 254L487 270L465 290L424 283Z" fill="#fff5d9" stroke="#746446" stroke-width="2" opacity=".55"/>
    ${sandClouds()}
    <g class="sliding-gorilla"><ellipse cx="144" cy="282" rx="143" ry="10" fill="#322d1c" opacity=".2"/>
    <g class="slide-legs"><path d="M74 223L22 185L-18 198L-21 216L17 215L46 254Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M90 238L42 256L-5 239L-17 252L32 280L103 266Z" fill="#303c2b" stroke="${ink}" stroke-width="5"/></g>
    <path d="M68 215Q106 182 173 207L209 240Q183 278 99 276Q53 260 68 215Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M87 260Q144 240 196 253L184 269L108 278Z" fill="#8c9c7c"/><text x="119" y="242" fill="${gold}" font-family="Arial" font-size="35" font-weight="900" transform="rotate(73 119 242)">8</text>
    <path d="M153 223Q181 196 208 219L265 248L307 254L310 267L275 273L203 250L170 255Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M264 248L306 251Q327 256 312 269L279 273Z" fill="${skin}" stroke="${ink}" stroke-width="4"/>
    <g transform="translate(216 211) rotate(22) scale(.8)">${sideFace}</g>
    <path d="M178 235Q180 262 208 268L286 276L322 272L323 260L285 259L222 242Z" fill="#58694c" stroke="${ink}" stroke-width="5"/><path d="M286 259L316 255Q333 258 326 271L290 277Z" fill="${skin}" stroke="${ink}" stroke-width="4"/>
    <path d="M310 260L325 260M310 266L325 266" stroke="#53634a" stroke-width="2"/></g>
    ${sandGrains()}<g class="slide-contact"><path d="M469 235L470 221M486 244L499 231M495 259L513 258" stroke="${gold}" stroke-width="4" stroke-linecap="round"/></g>
    <g class="slide-safe"><text x="374" y="125" text-anchor="middle" fill="${gold}" font-family="Arial" font-size="64" font-weight="900" font-style="italic" transform="rotate(-9 374 125)">SAFE!</text><text x="371" y="157" text-anchor="middle" fill="#f7efd0" font-size="14">その一点を、もぎ取れ。</text></g>`, 'sliding-scene');
}

export function baseballScene(metric) {
  if (metric === 'avg') return `<div class="camera-frame camera-side" style="--start:0s"><span class="camera-label">01 / SIDE — インパクト</span>${sideHit()}</div><div class="camera-frame camera-plate" style="--start:1.2s"><span class="camera-label">02 / UMPIRE POV — 球審の目線</span>${plateHit()}</div><div class="camera-frame camera-top" style="--start:2.4s"><span class="camera-label">03 / TOP — 真上</span>${topHit()}</div><div class="camera-progress"><i></i><i></i><i></i></div>`;
  if (metric === 'hr') return `<div class="camera-frame"><span class="camera-label">FULL SWING → STAND IN</span>${homeRun()}</div>`;
  return `<div class="camera-frame"><span class="camera-label">HEADFIRST SLIDE → HOME</span>${sliding()}</div>`;
}

// Projected poses keep the bat in both hands. Shoulder anchors never orbit the
// body; two-link arm geometry finds each elbow, with a fixed bend direction.
const poses = {
  side: {
    arms: [{ shoulder: [153, 151], upper: 52, lower: 50, bend: 1 }, { shoulder: [201, 148], upper: 46, lower: 45, bend: -1 }],
    keys: [[0, 174, 157, 128, 42], [.22, 181, 160, 168, 50], [.46, 226, 181, 335, 170], [.70, 224, 165, 252, 88], [1, 211, 161, 98, 117]],
  },
  plate: {
    arms: [{ shoulder: [407, 157], upper: 56, lower: 58, bend: -1 }, { shoulder: [369, 158], upper: 50, lower: 52, bend: 1 }],
    keys: [[0, 407, 155, 460, 68], [.22, 410, 170, 494, 102], [.46, 355, 203, 268, 214], [.70, 345, 183, 330, 98], [1, 377, 145, 459, 111]],
  },
  top: {
    arms: [{ shoulder: [181, 229], upper: 54, lower: 53, bend: 1 }, { shoulder: [240, 223], upper: 50, lower: 50, bend: -1 }],
    keys: [[0, 250, 255, 282, 311], [.22, 265, 255, 318, 285], [.46, 278, 244, 368, 218], [.70, 277, 230, 349, 169], [1, 253, 215, 260, 124]],
  },
};
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
const point = p => p.map(n => n.toFixed(2)).join(' ');

function poseAt(view, t) {
  const keys = poses[view].keys;
  const end = keys.findIndex(k => k[0] >= t);
  if (end <= 0) return keys[end === -1 ? keys.length - 1 : 0].slice(1);
  const a = keys[end - 1], b = keys[end], f = (t - a[0]) / (b[0] - a[0]);
  const ease = f * f * (3 - 2 * f);
  return a.slice(1).map((v, i) => v + (b[i + 1] - v) * ease);
}
function elbowFor(arm, hand) {
  const [sx, sy] = arm.shoulder, dx = hand[0] - sx, dy = hand[1] - sy;
  const distance = Math.hypot(dx, dy), d = clamp(distance, Math.abs(arm.upper - arm.lower) + .001, arm.upper + arm.lower - .001);
  const ux = dx / Math.max(distance, .001), uy = dy / Math.max(distance, .001);
  const along = (arm.upper ** 2 - arm.lower ** 2 + d ** 2) / (2 * d);
  const across = Math.sqrt(Math.max(0, arm.upper ** 2 - along ** 2)) * arm.bend;
  return [sx + ux * along - uy * across, sy + uy * along + ux * across];
}
function bindRig(root) {
  const view = root.dataset.view;
  return {
    root, view, start: parseFloat(root.closest('.camera-frame').style.getPropertyValue('--start') || 0) * 1000,
    bat: root.querySelector('.held-bat'), grip: root.querySelector('.bat-grip'),
    arms: ['back', 'front'].map((name, index) => ({
      ...poses[view].arms[index],
      outline: root.querySelector(`[data-arm="${name}"] .arm-outline`),
      upperPath: root.querySelector(`[data-arm="${name}"] .arm-upper`),
      forearm: root.querySelector(`[data-arm="${name}"] .arm-forearm`),
      hand: root.querySelector(`[data-hand="${name}"]`),
    })),
  };
}
function drawRig(rig, t) {
  const [gx, gy, tx, ty] = poseAt(rig.view, t);
  const length = Math.hypot(tx - gx, ty - gy), ux = (tx - gx) / length, uy = (ty - gy) / length;
  const nx = -uy, ny = ux;
  const knob = [gx - ux * 21, gy - uy * 21];
  rig.bat.setAttribute('d', `M${point([knob[0] + nx * 3, knob[1] + ny * 3])}L${point([tx + nx * 6, ty + ny * 6])}Q${point([tx + ux * 6, ty + uy * 6])} ${point([tx - nx * 6, ty - ny * 6])}L${point([knob[0] - nx * 3, knob[1] - ny * 3])}Z`);
  rig.grip.setAttribute('d', `M${point([knob[0] - nx * 5, knob[1] - ny * 5])}L${point([knob[0] + nx * 5, knob[1] + ny * 5])}`);
  rig.arms.forEach((arm, i) => {
    const offset = i ? 9 : -8, hand = [gx + ux * offset, gy + uy * offset], elbow = elbowFor(arm, hand);
    arm.outline.setAttribute('d', `M${point(arm.shoulder)}L${point(elbow)}L${point(hand)}`);
    arm.upperPath.setAttribute('d', `M${point(arm.shoulder)}L${point(elbow)}`);
    arm.forearm.setAttribute('d', `M${point(elbow)}L${point(hand)}`);
    arm.hand.setAttribute('transform', `translate(${point(hand)}) rotate(${Math.atan2(uy, ux) * 180 / Math.PI})`);
  });
}

// Explicit frame rendering also makes the critical swing poses reviewable.
export function renderBattingFrame(scene, elapsed) {
  for (const root of scene.querySelectorAll('.batting-rig')) {
    const rig = bindRig(root);
    drawRig(rig, clamp((elapsed - rig.start - 100) / 1000, 0, 1));
  }
}
export function animateBaseballScene(scene, reduced) {
  const rigs = [...scene.querySelectorAll('.batting-rig')].map(bindRig);
  if (!rigs.length) return () => {};
  if (reduced) {
    rigs.forEach(rig => drawRig(rig, .46));
    return () => {};
  }
  let frame = 0, stopped = false;
  const start = performance.now();
  function tick(now) {
    if (stopped || !scene.isConnected) return;
    const elapsed = now - start;
    rigs.forEach(rig => drawRig(rig, clamp((elapsed - rig.start - 100) / 1000, 0, 1)));
    if (elapsed < 3600) frame = requestAnimationFrame(tick);
  }
  tick(start);
  return () => { stopped = true; cancelAnimationFrame(frame); };
}
