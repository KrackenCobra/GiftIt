// CI dependency audit: `npm audit --omit=dev`, failing on any high/critical
// advisory unless it is on the allow-list below. Every entry must name the
// package, say why it's accepted, and carry the date it was added.
import { execFileSync } from 'node:child_process';

const FAIL_AT = new Set(['high', 'critical']);

const ALLOW = [
  // 2026-11-14: image-size@1.2.1 is a build-time dependency of Metro
  // (expo -> @expo/metro -> metro@0.83.3). It reads image dimensions of the
  // app's own bundled assets; it does not ship in the app. Every fixed release
  // is 2.0.3+, which Metro 0.83 can't use (Assets.js passes a file path;
  // image-size 2.x only accepts a buffer). Expo 54.0.38 is the latest 54
  // patch. Remove these when Expo/Metro moves to image-size >= 2.0.3.
  { pkg: 'image-size', id: 'GHSA-5p2g-fcmc-qvqq' },
  { pkg: 'image-size', id: 'GHSA-w3rx-r6r6-pgpr' },
];

let raw;
try {
  raw = execFileSync('npm', ['audit', '--omit=dev', '--json'], { encoding: 'utf8', maxBuffer: 64 << 20 });
} catch (e) {
  raw = e.stdout; // npm audit exits non-zero when it finds anything
}
const report = JSON.parse(raw || '{}');
if (report.error || !report.vulnerabilities) {
  console.error('npm audit did not return a report:', report.error ?? raw);
  process.exit(1);
}

const ghsa = (url = '') => url.match(/GHSA-[\w-]+/)?.[0] ?? url;
const isAllowed = (a) => ALLOW.some((x) => x.pkg === a.name && x.id === ghsa(a.url));

const seen = new Map();
for (const v of Object.values(report.vulnerabilities)) {
  for (const a of v.via) {
    // String entries point at another package's advisories; those are
    // checked under that package, so only advisory objects matter here.
    if (typeof a === 'object' && FAIL_AT.has(a.severity)) seen.set(`${a.name} ${ghsa(a.url)}`, a);
  }
}

let failed = false;
for (const [key, a] of seen) {
  const ok = isAllowed(a);
  failed ||= !ok;
  console.log(`${ok ? 'allowed' : 'FAIL   '}  ${a.severity.padEnd(8)} ${key}  ${a.title}`);
}
const used = new Set([...seen.values()].filter(isAllowed).map((a) => ghsa(a.url)));
for (const x of ALLOW) {
  if (!used.has(x.id)) console.log(`note: allow-list entry ${x.pkg} ${x.id} no longer matches anything; remove it.`);
}
console.log(failed ? 'Dependency audit failed.' : `Dependency audit passed (${seen.size} high+ advisories, all allow-listed).`);
process.exit(failed ? 1 : 0);
