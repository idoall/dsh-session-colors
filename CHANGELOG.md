# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

## [0.1.13] - 2026-10-27

### Changed

- Record DSH `0.2.1-rc.4` compatibility, retaining all ten previously verified
  versions. Update both READMEs and bilingual release notes to plugin `0.1.13`.
- No executable-code or load-range change. The installed rc.4 precheck accepts
  the manifest under the existing top-level `engines.dsh` range; both default
  semver and `includePrerelease` admit it.

### Verification and limits

- Official `0.2.1-rc.3` artifacts were compared with the installed `0.2.1-rc.4`
  artifacts for every package this plugin consumes. The DSH CLI's `lib/` — the
  manifest and load-range gate — is byte-identical; `dsh-host-webserver`,
  `dsh-client-connection`, `dsh-client-ui-layout`, `dsh-client-ui-workspace`,
  `dsh-client-ui-renderer` (the `slots`, `locale` and `layout` services) and
  `dsh-web-app` differ only in `package.json`; `dsh-client-modules` differs only in
  its recorded commit hash and version. Both target slot declarations
  (`conversation.session.header.utilities`, `shell.overlay`) are unchanged. The
  conversation and sidebar Client bundles do carry real changes (a View-tab
  tooltip and the sidebar build string), so this is not a claim that all DSH
  artifacts are byte-identical.
