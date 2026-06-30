import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const root = process.cwd();
const targets = JSON.parse(gunzipSync(Buffer.from(fs.readFileSync(path.join(root, 'scripts/unrecovered-wordpress-pdfs.json.gz.b64'), 'utf8').trim(), 'base64')).toString('utf8')).map(([wordpressPath, title, expectedSize]) => ({ wordpressPath, title, expectedSize, basename: wordpressPath.split('/').pop() }));
const UA = 'Mozilla/5.0 (compatible; AWDP-PDF-Recovery/2.0; +https://www.allwindowdoorparts.com)';
const specs = [
  ['wefixitusa.com', ['wefixitusa.com', 'www.wefixitusa.com']],
  ['truthentrygard.com', ['truthentrygard.com', 'www.truthentrygard.com']],
  ['oldachparts.com', ['oldachparts.com', 'www.oldachparts.com']],
  ['huntsports.com', ['huntsports.com', 'www.huntsports.com']],
  ['biltbestwindowparts.com', ['biltbestwindowparts.com', 'www.biltbestwindowparts.com']],
  ['doorswindowshardware.com', ['doorswindowshardware.com', 'www.doorswindowshardware.com']],
  ['wefixitusa.forpartsnow.com', ['wefixitusa.forpartsnow.com']],
];
const known = [
  'http://www.wefixitusa.com/images/WeFixitUSA_master_guide.pdf',
  'https://www.wefixitusa.com/images/WeFixitUSA_master_guide.pdf',
  'https://www.oldachparts.com/wp-content/uploads/2023/04/OldachParts-PDF-Catalog.pdf',
  'https://doorswindowshardware.com/wp-content/uploads/2023/04/WindowDoorHardwareParts-PDF-Catalog.pdf',
  'https://www.doorswindowshardware.com/wp-content/uploads/2023/04/WindowDoorHardwareParts-PDF-Catalog.pdf',
  'https://wefixitusa.forpartsnow.com/catalogs/2023-24-Catalog/files/assets/common/downloads/publication.pdf',
  'https://wefixitusa.forpartsnow.com/catalogs/2023-24-Catalog/files/assets/common/downloads/2023-24-Catalog.pdf',
];

