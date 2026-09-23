# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).


## [Unreleased]

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
