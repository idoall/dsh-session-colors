import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';

const root = fileURLToPath(new URL('../', import.meta.url));
// Every document this repository keeps. There is no second, abandoned spec to
// disambiguate: anything that stops describing what ships is deleted, not marked.
const core = ['AGENTS.md', 'README.md', 'README.zh.md', 'CHANGELOG.md', 'docs/plugin-design.zh.md', 'docs/RELEASING.md'];
const read = p => readFileSync(resolve(root, p), 'utf8');
const demos = readdirSync(resolve(root, 'demos')).filter(name => extname(name) === '.html');
const slug = h => h.toLowerCase().replace(/[^\p{L}\p{N}_\- ]/gu, '').replace(/ /g, '-');
function markdown(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') return [];
    const path = resolve(dir, entry.name);
    return entry.isDirectory() ? markdown(path) : extname(path) === '.md' ? [path] : [];
  });
}

// --- the small part of node-semver this project's declarations need ---------
// A comparator-set check with node-semver's prerelease rule: a version that
// carries a prerelease is admitted only when some comparator in the set names
// the same [major, minor, patch]. That rule is the whole reason a range like
// `>=0.1.6-0 <0.2.0` must not be read as "any 0.1.x": it excludes every
// `0.1.7-…` prerelease, which is what a DSH alpha release is.
const VERSION = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/;
const compareIdentifiers = (a, b) => {
  const numeric = /^\d+$/;
  if (numeric.test(a) && numeric.test(b)) return Number(a) - Number(b);
  if (numeric.test(a)) return -1;
  if (numeric.test(b)) return 1;
  return a < b ? -1 : a > b ? 1 : 0;
};
function compareVersions(a, b) {
  for (let index = 0; index < 3; index += 1) {
    if (a.parts[index] !== b.parts[index]) return a.parts[index] - b.parts[index];
  }
  if (a.pre === undefined && b.pre === undefined) return 0;
  // A release outranks its own prereleases.
  if (a.pre === undefined) return 1;
  if (b.pre === undefined) return -1;
  const left = a.pre.split('.');
  const right = b.pre.split('.');
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    if (left[index] === undefined) return -1;
    if (right[index] === undefined) return 1;
    const order = compareIdentifiers(left[index], right[index]);
    if (order !== 0) return order;
  }
  return 0;
}
const parseVersion = raw => {
  const match = VERSION.exec(raw.trim());
  return match === null
    ? null
    : { parts: [Number(match[1]), Number(match[2]), Number(match[3])], pre: match[4] };
};
const sameTuple = (a, b) => a.parts.every((part, index) => part === b.parts[index]);
const COMPARATOR = /^(>=|<=|>|<|\^)?\s*(.+)$/;
/** Whether `version` satisfies a `||`-separated comparator set of `>=X <Y`/`^X` parts. */
function satisfies(version, range) {
  const target = parseVersion(version);
  if (target === null) return false;
  return range.split('||').some(alternative => {
    const parts = alternative.trim().split(/\s+/).filter(Boolean).map((part) => {
      const match = COMPARATOR.exec(part);
      return match === null ? null : { op: match[1] ?? '=', version: parseVersion(match[2]) };
    });
    if (parts.some(part => part === null || part.version === null)) return false;
    const holds = parts.every(({ op, version: bound }) => {
      const order = compareVersions(target, bound);
      if (op === '>=') return order >= 0;
      if (op === '>') return order > 0;
      if (op === '<=') return order <= 0;
      if (op === '<') return order < 0;
      if (op === '=') return order === 0;
      // `^X` is `>=X` plus the next breaking bump; these ranges are all 0.1.x,
      // so the next bump is the next minor.
      return order >= 0 && compareVersions(target, { parts: [bound.parts[0], bound.parts[1] + 1, 0], pre: '0' }) < 0;
    });
    if (!holds) return false;
    // Prerelease admission: only a comparator naming this exact tuple opens the
    // gate, which is what a range written for a DSH alpha must do explicitly.
    if (target.pre === undefined) return true;
    return parts.some(({ version: bound }) => bound.pre !== undefined && sameTuple(bound, target));
  });
}