function decodeLoose(value) {
  let out = String(value || '');
  for (let i = 0; i < 3; i += 1) {
    try { const next = decodeURIComponent(out.replace(/\+/g, '%20')); if (next === out) break; out = next; } catch { break; }
  }
  return out;
}
function base(value) { try { return decodeLoose(new URL(value).pathname.split('/').pop() || ''); } catch { return decodeLoose(String(value).split('/').pop() || ''); } }
function norm(value) { return base(value).replace(/\.pdf(?:$|[?#].*)/i, '').replace(/^\d{3,5}[_\s-]+/, '').replace(/_0$/i, '').replace(/\s*\(\d+\)\s*$/i, '').replace(/20(?=[A-Za-z(&])/g, ' ').replace(/\bcopy\b/gi, ' ').toLowerCase().replace(/[^a-z0-9]+/g, ''); }
function grams(value) { const s = `  ${value}  `; const set = new Set(); for (let i = 0; i <= s.length - 3; i++) set.add(s.slice(i, i + 3)); return set; }
function sim(a, b) { if (!a || !b) return 0; if (a === b) return 1; const A = grams(a), B = grams(b); let c = 0; for (const x of A) if (B.has(x)) c++; return 2 * c / (A.size + B.size); }
const targetByNorm = new Map();
for (const t of targets) { const n = norm(t.basename); if (!targetByNorm.has(n)) targetByNorm.set(n, []); targetByNorm.get(n).push(t); }

async function get(url, timeout = 18000) {
  const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), timeout);
  try { const r = await fetch(url, { redirect: 'follow', headers: { 'user-agent': UA, accept: '*/*' }, signal: controller.signal }); return r; }
  finally { clearTimeout(timer); }
}
async function text(url, timeout) {
  try { const r = await get(url, timeout); return { ok: r.ok, status: r.status, url: r.url, type: r.headers.get('content-type') || '', body: await r.text() }; }
  catch (e) { return { ok: false, status: 0, url, type: '', body: '', error: String(e?.message || e) }; }
}
function links(body, baseUrl) {
  const out = new Set();
  for (const m of body.matchAll(/(?:href|src)\s*=\s*["']([^"']+)["']/gi)) {
    try { out.add(new URL(m[1].replace(/&amp;/g, '&'), baseUrl).href); } catch {}
  }
  return [...out];
}
async function mapLimit(items, limit, fn) {
  const results = new Array(items.length); let next = 0;
  async function worker() { while (true) { const i = next++; if (i >= items.length) return; results[i] = await fn(items[i], i); } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker)); return results;
}

async function discoverSpec([key, hosts]) {
  const candidate = new Map(); const diagnostics = [];
  const pageUrls = [];
  for (const host of hosts) {
    for (const suffix of ['', '/', '/catalog/', '/pdf/', '/pdfs/', '/pdf-catalog/', '/research-answers/', '/wp-sitemap.xml', '/sitemap_index.xml', '/attachment-sitemap.xml', '/wp-sitemap-posts-attachment-1.xml']) pageUrls.push(`https://${host}${suffix}`);
    for (const endpoint of [`https://${host}/wp-json/wp/v2/media?media_type=application&per_page=100&page=1`, `https://${host}/wp-json/wp/v2/media?search=pdf&per_page=100&page=1`]) pageUrls.push(endpoint);
  }
  const pageResults = await mapLimit([...new Set(pageUrls)], 10, async (url) => ({ url, result: await text(url, 18000) }));
  for (const { url, result } of pageResults) {
    diagnostics.push({ kind: 'live', url, status: result.status, finalUrl: result.url, error: result.error });
    if (!result.ok) continue;
    if (/json/i.test(result.type)) {
      try { const data = JSON.parse(result.body); if (Array.isArray(data)) for (const item of data) { const source = item?.source_url || item?.guid?.rendered; if (source && /\.pdf(?:$|[?#])/i.test(source)) candidate.set(source, { source: 'live', domain: key }); } } catch {}
    }
    for (const link of links(result.body, result.url)) if (/\.pdf(?:$|[?#])/i.test(link)) candidate.set(link, { source: 'live', domain: key });
  }

  const cdxUrls = [];
  for (const host of hosts) {
    cdxUrls.push(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`${host}/*.pdf`)}&output=json&fl=timestamp,original,mimetype,statuscode,digest,length&filter=statuscode:200&collapse=urlkey&limit=5000`);
    cdxUrls.push(`https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`${host}/*`)}&output=json&fl=timestamp,original,mimetype,statuscode,digest,length&filter=statuscode:200&filter=mimetype:application/pdf&collapse=urlkey&limit=5000`);
  }
  const cdxResults = await mapLimit(cdxUrls, 6, async (url) => ({ url, result: await text(url, 45000) }));
  let archiveCount = 0;
  for (const { url, result } of cdxResults) {
    diagnostics.push({ kind: 'cdx', url, status: result.status, error: result.error, bytes: result.body.length });
    if (!result.ok) continue;
    try {
      const data = JSON.parse(result.body); if (!Array.isArray(data) || data.length < 2) continue; const h = data[0];
      for (const row of data.slice(1)) { const rec = Object.fromEntries(h.map((n, i) => [n, row[i]])); if (!/\.pdf(?:$|[?#])/i.test(rec.original || '') && !/pdf/i.test(rec.mimetype || '')) continue; const replay = `https://web.archive.org/web/${rec.timestamp}id_/${rec.original}`; candidate.set(replay, { source: 'archive', domain: key, archive: rec }); archiveCount++; }
    } catch {}
  }
  return { key, candidate, diagnostics, archiveCount };
}

function rankedTargets(url, length = 0) {
  const n = norm(url); const exact = targetByNorm.get(n) || [];
  if (exact.length) return exact.map(t => ({ target: t, score: 1, reason: 'normalized-exact' }));
  const isCatalog = /(catalog|master.*guide|ebook)/i.test(base(url)); const ranked = [];
  for (const t of targets) { let score = sim(n, norm(t.basename)); const sizeEqual = length && t.expectedSize && Number(length) === Number(t.expectedSize); if (sizeEqual) score = Math.max(score, .97); if (isCatalog && /(catalog|master.*guide|ebook)/i.test(t.basename)) score = Math.max(score, .72); if (score >= .72) ranked.push({ target: t, score, reason: sizeEqual ? 'size-match' : 'name-similarity' }); }
  return ranked.sort((a, b) => b.score - a.score).slice(0, 5);
}
async function verify(url) {
  try { const r = await get(url, 60000); const declared = Number(r.headers.get('content-length') || 0); if (declared > 100 * 1024 * 1024) return { ok: false, status: r.status, finalUrl: r.url, declared, error: 'over-100mb' }; const b = Buffer.from(await r.arrayBuffer()); const signature = b.subarray(0, 5).toString('ascii'); return { ok: r.ok && signature === '%PDF-', status: r.status, finalUrl: r.url, contentType: r.headers.get('content-type'), bytes: b.length, signature, sha256: createHash('sha256').update(b).digest('hex') }; }
  catch (e) { return { ok: false, status: 0, finalUrl: url, error: String(e?.message || e) }; }
}

async function main() {
  console.log(`[pdf-domain-probe] targets=${targets.length}`);
  const discovered = await Promise.all(specs.map(discoverSpec));
  const candidates = new Map(known.map(url => [url, { source: 'known' }])); const domains = {};
  for (const d of discovered) { domains[d.key] = { liveAndArchiveCandidates: d.candidate.size, archiveRows: d.archiveCount, diagnostics: d.diagnostics }; for (const [u, m] of d.candidate) candidates.set(u, m); console.log(`[pdf-domain-probe] domain=${d.key} candidates=${d.candidate.size} archiveRows=${d.archiveCount}`); }
  const selected = [];
  for (const [url, meta] of candidates) { const preliminary = rankedTargets(url, Number(meta.archive?.length || 0)); if (preliminary.length || /(catalog|master.*guide|ebook)/i.test(url)) selected.push({ url, meta, preliminary }); }
  console.log(`[pdf-domain-probe] totalCandidates=${candidates.size} selected=${selected.length}`);
  const checked = await mapLimit(selected.slice(0, 180), 8, async item => ({ ...item, verification: await verify(item.url) }));
  const matches = [], verified = [];
  for (const item of checked) {
    if (!item.verification.ok) { if (item.preliminary.length || /(catalog|master.*guide|ebook)/i.test(item.url)) console.log(`[pdf-domain-probe] FAILED ${JSON.stringify({ url: item.url, source: item.meta.source, domain: item.meta.domain, verification: item.verification })}`); continue; }
    const ranked = rankedTargets(item.url, item.verification.bytes); const rec = { candidateUrl: item.url, source: item.meta.source, domain: item.meta.domain, archiveOriginal: item.meta.archive?.original, archiveTimestamp: item.meta.archive?.timestamp, verification: item.verification, ranked: ranked.map(x => ({ wordpressPath: x.target.wordpressPath, score: +x.score.toFixed(4), reason: x.reason, expectedSize: x.target.expectedSize })) }; verified.push(rec);
    if (/(catalog|master.*guide|ebook)/i.test(item.url)) console.log(`[pdf-domain-probe] CATALOG ${JSON.stringify(rec)}`);
    for (const x of ranked) if (x.score >= .9 || x.reason === 'size-match') { const m = { wordpressPath: x.target.wordpressPath, title: x.target.title, expectedSize: x.target.expectedSize, score: +x.score.toFixed(4), reason: x.reason, candidateUrl: item.url, bytes: item.verification.bytes, sha256: item.verification.sha256, source: item.meta.source, domain: item.meta.domain }; matches.push(m); console.log(`[pdf-domain-probe] MATCH ${JSON.stringify(m)}`); }
  }
  const unique = new Map(); for (const m of matches) { const p = unique.get(m.wordpressPath); if (!p || m.score > p.score || (m.score === p.score && m.source === 'live')) unique.set(m.wordpressPath, m); }
  const report = { generatedAt: new Date().toISOString(), domains, matches: [...unique.values()], verifiedCandidates: verified, summary: { totalCandidates: candidates.size, selected: selected.length, verifiedPdfs: verified.length, recoveredTargets: unique.size } };
  const out = path.join(root, 'artifacts/awdp-site/dist/public'); fs.mkdirSync(out, { recursive: true }); fs.writeFileSync(path.join(out, 'pdf-domain-probe-report.json'), JSON.stringify(report, null, 2)); console.log(`[pdf-domain-probe] SUMMARY ${JSON.stringify(report.summary)}`);
}
main().catch(e => { console.error('[pdf-domain-probe] fatal', e); process.exitCode = 0; });