- A disposable profile (a fresh `DSH_HOME`, never the user's) installed the
  `0.1.13` tarball and booted `dsh web` on `0.2.1-rc.4` on a spare port with no
  compatibility denial: the marks route answered `200` for an authenticated `GET`,
  round-tripped a `POST`ed mark, and the browser half was served at its revisioned
  boot URL (52 732 bytes) in the `__ModuleLoader__` format. The throwaway profile
  and its server were removed afterwards; the user's profile, running service and
  other workspaces' plugins were not touched.
- Live Host inspection confirms the plugin is mounted under rc.4 and its own
  authenticated route answers 401 to an unauthenticated request. No real marks,
  Sessions, profile configuration or other plugins were modified.
- The 38 existing unit tests pass. The header control's rendered appearance was
  not inspected in a real browser, so no fresh visual result is claimed. Existing
  DOM/fiber dependence and silent persistence-write failures remain pre-existing
  limitations, not regressions identified in this upgrade.
- Release verification includes extracting the published npm tarball and comparing
  its file set against the release tag, including both READMEs, the manifest,
  source and CHANGELOG.

## [0.1.12] - 2026-10-23

### Changed

- Record DSH `0.2.1-rc.3` compatibility, retaining all nine previously verified
  versions. Update both READMEs and bilingual release notes to plugin `0.1.12`.
- Strengthen documentation tests to require the banner, current-release paragraph
  and unique npm-latest matrix row to agree with the manifest's current versions.
- No executable-code or load-range change. The installed rc.3 precheck accepts
  the manifest under the existing top-level `engines.dsh` range; both default
  semver and `includePrerelease` admit it.

### Verification and limits

- Live Host inspection confirms the plugin is mounted and its exact-route and
  connection-auth contracts remain compatible. An unauthenticated marks request
  returns 401; an unregistered sibling route returns 404. No real marks, Sessions,
  profile configuration or other plugins were modified.
- Official rc.2 artifacts were compared with installed rc.3 artifacts. The
  consumed Host webserver/connection contracts and the target Client slot
  declarations remain compatible. DSH does contain navigation, draft and message
  expansion changes: this is not a claim that all artifacts are byte-identical.
- The 38 existing unit tests pass. Live Client inspection did not expose the
  conversation header slot, so no new visual/mobile/browser end-to-end result is
  claimed. Existing DOM/fiber dependence and silent persistence-write failures
  remain pre-existing limitations, not regressions identified in this upgrade.
- Release verification includes extracting the published npm tarball and comparing
  its complete file set and bytes against the release tag, including both
  READMEs, the manifest, source and CHANGELOG.

## [0.1.11] - 2026-10-17

Verified against DeepSeek Harness `0.2.1-rc.2` (the latest `0.2.1` release
candidate) as well as `0.2.1-alpha.5`, `0.2.1-alpha.4`, `0.2.1-alpha.3`,
`0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`. No
logic change and no load-range change: every package this plugin consumes is
byte-identical between `0.2.1-alpha.5` and `0.2.1-rc.2`, and the `0.2.1` line
declared in `0.1.9` already admits prereleases of that tuple.

### Changed

- `dsh.compatibility.dshReleases` now records `0.2.1-rc.2` alongside
  `0.2.1-alpha.5`, `0.2.1-alpha.4`, `0.2.1-alpha.3`, `0.2.0-rc.2`, `0.2.0-rc.1`,
  `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`; both READMEs state all nine
  versions and name `0.2.1-rc.2` as the newest one.
- No other declaration moved. The range still lives in the top-level
  `engines.dsh` that `0.1.9` moved it to, and it stays unchanged because a
  comparator naming the `0.2.1` tuple admits that tuple's prereleases: the RC
  satisfies it under both DSH's `includePrerelease` precheck and node-semver's
  default rule, and the `0.2.1` final release will be admitted by the same
  alternative.

### Notes

- Measured difference between the two DSH releases for everything this plugin
  touches: the client bundles of `dsh-client-ui-workspace`,
  `dsh-client-ui-conversation`, `dsh-client-ui-layout` and `dsh-client-modules`,
  the compatibility precheck in `dsh-app-boot/lib/index.js`, and the Host-side
  `dsh-host-webserver` and `dsh-client-connection` code are all
  **byte-identical** — a diff of zero lines each.
- `evaluatePluginCompatibility` on the shipped manifest with runtime
  `0.2.1-rc.2` reports no unmet requirement, through the `engines.dsh`-first
  branch that `0.2.1-alpha.4` introduced.
- Measured end-to-end on the running `0.2.1-rc.2` web profile: the boot log
  disables no row of this plugin; the plugin's own route answers
  `GET /plugins/dsh-session-colors/marks` with `401` through the connection fence
  while an unregistered path under the same prefix answers `404`; the composed
  boot graph serves this package's `client.js` and the served bundle contains
  `src/client.js` verbatim; the client half prints
  `build=host-routes+animated-rows` with no page error; the header control renders
  inside the conversation header's utilities cluster on an open Session and the
  picker opens and closes; and the chip layer is present, click-through and
  reports `ready`. No chip was painted in this measurement, which is correct: the
  two marks in the store belong to Sessions that are not in the rendered sidebar,
  and the layer deliberately skips rows outside the scroll viewport.
- Published package contents were diffed against this repository: every one of
  the 11 whitelisted files in `@idoall/dsh-session-colors@0.1.10` on npm is
  byte-identical to the tagged source, and the same check is repeated for
  `0.1.11` after publication.
- `npm test` passes on this tree (38/38) and `npm pack --dry-run` still ships
  exactly the 11 whitelisted files.

## [0.1.10] - 2026-10-16

Verified against DeepSeek Harness `0.2.1-alpha.5` (the latest alpha) as well as
`0.2.1-alpha.4`, `0.2.1-alpha.3`, `0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`,
`0.1.7-rc.1` and `0.1.7-alpha.2`. No logic change and no declaration change beyond
the new entry: every package this plugin consumes is byte-identical between
`0.2.1-alpha.4` and `0.2.1-alpha.5`, and the load range already admitted
`0.2.1-alpha.5`.

### Changed

- `dsh.compatibility.dshReleases` now records `0.2.1-alpha.5` alongside
  `0.2.1-alpha.4`, `0.2.1-alpha.3`, `0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`,
  `0.1.7-rc.1` and `0.1.7-alpha.2`; both READMEs state all eight versions.
- No other declaration moved. The load range is unchanged, and it stays in the
  top-level `engines.dsh` that `0.1.9` moved it to.

### Notes

- Measured difference between the two alphas for everything this plugin touches:
  the client bundles of `dsh-client-ui-workspace`, `dsh-client-ui-conversation`,
  `dsh-client-ui-layout` and `dsh-client-modules`, the compatibility precheck in
  `dsh-app-boot/lib/index.js`, and the Host-side `dsh-host-webserver` and
  `dsh-client-connection` code are all **byte-identical**. A diff of zero lines
  each, so there is nothing to adapt to and no control experiment to run.
- `evaluatePluginCompatibility` on the shipped manifest with runtime
  `0.2.1-alpha.5` reports no unmet requirement, through the `engines.dsh`-first
  branch that `0.2.1-alpha.4` introduced.
- Measured end-to-end on the running `0.2.1-alpha.5` web profile: the boot log
  disables no row of this plugin; the plugin's own route answers
  `GET /plugins/dsh-session-colors/marks` with `401` through the connection fence
  while an unregistered path under the same prefix answers `404`; the composed
  boot graph serves this package's `client.js` and the served bundle contains
  `src/client.js` verbatim; the client half prints
  `build=host-routes+animated-rows` with no page error; the header control renders
  on a marked Session and opens the picker; and each marked row at least partly
  inside the sidebar's scroll viewport gets its 4x16 chip, vertically centred in
  the 32px row at `left=14` against `row.left=12`, clear of the status dot.
- `npm test` passes on this tree (38/38) and `npm pack --dry-run` still ships
  exactly the 11 whitelisted files.

## [0.1.9] - 2026-10-16

Verified against DeepSeek Harness `0.2.1-alpha.4` (the latest alpha) as well as
`0.2.1-alpha.3`, `0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and
`0.1.7-alpha.2`. No logic change: every contract this plugin depends on is
unchanged, the boot gate accepts the same range under both semver rules, and this
release records the new alpha and moves the declared DSH requirement to the field
`0.2.1-alpha.4` actually enforces.

### Changed

- The declared DSH range moves from the namespaced `dsh.engines.dsh` to the
  **top-level `engines.dsh`**, with the value unchanged. `0.2.1-alpha.4` added an
  `engines.dsh`-first branch to the compatibility precheck: when that field is
  present it decides alone and `peerDependencies` are ignored, and the
  marketplace (`dsh-plugin-market`) builds its compatibility view from the same
  field. Nothing in DSH reads `dsh.engines.dsh`, so the requirement this plugin
  documented was previously inert metadata; the peer ranges carried the gate.
  On DSH releases up to `0.2.1-alpha.3` the top-level field is not read at all, so
  behaviour there is unchanged, and the test that guards the declaration now
  asserts the new location.
- `dsh.compatibility.dshReleases` now records `0.2.1-alpha.4` alongside
  `0.2.1-alpha.3`, `0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and
  `0.1.7-alpha.2`; both READMEs state all seven versions.

### Notes

- The load range itself is unchanged: `>=0.2.1-alpha.3 <0.3.0` already admits
  `0.2.1-alpha.4` under DSH's `includePrerelease` precheck and under node-semver's
  default rule, so no alternative had to be added this time. The measured
  `evaluatePluginCompatibility` result for the shipped manifest on runtime
  `0.2.1-alpha.4` is "no unmet requirement".
- Contracts compared tag-by-tag between the two alphas:
  `dsh-client-ui-workspace`'s and `dsh-client-ui-layout`'s client bundles are
  **byte-identical**; in `dsh-client-ui-conversation` and `dsh-client-modules` the
  changed lines do not touch `conversation.session.header.utilities`,
  `sessionId` wiring, or the `__ModuleLoader__.load({ id, factory })`
  registration contract (the loader's change is a new boot-manifest release
  identity). The row still carries `data-row-key="session:<id>"` with
  `role="treeitem"` + `aria-selected`.
- Measured end-to-end on the running `0.2.1-alpha.4` web profile: the plugin's
  own route answers `GET /plugins/dsh-session-colors/marks` with `401` through the
  connection fence while an unregistered path under the same prefix answers
  `404`; the composed boot graph serves this package's `client.js` and the served
  bundle contains `src/client.js` verbatim; the client half prints
  `build=host-routes+animated-rows` with no page error; the header control renders
  on a marked Session and opens the picker; and each marked row that is at least
  partly inside the sidebar's scroll viewport gets its 4x16 chip, vertically
  centred in the 32px row (`chip.top` = row `top` + 8) at `left=14` against
  `row.left=12`, clear of the status dot.
- `npm test` passes on this tree (38/38) and `npm pack --dry-run` still ships
  exactly the 11 whitelisted files.

## [0.1.8] - 2026-10-15

Verified against DeepSeek Harness `0.2.1-alpha.3` (the latest alpha) as well as
`0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`. No
logic change: every contract this plugin depends on is unchanged, DSH's boot
precheck already accepted the previous range, and this release confirms the same
code on the new alpha and names its tuple in the declared load range.

### Changed

- The `peerDependencies` and `dsh.engines.dsh` ranges gain a fifth
  alternative: `>=0.1.7-alpha.2 <0.2.0-0 || 0.2.0-rc.1 || 0.2.0-rc.2 || >=0.2.0 <0.3.0 || >=0.2.1-alpha.3 <0.3.0`.
  Under node-semver's prerelease rule a prerelease is admitted only when a
  comparator names its exact `major.minor.patch`, so the verified `0.2.1` tuple
  has to be written out; a later `0.2.2-alpha.1` remains unadmitted. DSH's own
  boot check reads the range permissively (`includePrerelease`), which is why
  `0.2.1-alpha.3` already loaded on the previous range, and the fourth
  alternative is why stable `0.2.x` releases still load.
- `dsh.compatibility.dshReleases` now records `0.2.1-alpha.3` alongside
  `0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`;
  both READMEs state all six versions.

### Notes

- Contracts verified present on `0.2.1-alpha.3`: the compatibility precheck
  accepts the manifest unchanged (`evaluatePluginCompatibility` returns no
  conflict); the client-modules `__ModuleLoader__.load({ id, factory })`
  contract, the `slots.inject`/`slots.register` pair, the
  `conversation.session.header.utilities` (session-scoped, `sessionId` standard
  prop) and `shell.overlay` slots, the `locale.register`/`bind` service and the
  `layout` service; and the sidebar row still carries
  `data-row-key="session:<id>"` with `role="treeitem"` + `aria-selected`.
- Measured end-to-end against the running `0.2.1-alpha.3` web profile: the
  plugin's own route answers `GET /plugins/dsh-session-colors/marks` with `200`
  (an unregistered path under the same prefix answers `404`); the composed boot
  graph serves `@idoall/dsh-session-colors/client.js`, and the served bundle
  contains `src/client.js` verbatim; in the browser the client half prints
  `[dsh-session-colors] build=host-routes+animated-rows` with no page error, the
  header control renders on a marked Session and opens the picker, and each
  marked visible row gets a 4x16 chip vertically centred in its 32px row
  (`chip.left=14` against `row.left=12`), clear of the status dot.
- The repository's own tests pass on this tree (38/38), and the `0.2.1-alpha.3`
  boot log disables only `browser-use` and `browser-use-playwright-mcp`, whose
  peers still pin `0.2.1-alpha.1`; this plugin is not among them.

## [0.1.7] - 2026-09-30

Verified against DeepSeek Harness `0.2.0-rc.2` (the latest release candidate) as
well as `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`. No logic
change: every contract this plugin depends on is unchanged between `0.2.0-rc.1`
and `0.2.0-rc.2`, and this release confirms the same code on the new RC and
records it in the declared range. `0.1.6` is rejected by the `0.2.0-rc.2` boot
precheck because its range stops at `0.2.0-rc.1`; `0.1.7` is what lifts that.

### Changed

- `src/client.js`'s header comment now names the slot the file actually
  registers on, `conversation.session.header.utilities`; it had kept the older
  `conversation.session.header.actions` spelling. Comment only: no executed
  statement changes.
- The `peerDependencies` and `dsh.engines.dsh` ranges gain a fourth
  alternative: `>=0.1.7-alpha.2 <0.2.0-0 || 0.2.0-rc.1 || 0.2.0-rc.2 || >=0.2.0 <0.3.0`.
  Under node-semver's prerelease rule a prerelease is admitted only when a
  comparator names its exact `major.minor.patch`, so `0.2.0-rc.2` has to be
  written out; a later `0.2.0-rc.3` remains unadmitted. The verified `0.1.7`
  line and the stable `0.2.0` line up to `<0.3.0` are unchanged.
- `dsh.compatibility.dshReleases` now records `0.2.0-rc.2` alongside
  `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`; both READMEs
  state all five versions.

### Notes

- Contracts verified unchanged between `0.2.0-rc.1` and `0.2.0-rc.2`: the
  compatibility precheck (`evaluatePluginCompatibility` and its callers) is
  byte-identical; the client-modules loader and the slot registration API differ
  only in package version numbers; `ui-workspace`'s row rendering
  (`Rows.tsx`, `AnimatedRows.tsx`, `WorkspaceBrowser.tsx`) is untouched and the
  row still carries `data-row-key="session:<id>"`, `role="treeitem"` and
  `aria-selected`; the `conversation.session.header.utilities` and
  `shell.overlay` catalog entries are identical; `ui-layout` and
  `ui-conversation` change only in `ConversationMainPanel`'s width-controls
  refactor and in locale strings.
- Measured end-to-end on a disposable `0.2.0-rc.2` web profile built for this
  release (the running profile is not touched): the plugin bundle mounts with no
  precheck warning, and in the browser the client half loads and prints
  `[dsh-session-colors] build=host-routes+animated-rows`, the header control
  renders inside `conversation.session.header.utilities`, the picker panel
  opens, a chosen colour round-trips through
  `GET`/`POST /plugins/dsh-session-colors/marks` with `persistence: "file"`, the
  chip lands vertically centred in the 32px Session row inside its 8px left
  padding, and clearing the mark removes both the mark and the chip.
- Control experiment: the same tarball at `0.1.6` is refused by
  `dsh plugin add` on `0.2.0-rc.2` with the reported `incompatible` error, while
  `0.1.7` installs and mounts.
- `0.1.7` supports DSH `0.2.0-rc.2`, `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1`
  and `0.1.7-alpha.2`. Installations on an older DSH, including
  `0.1.6-alpha.2`, should stay on plugin `0.1.2`.

## [0.1.6] - 2026-09-28

Verified against DeepSeek Harness `0.2.0-rc.1` (the latest release candidate) as
well as `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`. No code change: every
contract this plugin depends on is unchanged between `0.1.7-rc.2` and
`0.2.0-rc.1`, and this release confirms the same code on the new RC and records
it.

### Changed

- The `peerDependencies` and `dsh.engines.dsh` ranges change from
  `>=0.1.7-alpha.2 <0.2.0` to
  `>=0.1.7-alpha.2 <0.2.0-0 || 0.2.0-rc.1 || >=0.2.0 <0.3.0`. The old upper
  bound admitted `0.2.0-rc.1` only through node-semver's prerelease ordering; on
  the `0.2.0` **final** release the compatibility precheck would have disabled
  the plugin row at boot. Under node-semver's prerelease rule a prerelease is
  admitted only when a comparator names its exact `major.minor.patch`, so the
  new range has three alternatives: the verified `0.1.7` line, exactly
  `0.2.0-rc.1` (an untested `0.2.0-rc.2` stays out), and the stable `0.2.0`
  line up to `<0.3.0`.
- `dsh.compatibility.dshReleases` now records `0.2.0-rc.1` alongside
  `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`; both READMEs state all four
  versions.

### Notes

- Contracts verified unchanged between `0.1.7-rc.2` and `0.2.0-rc.1`: the
  client-modules loader and the slot registration API differ only in package
  version numbers; the compatibility precheck
  (`evaluatePluginCompatibility` and its callers) is byte-identical; the
  sidebar row keeps `data-row-key="session:<id>"`, `role="treeitem"` and
  `aria-selected`; `conversation.session.header.utilities` is still a
  session-scoped list; `shell.overlay` is still declared by `ui-layout`; the
  `slots`/`locale`/`layout` service faces and the `react@^18.2.0` baseline are
  unchanged.
- Verified on the running `0.2.0-rc.1` web-profile instance with the published
  `0.1.5`: the client half loads and prints its diagnostic line, the Host half's
  `GET /plugins/dsh-session-colors/marks` answers `200`, the header control
  renders, and DSH does not disable the plugin row.
- `0.1.6` supports DSH `0.2.0-rc.1`, `0.1.7-rc.2`, `0.1.7-rc.1` and
  `0.1.7-alpha.2`. Installations on an older DSH, including `0.1.6-alpha.2`,
  should stay on plugin `0.1.2`.

## [0.1.5] - 2026-09-25

Verified against DeepSeek Harness `0.1.7-rc.2` (the latest release candidate) as
well as `0.1.7-rc.1` and `0.1.7-alpha.2`. No code change: every contract this
plugin depends on is unchanged between `rc.1` and `rc.2`, and this release
confirms the same code on the second RC and records it.

### Added

- `dsh.compatibility.dshReleases` now records `0.1.7-rc.2` alongside
  `0.1.7-rc.1` and `0.1.7-alpha.2`; both READMEs state all three versions.
- The design record documents the one substantive addition in `rc.2` — the
  Session-row seats `sidebar.session.row.leading` and `sidebar.session.row.hover`
  — and why the chip deliberately stays on its own click-through layer instead of
  moving into that seat: the leading seat shares the status dot's 16px cell and is
  mounted only while a row is idle, so a chip placed there would disappear for
  running, waiting and archived Sessions.

### Notes

- The peer and `dsh.engines.dsh` ranges stay `>=0.1.7-alpha.2 <0.2.0`. Under
  node-semver's prerelease rule that range already admits `0.1.7-rc.2` (a
  comparator names the same `major.minor.patch`), so it was deliberately **not**
  widened for the second RC — widening would admit versions nobody tested.