test('the documents that describe what ships exist and are non-empty', () => {
  for (const p of core) assert.ok(read(p).trim().length > 100, p);
});

test('docs/ holds only this project\'s own records', () => {
  // The abandoned "pinned Sessions" line used to live here as history. It is
  // deleted now, so this guard keeps the directory honest instead of letting a
  // second spec grow back beside the current one.
  const entries = readdirSync(resolve(root, 'docs'), { withFileTypes: true }).map(entry => entry.name);
  assert.deepEqual(entries.sort(), ['RELEASING.md', 'images', 'plugin-design.zh.md', 'releases']);
});

test('the release notes for the current version exist and are bilingual', () => {
  // The Release workflow refuses a tag whose notes file is missing or lacks the
  // cn/en anchors. Checking the same thing here means a tag push cannot be the
  // first time anyone notices.
  const { version } = JSON.parse(read('package.json'));
  const notes = read(`docs/releases/v${version}.md`);
  const escaped = version.replace(/\./g, '\\.');
  assert.match(notes, new RegExp(`<h3 id="cn-v${escaped}">`), 'Chinese section anchor');
  assert.match(notes, new RegExp(`<h3 id="en-v${escaped}">`), 'English section anchor');
});

test('all local Markdown and HTML links in project Markdown resolve', t => {
  let count = 0;
  const files = markdown(root);
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // `src="…"` too: the READMEs carry screenshots, and a moved image is the
    // kind of breakage a link check should catch.
    for (const match of text.matchAll(/\]\(([^)]+)\)|href="([^"]+)"|src="([^"]+)"/g)) {
      const link = match[1] ?? match[2] ?? match[3];
      if (/^[a-z]+:/i.test(link)) continue;
      const [path, fragment] = link.split('#');
      const target = path ? resolve(dirname(file), decodeURIComponent(path)) : file;
      count++;
      assert.ok(existsSync(target), `${file}: missing ${link}`);
      if (fragment && statSync(target).isFile() && extname(target) === '.md') {
        const body = readFileSync(target, 'utf8');
        const anchors = [...body.matchAll(/^#{1,6}\s+(.+)$/gm)].map(m => slug(m[1]));
        const explicit = [...body.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
        assert.ok(anchors.includes(decodeURIComponent(fragment)) || explicit.includes(fragment), `${file}: missing anchor ${link}`);
      }
    }
  }
  t.diagnostic(`${files.length} Markdown files, ${count} local links/anchors checked; simple project-heading slug rules only`);
});

test('both READMEs cross-link, name the package and document the install', () => {
  const en = read('README.md');
  const zh = read('README.zh.md');
  assert.match(en, /href="README.zh.md"/);
  assert.match(zh, /href="README.md"/);
  // The published package name is the one thing both READMEs must agree on.
  assert.match(en, /@idoall\/dsh-session-colors/);
  assert.match(zh, /@idoall\/dsh-session-colors/);
  // Installing without the dataDir step would silently lose durability, so the
  // README must show both halves of the setup.
  for (const body of [en, zh]) {
    assert.match(body, /dsh plugin --profile/);
    assert.match(body, /dataDir/);
  }
  // The package name in the README must match package.json.
  const pkg = JSON.parse(read('package.json'));
  assert.ok(en.includes(pkg.name), 'README.md names the published package');
  assert.ok(zh.includes(pkg.name), 'README.zh.md names the published package');
  // String-level checks only, not proof of semantic translation equivalence.
});

