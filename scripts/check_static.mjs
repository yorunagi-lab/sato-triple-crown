import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
for (const match of html.matchAll(/(?:src|href)="(\.\/[^"?#]+)(?:[^\"]*)"/g)) {
  const file = path.resolve(dist, match[1]);
  if (!file.startsWith(dist + path.sep) || !fs.existsSync(file)) throw new Error(`Missing local asset: ${match[1]}`);
}
for (const file of fs.readdirSync(dist).filter(file => file.endsWith('.js'))) execFileSync(process.execPath, ['--check', path.join(dist, file)]);
const cheerConfig = JSON.parse(fs.readFileSync(path.join(dist, 'cheer-config.json'), 'utf8'));
if (cheerConfig.endpoint !== null) {
  const endpoint = new URL(cheerConfig.endpoint);
  if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) throw new Error('Cheer endpoint must use HTTPS');
}
const css = fs.readFileSync(path.join(dist, 'style.css'), 'utf8');
if (css.includes("@import url('')")) throw new Error('Empty CSS import');
const { validateSnapshot, projectScenario } = await import('../dist/logic.js');
const data = validateSnapshot(JSON.parse(fs.readFileSync(path.join(dist, 'data.json'), 'utf8')));
const { validateHistory, gameTrend } = await import('../dist/insight-data.js');
validateHistory(JSON.parse(fs.readFileSync(path.join(dist, 'history.json'), 'utf8')), data.season);
gameTrend(data);
const { buildPage, sitemap } = await import('./build_seo.mjs');
const status = JSON.parse(fs.readFileSync(path.join(dist, 'fetch-status.json'), 'utf8'));
const rebuilt = buildPage(html, data, status);
for (const name of ['metadata', 'crown', 'time', 'latest', 'metrics', 'boards', 'methodology']) {
  const block = page => page.split(`<!-- seo:${name}:start -->`)[1]?.split(`<!-- seo:${name}:end -->`)[0];
  if (block(html) !== block(rebuilt)) throw new Error(`Published HTML is out of sync with data.json: ${name}. Run node scripts/build_seo.mjs`);
}
if (fs.readFileSync(path.join(dist, 'sitemap.xml'), 'utf8') !== sitemap) throw new Error('Sitemap differs from the canonical page');
for (const mode of ['frozen', 'season']) projectScenario(data, 60, mode);
if (html.includes('TODO') || html.includes('Lorem ipsum')) throw new Error('Placeholder content');
console.log(`Static entrypoints, JavaScript and real snapshot validated: ${data.leading_categories}/3 categories; through ${data.data_through}`);