- `0.1.5` supports DSH `0.1.7-rc.2`, `0.1.7-rc.1` and `0.1.7-alpha.2`.
  Installations on an older DSH, including `0.1.6-alpha.2`, should stay on plugin
  `0.1.2`.
- The duplicated `@deepseek-ai/schemastery` peer bullet in the English README was
  removed; the Chinese README already carried it once.

## [0.1.4] - 2026-09-23

Verified against DeepSeek Harness `0.1.7-rc.1` (the latest release candidate) as
well as `0.1.7-alpha.2`. No code change: `0.1.3` already absorbed the `0.1.7`
changes, and this release confirms the same code on the RC and records it.

### Added

- `dsh.compatibility.dshReleases` now records `0.1.7-rc.1` alongside
  `0.1.7-alpha.2`; both READMEs state both versions.
- The design record documents the new `0.1.7-rc.1` behaviour that makes the peer
  range load-bearing: boot evaluates `@deepseek-ai/dsh*` peers and **disables** a
  plugin row whose range the running version does not satisfy.

### Notes

- The peer and `dsh.engines.dsh` ranges stay `>=0.1.7-alpha.2 <0.2.0`. Under
  node-semver's prerelease rule that range already admits `0.1.7-rc.1` (a
  comparator names the same `major.minor.patch`), so it was deliberately **not**
  widened for the RC — widening would admit versions nobody tested.
