const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body, status = 200, headers = {}) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

// SQLite storage gives a single, atomic, persistent total across all visitors.
export class CheerCounter {
  constructor(state) {
    this.storage = state.storage;
    this.sql = state.storage.sql;
    this.sql.exec('CREATE TABLE IF NOT EXISTS totals (id INTEGER PRIMARY KEY CHECK(id = 1), total INTEGER NOT NULL CHECK(total >= 0))');
    this.sql.exec('INSERT OR IGNORE INTO totals (id, total) VALUES (1, 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS receipts (id TEXT PRIMARY KEY, created INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS receipts_created ON receipts(created)');
    this.rate = new Map();
    this.lastCleanup = 0;
  }
  total() { return this.sql.exec('SELECT total FROM totals WHERE id = 1').one().total; }
  async fetch(request) {
    if (request.method === 'GET') return json({ total: this.total() });
    if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
    let body;
    try { body = await request.json(); } catch { return json({ error: 'invalid_json' }, 400); }
    const ids = body?.eventIds ?? (body?.eventId ? [body.eventId] : null);
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 40 || Object.keys(body).length !== 1 ||
      !ids.every(id => typeof id === 'string' && UUID.test(id))) return json({ error: 'invalid_event' }, 400);
    const eventIds = [...new Set(ids.map(id => id.toLowerCase()))];
    const now = Date.now();
    const newIds = eventIds.filter(id => !this.sql.exec('SELECT id FROM receipts WHERE id = ?', id).toArray().length);
    if (!newIds.length) return json({ total: this.total(), accepted: 0, duplicate: true });
    // Ephemeral, day-specific hash. No raw IP or user identifier is written to storage.
    const client = request.headers.get('X-Cheer-Client') || 'anonymous';
    let window = this.rate.get(client);
    if (!window || now - window.start >= 10000) window = { start: now, count: 0 };
    // Normal rapid tapping is supported; reject only an excessive event burst.
    if (window.count + newIds.length > 200) return json({ error: 'rate_limited' }, 429,
      { 'Retry-After': String(Math.max(1, Math.ceil((window.start + 10000 - now) / 1000))) });
    const result = this.storage.transactionSync(() => {
      // Both writes succeed together, or neither does. Retries reuse the receipt.
      for (const id of newIds) this.sql.exec('INSERT INTO receipts (id, created) VALUES (?, ?)', id, now);
      this.sql.exec('UPDATE totals SET total = total + ? WHERE id = 1', newIds.length);
      return this.total();
    });
    this.rate.set(client, { start: window.start, count: window.count + newIds.length });
    if (now - this.lastCleanup > 3600000) {
      this.sql.exec('DELETE FROM receipts WHERE created < ?', now - 86400000);
      for (const [key, value] of this.rate) if (now - value.start > 60000) this.rate.delete(key);
      this.lastCleanup = now;
    }
    return json({ total: result, accepted: newIds.length, duplicate: false });
  }
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    const allowed = env.ALLOWED_ORIGIN || 'https://yorunagi-lab.github.io';
    const headers = { 'Access-Control-Allow-Origin': allowed, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'Vary': 'Origin', 'X-Content-Type-Options': 'nosniff' };
    const pathname = new URL(request.url).pathname;
    if (pathname === '/health' && request.method === 'GET') return json({ service: 'sato-cheers', status: 'ok' });
    if (pathname !== '/api/cheers') return json({ error: 'not_found' }, 404);
    if ((origin && origin !== allowed) || (request.method !== 'GET' && origin !== allowed)) return json({ error: 'origin_not_allowed' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (!['GET', 'POST'].includes(request.method)) return json({ error: 'method_not_allowed' }, 405, headers);
    if (request.method === 'POST') {
      if (!(request.headers.get('Content-Type') || '').startsWith('application/json')) return json({ error: 'json_required' }, 415, headers);
      // Reading via text also checks actual size when Content-Length is absent.
      const text = await request.text();
      if (text.length > 2048) return json({ error: 'body_too_large' }, 413, headers);
      const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
      const day = new Date().toISOString().slice(0, 10);
      const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${day}:${ip}`));
      const client = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
      request = new Request(request.url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Cheer-Client': client }, body: text });
    }
    try {
      const id = env.CHEERS.idFromName('sato-triple-crown-2026');
      const result = await env.CHEERS.get(id).fetch(request);
      const response = new Response(result.body, result);
      for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
      return response;
    } catch { return json({ error: 'temporarily_unavailable' }, 503, headers); }
  }
};
