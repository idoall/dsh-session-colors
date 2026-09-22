# Releasing dsh-session-colors

Releases are built from immutable Git tags and published by GitHub Actions
through npm Trusted Publishing (GitHub OIDC). The repository stores **no**
`NPM_TOKEN`, npm access token, or OTP. npm packages are immutable: never reuse a
version that npm has accepted.

## Branch model

| Branch | Rule |
| --- | --- |
| `main` | Protected: no direct pushes. Every change arrives through a pull request. Releases are tagged from here. |
| `dev` | Working branch. Day-to-day development lands here first, then opens a pull request into `main`. |

A release tag is cut from `main` **after** the pull request is merged, so the
tagged commit is always a commit that went through review.

## npm Trusted Publisher

The public package at
[npmjs.com/package/@idoall/dsh-session-colors](https://www.npmjs.com/package/@idoall/dsh-session-colors)
is bound to this repository:

| npm field | Value |
| --- | --- |
| Provider | GitHub Actions |
| Owner | `idoall` |
| Repository | `dsh-session-colors` |
| Workflow filename | `release.yml` |
| Environment | Leave blank |

The workflow path must remain `.github/workflows/release.yml`. The `publish` job
receives only a short-lived GitHub OIDC token through `id-token: write`. Do not
add an `NPM_TOKEN` GitHub secret.

`0.1.0` is bootstrapped once with a token because npm cannot attach a Trusted
Publisher until the package exists. Later versions must use OIDC only.

## What a release tag does

Pushing a tag matching `v*` triggers
[`.github/workflows/release.yml`](../.github/workflows/release.yml):

1. Require `vX.Y.Z` to exactly match `package.json`'s `X.Y.Z` version **and**
   require `docs/releases/vX.Y.Z.md` to exist with both a Chinese and an English
   section anchor.
2. Install with a frozen lockfile, run the tests, and pack exactly one `.tgz`
   artifact (there is no build step: the browser half is hand-authored).
3. Upload that artifact and `SHA256SUMS` as a GitHub Actions artifact.
4. Publish that same artifact to npm with Trusted Publishing and the `latest`
   dist-tag.
5. Create (or update) the GitHub Release with that notes file as its body and
   attach the tarball and checksum **only after** the publish job succeeds.

If `@idoall/dsh-session-colors@X.Y.Z` already exists on npm, the immutable npm
package is left unchanged and the workflow continues safely to the GitHub Release
step.

## Release notes are hand-written and bilingual

Every release has exactly one file: `docs/releases/vX.Y.Z.md`. The GitHub Release
body **is** that file — the workflow passes it with `--notes-file` and never uses
`--generate-notes`, because commit titles do not tell a user what changed for
them, what it breaks, or what they must do.

Rules:

- The two `<h3 id="cn-…">` / `<h3 id="en-…">` anchors are mandatory and must match
  the tag: the gate greps for `<h3 id="cn-vX.Y.Z">` and `<h3 id="en-vX.Y.Z">`.
- Chinese section first, English section second; both must carry the same facts —
  not a summary of the other language.
- Lead with the version matrix: which plugin version was verified against which
  DeepSeek Harness release, and which of them are actually on npm.
- Write every entry as *what changed → who is affected → what the user must do*.
  State the verified DSH release, the exact upgrade command, and any remaining
  limitation explicitly.
- Keep the same facts in [`CHANGELOG.md`](../CHANGELOG.md); the release notes may
  be longer and user-facing, but they must not contradict it.

## Before every release

Never release an uncommitted worktree or reuse a published npm version.

1. Write `docs/releases/vX.Y.Z.md` (bilingual, hand-written — see above) **and**
   the matching `CHANGELOG.md` entry in the same commit.
2. Update the compatibility table in `README.md` and `README.zh.md`: the verified
   DeepSeek Harness release(s) and the npm status of every version.
3. Bump `package.json`'s `version` and `dsh.compatibility.dshReleases` together —
   the verified list has exactly one home, and a test keeps both READMEs in sync
   with it.
4. Verify on `dev`, then open the pull request into `main`:

```sh
pnpm install --frozen-lockfile
pnpm test
node -p "require('./package.json').version"
npm pack --dry-run
```

Confirm npm does not already own the exact version:

```sh
VERSION="$(node -p "require('./package.json').version")"
npm view "@idoall/dsh-session-colors@$VERSION" version || true
```

## Publish a version

After the matching source commit is on `main`:

```sh
VERSION="$(node -p "require('./package.json').version")"
git switch main
git pull --ff-only
git tag -a "v$VERSION" -m "@idoall/dsh-session-colors v$VERSION"
git push origin "v$VERSION"
```

Watch the **Release** workflow in GitHub Actions. It publishes npm and creates the
GitHub Release; do not run `npm publish` locally for a tag-managed release. Never
reuse a published version.

## Verify the public package

```sh
VERSION="$(node -p "require('./package.json').version")"
npm view "@idoall/dsh-session-colors@$VERSION" name version dist-tags repository --json

VERIFY_DIR="$(mktemp -d)"
cd "$VERIFY_DIR"
npm pack "@idoall/dsh-session-colors@$VERSION"
tar -xzf idoall-dsh-session-colors-$VERSION.tgz
node -e "const p=require('./package/package.json'); console.log(p.name, p.version, p.dsh.client.platform)"
```

The final command must print:

```text
@idoall/dsh-session-colors X.Y.Z web
```

Then install it in a disposable DSH profile and verify the sidebar chip, the
picker panel, clearing a mark, and the chip inside a phone-width sidebar drawer:

```sh
TEST_HOME="$(mktemp -d)"
DSH_HOME="$TEST_HOME" dsh plugin --profile web add "@idoall/dsh-session-colors@$VERSION"
DSH_HOME="$TEST_HOME" dsh web
```

Stop the disposable DSH Web process after verification. The plugin only ever
stores a Session id and a colour: it does not create, copy, move or reorder
Sessions.