- `0.1.4` supports DSH `0.1.7-rc.1` and `0.1.7-alpha.2`. Installations on an
  older DSH, including `0.1.6-alpha.2`, should stay on plugin `0.1.2`.

## [0.1.3] - 2026-09-23

Verified against DeepSeek Harness `0.1.7-alpha.2`. The first fix below is what
made the previous build fail to load on that release; the other two are a
declaration correctness fix and a visible behaviour fix.

### Fixed

- **The plugin could not load from a `link:` install on DSH 0.1.7.** From 0.1.7,
  only a linked plugin's **peer** dependencies resolve from the running
  installation; a plain dependency is looked up under the plugin's own
  `node_modules`, which a link install does not populate. `@deepseek-ai/schemastery`
  was a plain dependency and this repository ships no `node_modules`, so the Host
  half failed to import and the plugin never loaded. It is a peer now (kept in
  `devDependencies` for this repository's own tests).
- **The declared peer range excluded the release it was running on.**
  `>=0.1.6-0 <0.2.0` does **not** admit `0.1.7-alpha.2` under node-semver's
  default prerelease rule, so pnpm reports the peer as unmet (the plugin market's
  discovery check passes `includePrerelease`, which is why it did not surface as
  an outright incompatibility). The range is now `>=0.1.7-alpha.2 <0.2.0`, with a
  `dsh.engines.dsh` requirement and `dsh.compatibility.dshReleases` recording
  `0.1.7-alpha.2`.
- **Chips no longer stayed behind while rows glided.** DSH 0.1.7 moves sidebar
  rows with the Web Animations API (`element.animate`), which fires neither
  `transitionrun` nor `transitionend` and mutates no DOM. The layer only opened
  its bounded follow window on a transition event, so a collapse, expand or
  reorder left every chip at the position the glide started from. A row-list
  mutation and a window resize now re-measure once and enter the same 40-frame
  follow window; an unrelated body mutation re-measures once but opens no window,
  so a streaming transcript cannot keep a measuring loop alive.

### Changed

- The Session id is read from the row's own `data-row-key` (`session:<id>`, added
  in DSH 0.1.7) before falling back to the React fiber, so the common case no
  longer depends on React internals. The fiber fallback remains for older builds
  and search-result rows.
