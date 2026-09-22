# DSH Session Colors — AI Working Rules

## Purpose

This repository **is** the plugin `@idoall/dsh-session-colors`: a DSH web plugin
that gives any Session a colour mark, shown as a chip on its sidebar row and
picked from the conversation header. It also keeps the design records and
standalone demos written while the feature was designed.

The plugin is implemented and verified, and is installed into the local `web`
profile from this directory. This repository holds **only** the shipping plugin
and its own records: the earlier "pinned Sessions" proposal was abandoned and its
documents, demos and tests have been deleted, so there is no second spec to tell
apart. The design record is `docs/plugin-design.zh.md`; `docs/` may hold nothing
else besides `docs/images/`, which a test enforces.

## Current authority

Implementing, testing and documenting the plugin in this repository is
authorised.

**Do not restart DSH.** Any restart the user's running service needs is performed
by the user. Publishing to npm, deployment, and changes to the global DSH
installation remain separately authorised stages.

## Rules that still apply

- **Never change real Session or Workspace data.** A mark is only a colour keyed
  by Session id. No creating, copying, moving, or reordering Sessions; no writes
  into Session logs, Workspace membership, or archive records.
- **Never patch individual Session rows, and never try to replace the
  `sidebar.workspaces` owner.** DSH owns that `single` slot. The sanctioned
  presentation is the click-through overlay described below.
- **Version alignment before anything the running GUI loads.** The checkout and
  the running installation must be compared first. This guard exists because
  installing a bundle from a mismatched checkout once made the entire left
  workspace unviewable.
- **Both halves must agree on the route prefix.** `ROUTE_PREFIX` in
  `src/index.js` and `MARKS_ROUTE` in `src/client.js` are checked by a test;
  changing one without the other breaks every device.
- **Record unanswered product choices** rather than inventing behaviour.

## Product invariants

- A mark never creates, copies, or moves a Session, and never changes a row's
  Workspace or display order.
- **Marks are stored on the Host**, not in the browser. Browser-local storage was
  tried and rejected: it is per-browser, so a colour set on one device never
  reached another.
- **DSH's own settings service cannot be used for this.** It is host-backed only
  for loopback pages (`persistence = $host.isLoopback ? "host" : "memory"`), so a
  page opened over a LAN address or a tunnel gets a permanently unavailable
  scope. The plugin therefore owns its routes and its JSON file.
- **The chip never covers the row's status dot.** The dot is what says a Session
  finished; the chip sits in the row's left padding, clear of it.
- **The overlay never accepts pointer events.** It is decoration only, so a
  failure can at worst stop chips from appearing — never block the app.
- **A failure must be visible.** A store that cannot be reached shows a warning
  on the header control instead of looking like a Session with no colour.

## Development

```sh
npm test        # unit tests for both halves
```

The browser half is a **hand-authored** `__ModuleLoader__` bundle — the only
format the DSH client loader accepts for a package client half. It is written by
hand on purpose: with no build step, nothing can drift from the DSH version it
targets. Do not introduce a bundler for it.

The Host half loads only at DSH boot; the browser half reloads on a page refresh.
Any change to `src/index.js` therefore needs a user-performed restart to take
effect.

## Review rule

Reviewers assess correctness, the invariants above, and documentation
consistency. Review does not grant any permission this file reserves for
explicit user approval.