test('both READMEs state the DSH versions this build is verified against', () => {
  // The claim a reader actually needs is "which DSH does this plugin work on".
  // It has one machine-readable source (`dsh.compatibility.dshReleases`, which
  // DSH itself ignores) and both READMEs must repeat exactly that list, so a
  // version cannot be declared in one place and documented in neither.
  const pkg = JSON.parse(read('package.json'));
  const verified = Object.keys(pkg.dsh.compatibility.dshReleases);
  assert.ok(verified.length > 0, 'package.json must declare at least one verified DSH release');
  // The check below must have teeth: the range this release replaced does not
  // admit the prerelease it was running on, while a plain 0.1.7 release does.
  assert.equal(satisfies('0.1.7-alpha.2', '>=0.1.6-0 <0.2.0'), false, 'the replaced range must be rejected');
  assert.equal(satisfies('0.1.6-alpha.2', '>=0.1.6-0 <0.2.0'), true);
  assert.equal(satisfies('0.1.7', '>=0.1.6-0 <0.2.0'), true);
  assert.equal(satisfies('0.2.0-alpha.1', '>=0.1.7-alpha.2 <0.2.0'), false, 'the upper bound still excludes 0.2');
  for (const release of verified) {
    assert.equal(pkg.dsh.compatibility.dshReleases[release], 'compatible', release);
    // A "verified" claim must sit inside the range the package declares. The
    // check is prerelease-aware on purpose: `>=0.1.6-0 <0.2.0` does NOT admit
    // `0.1.7-alpha.2` under node-semver's default rule, which is how the plugin
    // came to declare a peer range that pnpm reported as unmet for the DSH it was
    // running on. A naive `includes('0.1.7')` would have passed it.
    for (const peer of ['@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-conversation']) {
      assert.ok(
        satisfies(release, pkg.peerDependencies[peer]),
        `${peer} range ${pkg.peerDependencies[peer]} must admit verified ${release}`,
      );
    }
  }
  for (const [name, body] of [['README.md', read('README.md')], ['README.zh.md', read('README.zh.md')]]) {
    assert.ok(body.includes(`\`${pkg.version}\``), `${name} must name the plugin version ${pkg.version}`);
    // The install command must not pin a version that can rot: it either follows
    // `latest` or names the version package.json declares. A pinned command that
    // nobody bumps keeps telling users to install an old release.
    const installs = [...body.matchAll(/add @idoall\/dsh-session-colors@([\w.-]+)/g)].map((m) => m[1]);
    assert.ok(installs.length > 0, `${name} must show an install command`);
    for (const pinned of installs) {
      assert.ok(
        pinned === 'latest' || pinned === pkg.version,
        `${name} install command pins @${pinned}: neither @latest nor the current ${pkg.version}`,
      );
    }
    for (const release of verified) assert.ok(body.includes(release), `${name} must name verified DSH ${release}`);
    assert.match(body, /compatibility|兼容性/, `${name} must have a compatibility section`);
  }
});

test('every standalone demo has one inline script that parses without dependencies', () => {
  assert.ok(demos.length > 0, 'the repository ships standalone demos');
  for (const name of demos) {
    const html = read(`demos/${name}`);
    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
    assert.equal(scripts.length, 1, `${name} must have exactly one inline script`);
    assert.equal(scripts[0][1].trim(), '', `${name} must not carry script attributes`);
    new Script(scripts[0][2], { filename: `demos/${name}:inline` });
  }
});

test('static demo markup has unique IDs and no external script/stylesheet references', () => {
  for (const name of demos) {
    const html = read(`demos/${name}`);
    const markup = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');
    const ids = [...markup.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
    assert.equal(new Set(ids).size, ids.length, `${name} must not repeat an id`);
    assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=|<link\b[^>]*\brel=["']stylesheet/i, name);
  }
  // Narrow static checks, not a general security/network isolation guarantee.
});

test('the README screenshots are real PNGs of the expected shape', () => {
  const expected = {
    'sidebar-chips.png': [280, 610],
    'color-picker.png': [276, 510],
    'mobile-drawer.png': [430, 932],
  };
  for (const [name, [width, height]] of Object.entries(expected)) {
    const png = readFileSync(resolve(root, 'docs/images', name));
    assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', `${name} must be a PNG`);
    assert.equal(png.readUInt32BE(16), width, `${name} width`);
    assert.equal(png.readUInt32BE(20), height, `${name} height`);
  }
});