- The client build marker is `host-routes+animated-rows`.
- The docs-consistency test now evaluates the peer range with the prerelease
  rule instead of a substring check — the check that let the old, excluding range
  pass.

### Notes

- `0.1.3` supports DSH `0.1.7-alpha.2` only and declares
  `>=0.1.7-alpha.2 <0.2.0` as its Host requirement. Installations on an older DSH,
  including `0.1.6-alpha.2`, should stay on plugin `0.1.2`.

## [0.1.2] - 2026-09-22

### Fixed

- Chips no longer stay at their old coordinates for up to 20 seconds when a
  workspace is collapsed or expanded. Each mutation option set now gets its own
  `MutationObserver`: a second `observe()` call on the same target **replaces**
  the first one's options rather than merging them, so sharing one observer for
  `childList` and for the `body` class had silently stopped row additions and
  removals from being watched at all. The chips only moved when the 20-second peer
  poll happened to re-render the layer.

### Added

- A regression test that fails if two option sets ever share one observer again.

## [0.1.1] - 2026-09-22

Documentation only — no code change.

### Fixed

- The npm package no longer tells visitors it is unpublished. The `0.1.0` tarball
  was packed before the README was updated, so the package page carried a grey
  "not published" badge and an install section that said the package was not on
  npm yet. npm packages are immutable, so this needed a new version.

