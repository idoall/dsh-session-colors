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
  for (const release of verified) {
    assert.equal(pkg.dsh.compatibility.dshReleases[release], 'compatible', release);
    // A "verified" claim must sit inside the range the package declares.
    const core = release.split('-')[0];
    for (const peer of ['@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-client-ui-conversation']) {
      assert.ok(pkg.peerDependencies[peer].includes(core), `${peer} range must cover verified ${release}`);
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
