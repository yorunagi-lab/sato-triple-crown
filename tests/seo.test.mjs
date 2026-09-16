import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildPage, replaceBlock, SITE, sitemap } from '../scripts/build_seo.mjs';
import { formatMetric } from '../dist/logic.js';

const read = name => fs.readFileSync(new URL('../dist/' + name, import.meta.url), 'utf8');
const template = read('index.html'), snapshot = JSON.parse(read('data.json')), status = JSON.parse(read('fetch-status.json'));
const block = (html, name) => html.split(`<!-- seo:${name}:start -->`)[1].split(`<!-- seo:${name}:end -->`)[0];

test('published HTML contains the real metrics, rankings, latest game and canonical without executing JS', () => {
  const html = buildPage(template, snapshot, status);
  for (const key of ['avg', 'hr', 'rbi']) {
    assert.ok(block(html, 'metrics').includes(`<strong>${formatMetric(key, snapshot.player[key])}</strong>`));
  }
  assert.match(block(html, 'boards'), /佐藤 輝明/);
  assert.ok(block(html, 'methodology').includes(snapshot.source_updated_at.slice(11, 16)));
  assert.equal((html.match(/<h1\b/g) || []).length, 1);
  assert.equal((html.match(/rel="canonical"/g) || []).length, 1);
  assert.ok(html.includes(`rel="canonical" href="${SITE}"`));
  assert.ok(!html.includes('name="robots" content="noindex'));
  assert.deepEqual(JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1])['@graph'].map(x => x['@type']), ['WebSite', 'WebPage']);
});

test('the next successful snapshot replaces published numbers and rebuild is idempotent', () => {
  const data = structuredClone(snapshot); data.player.hr += 1; data.races.hr.margin += 1;
  const html = buildPage(template, data, status, Date.parse(data.fetched_at));
  const hr = block(html, 'metrics').match(/data-metric="hr".*?<div class="metric-number"><strong>(.*?)<\/strong>/s)[1];
  assert.equal(hr, String(data.player.hr));
  assert.equal(buildPage(html, data, status, Date.parse(data.fetched_at)), html);
});

test('failed acquisition keeps previous stats in HTML with a visible warning', () => {
  const html = buildPage(template, snapshot, { status: 'error' });
  assert.match(block(html, 'status'), /前回正常取得/);
  assert.ok(!block(html, 'status').includes(' hidden'));
  assert.ok(block(html, 'metrics').includes(formatMetric('avg', snapshot.player.avg)));
});

test('external player text is escaped and unexpected source URLs are rejected', () => {
  const data = structuredClone(snapshot), malicious = '<img src=x onerror=alert(1)>';
  data.contenders.avg.find(p => p.id === data.races.avg.best_other_id).name = malicious;
  data.rankings.avg[0].name = malicious;
  const html = buildPage(template, data, status);
  assert.ok(!html.includes(malicious)); assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  data.source.urls.average = 'javascript:alert(1)';
  assert.throws(() => buildPage(template, data, status), /Unexpected source/);
});

test('rebuild preserves future ownership verification and content outside generated blocks', () => {
  const custom = '<meta name="google-site-verification" content="example-test-token">';
  const input = template.replace('</head>', custom + '</head>');
  assert.ok(buildPage(input, snapshot, status).includes(custom));
  assert.throws(() => replaceBlock('<html></html>', 'metrics', ''), /Missing/);
  assert.throws(() => replaceBlock('<!-- seo:metrics:start --><!-- seo:metrics:start --><!-- seo:metrics:end -->', 'metrics', ''), /duplicate/);
});

test('sitemap includes only the canonical page, without fake update dates or parameter URLs', () => {
  assert.equal((sitemap.match(/<loc>/g) || []).length, 1);
  assert.ok(sitemap.includes(`<loc>${SITE}</loc>`));
  assert.ok(!sitemap.includes('<lastmod>')); assert.ok(!sitemap.includes('#metrics'));
});
