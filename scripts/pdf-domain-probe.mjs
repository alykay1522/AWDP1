import fs from 'node:fs';
import path from 'node:path';
import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const repoRoot = process.cwd();
const encoded = fs.readFileSync(path.join(repoRoot, 'scripts/unrecovered-wordpress-pdfs.json.gz.b64'), 'utf8').trim();
const targets = JSON.parse(gunzipSync(Buffer.from(encoded, 'base64')).toString('utf8')).map(([wordpressPath, title, expectedSize]) => ({
  wordpressPath,
  title,
  expectedSize,
  basename: wordpressPath.split('/').pop(),
}));

const USER_AGENT = 'Mozilla/5.0 (compatible; AWDP-PDF-Recovery/1.0; +https://www.allwindowdoorparts.com)';
const DOMAIN_SPECS = [
  { key: 'wefixitusa.com', roots: ['https://wefixitusa.com', 'https://www.wefixitusa.com'] },
  { key: 'truthentrygard.com', roots: ['https://truthentrygard.com', 'https://www.truthentrygard.com'] },
  { key: 'oldachparts.com', roots: ['https://oldachparts.com', 'https://www.oldachparts.com'] },
  { key: 'huntsports.com', roots: ['https://huntsports.com', 'https://www.huntsports.com'] },
  { key: 'biltbestwindowparts.com', roots: ['https://biltbestwindowparts.com', 'https://www.biltbestwindowparts.com'] },
  { key: 'doorswindowshardware.com', roots: ['https://doorswindowshardware.com', 'https://www.doorswindowshardware.com'] },
  { key: 'wefixitusa.forpartsnow.com', roots: ['https://wefixitusa.forpartsnow.com'] },
];

const KNOWN_URLS = [
  'http://www.wefixitusa.com/images/WeFixitUSA_master_guide.pdf',
  'https://www.wefixitusa.com/images/WeFixitUSA_master_guide.pdf',
  'https://www.oldachparts.com/wp-content/uploads/2023/04/OldachParts-PDF-Catalog.pdf',
  'https://doorswindowshardware.com/wp-content/uploads/2023/04/WindowDoorHardwareParts-PDF-Catalog.pdf',
  'https://www.doorswindowshardware.com/wp-content/uploads/2023/04/WindowDoorHardwareParts-PDF-Catalog.pdf',
  'https://wefixitusa.forpartsnow.com/catalogs/2023-24-Catalog/files/assets/common/downloads/publication.pdf',
  'https://wefixitusa.forpartsnow.com/catalogs/2023-24-Catalog/files/assets/common/downloads/2023-24-Catalog.pdf',
];

function decodeLoose(value) {
  let current = String(value || '');
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(current.replace(/\+/g, '%20'));
      if (decoded === current) break;
      current = decoded;
    } catch {
      break;
    }
  }
  return current;
}

function basenameFromUrl(value) {
  try {
    return decodeLoose(new URL(value).pathname.split('/').pop() || '');
  } catch {
    return decodeLoose(String(value).split('/').pop() || '');
  }
}