### Added

- `screenshots.json` declares the three screenshots the plugin-market detail view
  shows. It lives in this repository, so replacing one later is a push here rather
  than a pull request to the list.

### Notes

- First tag-driven release: pushing `v0.1.1` publishes through npm Trusted
  Publishing (OIDC), with no npm token and no manual second factor.

## [0.1.0] - 2026-09-22

First release.

### Added

- A colour mark for any Session, chosen from a system-style picker in the
  conversation header: saturation/value field, hue and alpha sliders, hex and
  RGBA fields, seven theme swatches, a saved-colours row, and screen eyedropper
  where the browser supports `EyeDropper`.
- A colour chip on the marked Session's sidebar row, painted into a
  frame-wide click-through overlay and clipped to the sidebar's scroll
  container.
- Host-side storage: marks live in `session-colors.json` under the profile's
  data directory, served by the plugin's own `GET`/`POST /plugins/dsh-session-colors/marks`
  routes, so a colour chosen on one device is visible on every other one,
  including over LAN and tunnels.
- Live cross-device pickup: the open page re-reads marks when it becomes visible
  again and on a slow interval.
- Optional `dataDir` config; without it marks live for the process only and the
  feature degrades instead of failing.
- Diagnostics on the overlay element (`data-dsh-sc-build`, `-status`,
  `-writable`, `-marks`, `-error`) so a device that shows nothing can say why
  from a plain DOM dump.



