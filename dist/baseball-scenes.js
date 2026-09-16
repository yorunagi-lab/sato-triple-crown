// Original vector scenes: independent side, front and overhead camera drawings.
// All markup is static artwork, never interpolated from visitor input.
const ink = '#141c13', fur = '#404d3b', skin = '#a6b399', gold = '#f5cf60';
const ball = '<circle r="7" fill="#fffbea" stroke="#b4baa6" stroke-width="1.2"/><path d="M-3-6Q2 0-3 6M3-6Q-2 0 3 6" fill="none" stroke="#c36651" stroke-width="1"/>';
const face = `<path d="M-39-24L-37-49L-20-39L-5-56L9-39L30-49L34-29C53-6 44 33 26 46Q0 61-29 44C-48 28-53-7-39-24Z" fill="${fur}" stroke="${ink}" stroke-width="4"/>
  <ellipse cx="-45" cy="3" rx="10" ry="16" fill="${skin}" stroke="${ink}" stroke-width="4"/><ellipse cx="45" cy="3" rx="10" ry="16" fill="${skin}" stroke="${ink}" stroke-width="4"/>
  <path d="M-34-11Q-17-25 0-7Q19-25 35-11L29 23H-29Z" fill="${skin}"/>
  <path d="M-32-12L-9-5M10-5L33-12" stroke="${ink}" stroke-width="7" stroke-linecap="round"/>
  <ellipse cx="-17" cy="4" rx="4" ry="5" fill="${ink}"/><ellipse cx="18" cy="4" rx="4" ry="5" fill="${ink}"/>
  <path d="M-32 20Q-28 10 0 15Q29 10 32 22Q33 46 0 48Q-32 47-32 20Z" fill="${skin}" stroke="${ink}" stroke-width="3"/>
  <path d="M-11 17Q0 11 11 17L8 27H-8Z" fill="${ink}"/><path d="M-17 34Q0 44 18 33" fill="none" stroke="${ink}" stroke-width="3.5" stroke-linecap="round"/>
  <path d="M-45-26Q0-43 45-26L43-12Q0-27-43-12Z" fill="${gold}" stroke="${ink}" stroke-width="3"/><path d="M42-25L67-36L60-17L70-5L44-12Z" fill="${gold}" stroke="${ink}" stroke-width="3"/>`;
const sideFace = `<path d="M-36-31L-29-51L-12-40L4-54L20-33Q37-21 36-2L52 8L53 28Q41 47 7 44Q-36 46-43 15Q-53-14-36-31Z" fill="${fur}" stroke="${ink}" stroke-width="4"/>
  <path d="M8-12Q31-19 34-1L49 8L47 28Q33 43 9 33L-2 16Z" fill="${skin}" stroke="${ink}" stroke-width="3"/><ellipse cx="-25" cy="5" rx="12" ry="17" fill="#829075" stroke="${ink}" stroke-width="4"/>
  <path d="M9-9L30-5" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><circle cx="25" cy="3" r="4" fill="${ink}"/><path d="M35 9L47 12L43 20H34Z" fill="${ink}"/><path d="M22 28L41 28" stroke="${ink}" stroke-width="3"/>
  <path d="M-44-29Q-10-40 34-22L33-9Q-13-25-42-15Z" fill="${gold}" stroke="${ink}" stroke-width="3"/><path d="M-42-22L-62-35L-56-11L-71 0L-41-10Z" fill="${gold}" stroke="${ink}" stroke-width="3"/>`;