function normalizeName(value) {
  let name = basenameFromUrl(value)
    .replace(/\.pdf(?:$|[?#].*)/i, '')
    .replace(/^\d{3,5}[_\s-]+/, '')
    .replace(/_0$/i, '')
    .replace(/\s*\(\d+\)\s*$/i, '')
    .replace(/20(?=[A-Za-z(&])/g, ' ')
    .replace(/\bcopy\b/gi, ' ')
    .toLowerCase();
  return name.replace(/[^a-z0-9]+/g, '');
}

function trigrams(value) {
  const padded = `  ${value}  `;
  const set = new Set();
  for (let i = 0; i <= padded.length - 3; i += 1) set.add(padded.slice(i, i + 3));
  return set;
}

function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const aa = trigrams(a);
  const bb = trigrams(b);
  let common = 0;
  for (const item of aa) if (bb.has(item)) common += 1;
  return (2 * common) / (aa.size + bb.size);
}

const targetByNorm = new Map();
for (const target of targets) {
  const norm = normalizeName(target.basename);
  if (!targetByNorm.has(norm)) targetByNorm.set(norm, []);
  targetByNorm.get(norm).push(target);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      redirect: 'follow',
      ...options,
      headers: { 'user-agent': USER_AGENT, accept: '*/*', ...(options.headers || {}) },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchText(url, timeoutMs = 25000) {
  try {
    const response = await fetchWithTimeout(url, {}, timeoutMs);
    const text = await response.text();
    return { ok: response.ok, status: response.status, url: response.url, headers: Object.fromEntries(response.headers), text };
  } catch (error) {
    return { ok: false, status: 0, url, headers: {}, text: '', error: String(error?.message || error) };
  }
}

function extractLinks(html, baseUrl) {
  const links = new Set();
  const regex = /(?:href|src)\s*=\s*["']([^"']+)["']/gi;
  for (const match of html.matchAll(regex)) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:') || raw.startsWith('javascript:')) continue;
    try {
      links.add(new URL(raw.replace(/&amp;/g, '&'), baseUrl).href);
    } catch {}
  }
  const plainPdf = /https?:\\?\/\\?\/[^\s"'<>]+?\.pdf(?:\?[^\s"'<>]*)?/gi;
  for (const match of html.matchAll(plainPdf)) links.add(match[0].replaceAll('\\/', '/'));
  return [...links];
}

function isInterestingPage(url, rootHost) {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== rootHost) return false;
    const value = `${parsed.pathname}${parsed.search}`.toLowerCase();
    return /(pdf|catalog|guide|manual|download|research|resource|attachment|media)/.test(value) || value === '/' || value === '';
  } catch {
    return false;
  }
}

async function discoverLive(spec) {
  const pdfs = new Set();
  const visited = new Set();
  const pages = [];
  const diagnostics = [];

  for (const root of spec.roots) {
    let rootUrl;
    try { rootUrl = new URL(root); } catch { continue; }
    const seeds = [
      root,
      `${root}/catalog/`, `${root}/pdf/`, `${root}/pdfs/`, `${root}/pdf-catalog/`,
      `${root}/research-answers/`, `${root}/research-answers`,
      `${root}/wp-sitemap.xml`, `${root}/sitemap_index.xml`, `${root}/attachment-sitemap.xml`,
      `${root}/wp-sitemap-posts-attachment-1.xml`,
    ];
    for (const seed of seeds) pages.push({ url: seed, depth: 0, rootHost: rootUrl.hostname });

    for (const endpoint of [
      `${root}/wp-json/wp/v2/media?media_type=application&per_page=100&page=1`,
      `${root}/wp-json/wp/v2/media?search=pdf&per_page=100&page=1`,
    ]) {
      const result = await fetchText(endpoint);
      diagnostics.push({ type: 'wp-rest', url: endpoint, status: result.status, finalUrl: result.url, error: result.error });
      if (!result.ok) continue;
      try {
        const data = JSON.parse(result.text);
        if (Array.isArray(data)) {
          for (const item of data) {
            const source = item?.source_url || item?.guid?.rendered;
            if (source && /\.pdf(?:$|[?#])/i.test(source)) pdfs.add(source);
          }
        }
      } catch {}
    }
  }

  while (pages.length && visited.size < 80) {
    const current = pages.shift();
    if (!current || visited.has(current.url)) continue;
    visited.add(current.url);
    const result = await fetchText(current.url);
    diagnostics.push({ type: 'page', url: current.url, status: result.status, finalUrl: result.url, error: result.error });
    if (!result.ok || !/(text|xml|json|html)/i.test(result.headers['content-type'] || 'text/html')) continue;
    for (const link of extractLinks(result.text, result.url)) {
      if (/\.pdf(?:$|[?#])/i.test(link)) {
        pdfs.add(link);
      } else if (current.depth < 2 && isInterestingPage(link, current.rootHost) && !visited.has(link)) {
        pages.push({ url: link, depth: current.depth + 1, rootHost: current.rootHost });
      }
    }
  }

  return { pdfs: [...pdfs], diagnostics };
}

async function discoverArchive(spec) {
  const rows = [];
  const diagnostics = [];
  const hosts = new Set();
  for (const root of spec.roots) {
    try {
      const host = new URL(root).hostname;
      hosts.add(host);
      hosts.add(host.replace(/^www\./, ''));
      hosts.add(host.startsWith('www.') ? host : `www.${host}`);
    } catch {}
  }

  for (const host of hosts) {
    const queries = [
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`${host}/*.pdf`)}&output=json&fl=timestamp,original,mimetype,statuscode,digest,length&filter=statuscode:200&collapse=urlkey&limit=5000`,
      `https://web.archive.org/cdx/search/cdx?url=${encodeURIComponent(`${host}/*`)}&output=json&fl=timestamp,original,mimetype,statuscode,digest,length&filter=statuscode:200&filter=mimetype:application/pdf&collapse=urlkey&limit=5000`,
    ];
    for (const query of queries) {
      const result = await fetchText(query, 60000);
      diagnostics.push({ type: 'cdx', host, status: result.status, error: result.error, bytes: result.text.length });
      if (!result.ok) continue;
      try {
        const data = JSON.parse(result.text);
        if (!Array.isArray(data) || data.length < 2) continue;
        const header = data[0];
        for (const row of data.slice(1)) {
          const record = Object.fromEntries(header.map((name, index) => [name, row[index]]));
          if (!/\.pdf(?:$|[?#])/i.test(record.original || '') && !/pdf/i.test(record.mimetype || '')) continue;
          record.replayUrl = `https://web.archive.org/web/${record.timestamp}id_/${record.original}`;
          rows.push(record);
        }
      } catch {}
    }
  }

  const deduped = new Map();
  for (const row of rows) {
    const key = `${row.original}|${row.digest || ''}`;
    if (!deduped.has(key)) deduped.set(key, row);
  }
  return { rows: [...deduped.values()], diagnostics };
}

async function verifyPdf(url, timeoutMs = 90000) {
  try {
    const response = await fetchWithTimeout(url, {}, timeoutMs);
    const declared = Number(response.headers.get('content-length') || 0);
    if (declared > 100 * 1024 * 1024) {
      return { ok: false, status: response.status, finalUrl: response.url, contentType: response.headers.get('content-type'), declared, error: 'over-100mb' };
    }
    const bytes = Buffer.from(await response.arrayBuffer());
    const signature = bytes.subarray(0, 5).toString('ascii');
    return {
      ok: response.ok && signature === '%PDF-',
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type'),
      bytes: bytes.length,
      signature,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  } catch (error) {
    return { ok: false, status: 0, finalUrl: url, error: String(error?.message || error) };
  }
}

function candidateTargets(candidateUrl, candidateLength) {
  const norm = normalizeName(candidateUrl);
  const exact = targetByNorm.get(norm) || [];
  if (exact.length) return exact.map((target) => ({ target, score: 1, reason: 'normalized-exact' }));

  const name = basenameFromUrl(candidateUrl).toLowerCase();
  const isCatalog = /(catalog|master.*guide|ebook)/i.test(name);
  const ranked = [];
  for (const target of targets) {
    const targetNorm = normalizeName(target.basename);
    let score = similarity(norm, targetNorm);
    const sizeEqual = candidateLength && target.expectedSize && Number(candidateLength) === Number(target.expectedSize);
    if (sizeEqual) score = Math.max(score, 0.97);
    if (isCatalog && /(catalog|master.*guide|ebook)/i.test(target.basename)) score = Math.max(score, 0.72);
    if (score >= 0.72) ranked.push({ target, score, reason: sizeEqual ? 'size-match' : 'name-similarity' });
  }
  ranked.sort((a, b) => b.score - a.score);
  return ranked.slice(0, 5);
}

async function main() {
  console.log(`[pdf-domain-probe] targets=${targets.length}`);
  const report = { generatedAt: new Date().toISOString(), domains: {}, matches: [], verifiedCandidates: [] };
  const candidates = new Map();

  for (const known of KNOWN_URLS) candidates.set(known, { source: 'known' });

  for (const spec of DOMAIN_SPECS) {
    const [live, archive] = await Promise.all([discoverLive(spec), discoverArchive(spec)]);
    report.domains[spec.key] = {
      livePdfCount: live.pdfs.length,
      archivePdfCount: archive.rows.length,
      liveDiagnostics: live.diagnostics,
      archiveDiagnostics: archive.diagnostics,
    };
    console.log(`[pdf-domain-probe] domain=${spec.key} live=${live.pdfs.length} archive=${archive.rows.length}`);
    for (const url of live.pdfs) candidates.set(url, { source: 'live', domain: spec.key });
    for (const row of archive.rows) candidates.set(row.replayUrl, { source: 'archive', domain: spec.key, archive: row });
  }

  const rankedCandidates = [];
  for (const [url, meta] of candidates) {
    const length = Number(meta.archive?.length || 0);
    const matches = candidateTargets(url, length);
    if (matches.length || /(catalog|master.*guide|ebook)/i.test(url)) rankedCandidates.push({ url, meta, matches });
  }

  console.log(`[pdf-domain-probe] candidates=${candidates.size} selectedForVerification=${rankedCandidates.length}`);
  const seenHash = new Set();
  for (const candidate of rankedCandidates.slice(0, 250)) {
    const verification = await verifyPdf(candidate.url);
    if (!verification.ok) {
      if (candidate.matches.length || /(catalog|master.*guide|ebook)/i.test(candidate.url)) {
        console.log(`[pdf-domain-probe] failed ${JSON.stringify({ url: candidate.url, source: candidate.meta.source, verification, matches: candidate.matches.slice(0, 3) })}`);
      }
      continue;
    }
    const key = verification.sha256;
    const record = {
      candidateUrl: candidate.url,
      source: candidate.meta.source,
      domain: candidate.meta.domain,
      archiveOriginal: candidate.meta.archive?.original,
      archiveTimestamp: candidate.meta.archive?.timestamp,
      verification,
      matches: candidateTargets(candidate.url, verification.bytes),
    };
    if (!seenHash.has(key)) {
      seenHash.add(key);
      report.verifiedCandidates.push(record);
    }
    for (const match of record.matches) {
      if (match.score < 0.9 && match.reason !== 'size-match') continue;
      const mapped = {
        wordpressPath: match.target.wordpressPath,
        title: match.target.title,
        expectedSize: match.target.expectedSize,
        score: Number(match.score.toFixed(4)),
        reason: match.reason,
        candidateUrl: candidate.url,
        redirectUrl: candidate.url,
        bytes: verification.bytes,
        sha256: verification.sha256,
        source: candidate.meta.source,
        domain: candidate.meta.domain,
      };
      report.matches.push(mapped);
      console.log(`[pdf-domain-probe] MATCH ${JSON.stringify(mapped)}`);
    }
    if (/(catalog|master.*guide|ebook)/i.test(candidate.url)) {
      console.log(`[pdf-domain-probe] CATALOG ${JSON.stringify({ url: candidate.url, source: candidate.meta.source, domain: candidate.meta.domain, bytes: verification.bytes, sha256: verification.sha256, matches: record.matches.slice(0, 5).map((m) => ({ path: m.target.wordpressPath, score: Number(m.score.toFixed(4)), reason: m.reason, expectedSize: m.target.expectedSize })) })}`);
    }
  }

  const uniqueMatches = new Map();
  for (const match of report.matches) {
    const prior = uniqueMatches.get(match.wordpressPath);
    if (!prior || match.score > prior.score || (match.score === prior.score && match.source === 'live')) uniqueMatches.set(match.wordpressPath, match);
  }
  report.matches = [...uniqueMatches.values()];
  report.summary = {
    totalCandidates: candidates.size,
    verifiedUniquePdfs: report.verifiedCandidates.length,
    recoveredTargets: report.matches.length,
  };

  const outDir = path.join(repoRoot, 'artifacts/awdp-site/dist/public');
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'pdf-domain-probe-report.json'), JSON.stringify(report, null, 2));
  console.log(`[pdf-domain-probe] SUMMARY ${JSON.stringify(report.summary)}`);
}

main().catch((error) => {
  console.error('[pdf-domain-probe] fatal', error);
  process.exitCode = 0;
});
