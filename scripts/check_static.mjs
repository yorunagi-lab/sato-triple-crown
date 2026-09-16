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
for (const file of ['app.js', 'logic.js']) execFileSync(process.execPath, ['--check', path.join(dist, file)]);
const css = fs.readFileSync(path.join(dist, 'style.css'), 'utf8');
if (css.includes("@import url('')")) throw new Error('Empty CSS import');
const { validateSnapshot, projectScenario } = await import('../dist/logic.js');
const data = validateSnapshot(JSON.parse(fs.readFileSync(path.join(dist, 'data.json'), 'utf8')));
for (const mode of ['frozen', 'season']) projectScenario(data, 60, mode);
if (html.includes('TODO') || html.includes('Lorem ipsum')) throw new Error('Placeholder content');
console.log(`Static entrypoints, JavaScript and real snapshot validated: ${data.leading_categories}/3 categories; through ${data.data_through}`);