### Fixed

- The picker's hex field clipped its own value: seven characters (`#FFCC00`) did
  not fit in the 51px it had, so the panel showed `#FFCC0`. The hex column is
  wider than the numeric ones now and the inputs carry tighter padding, so the
  full value is visible.
- A colour chip is now visible inside a phone's sidebar drawer. Two causes
  stacked: DSH confines `shell.overlay` to a stacking context of its own
  (`z-index: 20`), so a mobile adapter that promotes the sidebar to a
  `position: fixed; z-index: 10000` drawer painted its opaque background over
  every chip; and that drawer slides in with a CSS transition, which fires no
  scroll, resize or DOM mutation, so the layer kept the off-screen coordinates it
  had while the drawer was closed. The layer now renders through a portal on
  `document.body`, measures the row's own ancestor chain to paint one level above
  whatever holds the sidebar (1 on a stock desktop, 10001 behind such a drawer),
  and follows an ancestor's transition. On the desktop the layer still sits below
  dialogs, and the build marker is now `host-routes+drawer-aware`, so a device can
  report which client it runs.

### Changed

- Both READMEs rewritten around what a reader needs first: the verified DSH
  version, requirements, usage, a compatibility table, cross-device storage,
  configuration, troubleshooting, security boundaries and uninstall. All three
  screenshots were retaken from the current build (sidebar marks, the picker, and
  a phone's drawer).
- The DSH version this build was verified against is now declared in
  `package.json` as `dsh.compatibility.dshReleases` (DSH ignores the field) and
  both READMEs must repeat exactly that list: a test fails if a README drops a
  version, if the claim falls outside the `peerDependencies` range, or if a
  README image stops resolving.
- Repository housekeeping, no change to what the package ships: the abandoned
  "pinned Sessions" line is **deleted** — its documents, its two demos, its test
  material and its evidence — so the repository holds only the shipping plugin and
  its own records. A test now keeps `docs/` to the design record plus
  `docs/images/` instead of letting a second spec grow back.
- `demos/session-color-mark-demo.html` was rebuilt as a single self-contained page
  that mirrors the real picker's styling and the chip's geometry (4×16 bar in the
  row's left padding, clear of the status dot).