const bat = `<path d="M-3 5L-6-111Q0-129 6-111L3 5Z" fill="#d5a766" stroke="${ink}" stroke-width="3"/><path d="M-3-5H3M-3-12H3M-3-19H3" stroke="#705c3c" stroke-width="3"/>`;
const svg = (body, cls = '') => `<svg class="baseball-scene ${cls}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 560 340" fill="none">${body}</svg>`;
const field = `<path d="M0 210Q280 160 560 210V340H0Z" fill="#253c2a"/><path d="M0 271Q270 199 560 264V340H0Z" fill="#8c7953"/><path d="M245 252L0 328M245 252L560 328" stroke="#e5e2c8" stroke-width="2" opacity=".65"/><path d="M230 252L249 246L269 252L265 263L246 270L229 263Z" fill="#f0ecd8"/>`;
function sideBatter() {
  return `<g class="batter-side">
    <ellipse cx="188" cy="282" rx="92" ry="12" fill="#131d12" opacity=".4"/>
    <g class="batter-weight"><path d="M149 218L137 272L111 280L111 289H161L181 230L204 266L231 288H268L266 278L237 253L216 207Z" fill="#34402d" stroke="${ink}" stroke-width="5"/>
    <path d="M152 111Q119 136 133 204L149 229Q182 244 218 213Q236 167 209 122Z" fill="${fur}" stroke="${ink}" stroke-width="5"/>
    <path d="M186 132Q221 145 213 202L181 221L170 166Z" fill="#8b9c7b"/>
    <text x="150" y="203" fill="${gold}" font-family="Arial" font-weight="900" font-size="34" transform="rotate(-9 150 203)">8</text>
    <g transform="translate(173 105) scale(.88)">${sideFace}</g>
    <g transform="translate(191 157)"><g class="bat-swing-side"><path d="M-38-16Q-65-4-45 21L4 39L23 15L-8-3Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M0 27L23 2L43 11L32 32L15 44Z" fill="${skin}" stroke="${ink}" stroke-width="4"/><g transform="translate(31 14) rotate(15)">${bat}</g></g></g>
    </g></g>`;
}
function contact(x, y, cls = '') {
  return `<g class="contact-flash ${cls}" transform="translate(${x} ${y})"><path d="M0-33L7-11L26-23L16-4L40 3L15 11L24 33L4 19L-11 36L-12 13L-35 16L-20 0L-33-19L-10-12Z" fill="${gold}"/><circle r="12" fill="#fffde4"/></g>`;
}
function sideHit() {
  return svg(`${field}<path d="M335 134L449 109M344 158L493 144M342 183L468 190" stroke="#637450" stroke-width="2" opacity=".45"/>${sideBatter()}<path class="hit-trail" d="M280 198L510 100" stroke="${gold}" stroke-width="3" stroke-dasharray="260"/>${contact(280,198)}<g class="hit-ball-side">${ball}</g>`);
}
function frontHit() {
  return svg(`<path d="M0 210L280 107L560 210V340H0Z" fill="#2a422c"/><path d="M280 130L560 340H0Z" fill="#887554"/><path d="M280 155L95 340M280 155L465 340" stroke="#ede7c9" stroke-width="2" opacity=".5"/>
    <g class="front-batter"><path d="M215 228L195 302L236 306L260 251L291 299L337 299L310 217Z" fill="#34402d" stroke="${ink}" stroke-width="5"/>
    <path d="M192 131Q159 181 198 250Q270 281 328 241Q351 183 314 130Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M228 149Q266 136 299 160L306 223Q267 265 221 226Z" fill="#93a384"/>
    <text x="264" y="237" text-anchor="middle" fill="${gold}" font-family="Arial" font-weight="900" font-size="38">8</text><g transform="translate(258 113) scale(1.06)">${face}</g>
    <g transform="translate(264 190)"><g class="bat-swing-front"><path d="M-74-27Q-102-4-69 25L-7 28L13 0L-46-18Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M59-24Q87-8 62 16L0 33L-9 3Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><ellipse cx="0" cy="10" rx="24" ry="18" fill="${skin}" stroke="${ink}" stroke-width="4"/><g transform="translate(10 2) rotate(69)">${bat}</g></g></g></g>
    <path class="front-speed" d="M155 154L20 68M395 154L544 52M156 247L43 323M397 246L541 328" stroke="${gold}" stroke-width="2"/>${contact(330,192)}<g class="hit-ball-front">${ball}</g>`);
}
function topHit() {
  return svg(`<path d="M0 0H560V340H0Z" fill="#253e2b"/><path d="M280 26L519 214L280 340L41 214Z" fill="#8c7953"/><path d="M280 66L455 207L280 298L105 207Z" fill="#345137"/><path d="M280 295L29 105M280 295L531 105" stroke="#f3eccc" stroke-width="2" opacity=".7"/><path d="M268 286H292V299L280 309L268 299Z" fill="#fff2d4"/>
    <ellipse cx="218" cy="251" rx="64" ry="27" fill="#132014" opacity=".35"/>
    <g transform="translate(213 240)"><path d="M-40-4L-53 43L-31 50L-9 14L21 45L43 33L32-14Z" fill="#34402d" stroke="${ink}" stroke-width="5"/><ellipse cy="-13" rx="49" ry="54" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M-41-48Q0-70 36-47L31-24Q0-35-35-21Z" fill="#56654a" stroke="${ink}" stroke-width="4"/><path d="M-33-41Q0-54 34-42L32-33Q0-43-31-31Z" fill="${gold}"/><text x="0" y="20" text-anchor="middle" fill="${gold}" font-family="Arial" font-weight="900" font-size="27">8</text>
    <g class="bat-swing-top"><path d="M32-14Q70-4 50 23L15 1" fill="${skin}" stroke="${ink}" stroke-width="13" stroke-linecap="round"/><g transform="translate(48 9) rotate(77) scale(.4)">${bat}</g></g></g>
    <path class="hit-trail" d="M308 231L449 32" stroke="${gold}" stroke-width="3" stroke-dasharray="260"/>${contact(308,231)}<g class="hit-ball-top">${ball}</g>`);
}
function stadium() {
  let seats = '';
  for (let row = 0; row < 4; row++) for (let col = 0; col < 18; col++) {
    seats += `<rect x="${17+col*30}" y="${52+row*17}" width="20" height="9" rx="2" fill="${(col+row)%3 ? '#65764b' : '#c5af56'}"/>`;
  }
  return `<path d="M0 40Q280 7 560 40V132Q280 103 0 132Z" fill="#344932" stroke="#62744d" stroke-width="2"/>${seats}<path d="M0 124Q280 103 560 124V147H0Z" fill="#182e21"/><path d="M0 143H560" stroke="${gold}" stroke-width="3"/><text x="280" y="135" text-anchor="middle" fill="#b3bd97" font-family="Arial" font-size="10" letter-spacing="5">THE TRIPLE CROWN CHASE</text><path d="M38 40V12M521 40V12" stroke="#7d8966" stroke-width="4"/><path d="M26 10H51M510 10H535" stroke="#fff1b1" stroke-width="7"/>`;
}
function homeRun() {
  return svg(`<rect width="560" height="340" fill="#142719"/>${stadium()}<path d="M0 147H560V340H0Z" fill="#2e482e"/><path d="M0 250Q240 209 390 340H0Z" fill="#887451"/><path d="M249 269L556 177M249 269L0 318" stroke="#e5dfc0" stroke-width="2" opacity=".7"/>
    <g class="hr-hitter" transform="translate(-12 19) scale(.9)">${sideBatter()}</g>
    <path class="hr-flight-path" d="M240 197Q353-108 470 94" stroke="${gold}" stroke-width="3" stroke-dasharray="370" stroke-linecap="round"/>
    <g class="hr-ball">${ball}</g><g class="hr-hit-flash">${contact(240,197)}</g>
    <g class="stand-impact"><circle cx="470" cy="94" r="21" fill="${gold}" opacity=".18"/><path d="M470 61V72M470 118V130M437 94H449M490 94H504M445 69L452 76M489 112L498 120M496 68L488 76" stroke="${gold}" stroke-width="4" stroke-linecap="round"/><path d="M444 105L443 86L435 78M443 87L451 78M485 109V90L478 84M485 91L494 80" stroke="#fff0b1" stroke-width="4" stroke-linecap="round"/></g>
    <g class="hr-result"><rect x="325" y="176" width="195" height="64" rx="3" fill="#15271e" stroke="${gold}"/><text x="422" y="202" text-anchor="middle" fill="${gold}" font-family="Arial" font-size="23" font-weight="900" font-style="italic">HOME RUN</text><text x="422" y="224" text-anchor="middle" fill="#f9f2cf" font-size="12">スタンドへ、その一振り。</text></g>`, 'home-run-scene');
}
function sliding() {
  return svg(`<path d="M0 118H560V245H0Z" fill="#263e2b"/><path d="M0 234L560 206V340H0Z" fill="#a08a60"/><path d="M0 299L459 275L560 205M459 275L552 340" stroke="#f5eccc" stroke-width="3"/><path d="M422 258L464 254L487 270L465 290L424 283Z" fill="#fff5d9" stroke="#746446" stroke-width="2"/>
    <g class="slide-dust" fill="#d3ba7d"><ellipse cx="173" cy="268" rx="66" ry="17"/><circle cx="137" cy="252" r="15"/><circle cx="195" cy="246" r="19"/><circle cx="225" cy="263" r="22"/><circle cx="103" cy="263" r="12"/></g>
    <g class="sliding-gorilla"><ellipse cx="144" cy="282" rx="143" ry="10" fill="#322d1c" opacity=".2"/>
    <g class="slide-legs"><path d="M74 223L22 185L-18 198L-21 216L17 215L46 254Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M90 238L42 256L-5 239L-17 252L32 280L103 266Z" fill="#303c2b" stroke="${ink}" stroke-width="5"/></g>
    <path d="M68 215Q106 182 173 207L209 240Q183 278 99 276Q53 260 68 215Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M87 260Q144 240 196 253L184 269L108 278Z" fill="#8c9c7c"/><text x="119" y="242" fill="${gold}" font-family="Arial" font-size="35" font-weight="900" transform="rotate(73 119 242)">8</text>
    <path d="M153 223Q181 196 208 219L265 248L307 254L310 267L275 273L203 250L170 255Z" fill="${fur}" stroke="${ink}" stroke-width="5"/><path d="M264 248L306 251Q327 256 312 269L279 273Z" fill="${skin}" stroke="${ink}" stroke-width="4"/>
    <g transform="translate(216 211) rotate(22) scale(.8)">${sideFace}</g>
    <path d="M178 235Q180 262 208 268L286 276L322 272L323 260L285 259L222 242Z" fill="#58694c" stroke="${ink}" stroke-width="5"/><path d="M286 259L316 255Q333 258 326 271L290 277Z" fill="${skin}" stroke="${ink}" stroke-width="4"/>
    <path d="M310 260L325 260M310 266L325 266" stroke="#53634a" stroke-width="2"/></g>
    <g class="slide-contact"><path d="M469 235L470 221M486 244L499 231M495 259L513 258" stroke="${gold}" stroke-width="4" stroke-linecap="round"/></g>
    <g class="slide-safe"><text x="374" y="125" text-anchor="middle" fill="${gold}" font-family="Arial" font-size="64" font-weight="900" font-style="italic" transform="rotate(-9 374 125)">SAFE!</text><text x="371" y="157" text-anchor="middle" fill="#f7efd0" font-size="14">その一点を、もぎ取れ。</text></g>`, 'sliding-scene');
}

export function baseballScene(metric) {
  if (metric === 'avg') return `<div class="camera-frame camera-side" style="--start:0s"><span class="camera-label">01 / SIDE — インパクト</span>${sideHit()}</div><div class="camera-frame camera-front" style="--start:1.2s"><span class="camera-label">02 / FRONT — 正面</span>${frontHit()}</div><div class="camera-frame camera-top" style="--start:2.4s"><span class="camera-label">03 / TOP — 真上</span>${topHit()}</div><div class="camera-progress"><i></i><i></i><i></i></div>`;
  if (metric === 'hr') return `<div class="camera-frame"><span class="camera-label">FULL SWING → STAND IN</span>${homeRun()}</div>`;
  return `<div class="camera-frame"><span class="camera-label">HEADFIRST SLIDE → HOME</span>${sliding()}</div>`;
}
