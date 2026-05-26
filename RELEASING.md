# Releasing a new version

Releases are driven by GitHub Releases. The `.github/workflows/release.yml` workflow runs on every published release, verifies the tag matches `package.json`, builds, tests, and publishes to npm using the `NPM_TOKEN` repository secret.

## Steps

1. **Bump the version** in `package.json`:
   - patch (`0.1.0` → `0.1.1`) for bug fixes
   - minor (`0.1.0` → `0.2.0`) for backward-compatible features
   - major (`0.1.0` → `1.0.0`) for breaking changes

2. **Commit and push** to `main`:
   ```bash
   git commit -am "chore: bump 0.1.1"
   git push origin main
   ```

3. **Create a release** with a tag of the form `vX.Y.Z` (the leading `v` is stripped before the version-match check):
   - Via the GitHub UI: *Releases → Draft a new release → tag* `v0.1.1` *→ Publish release*
   - Via CLI:
     ```bash
     gh release create v0.1.1 --target main --title v0.1.1 --notes "..."
     ```

The workflow takes around 30 seconds end to end.

## What the workflow does

1. **Verify** — `package.json` version equals the release tag (minus the `v` prefix). If not, the workflow fails before any publish runs.
2. **Install** — `yarn install --frozen-lockfile`
3. **Build** — `yarn build` (rollup → `dist/`)
4. **Test** — `yarn test --passWithNoTests`
5. **Publish** — `npm publish --access public` with `NODE_AUTH_TOKEN` from the `NPM_TOKEN` secret

Concurrency is capped at one release at a time so two simultaneous releases can't race.

## Recovering from a failed release

If the workflow fails (most often at the version-match step or because the npm token expired):

- Fix the underlying problem on `main` (bump the version, rotate `NPM_TOKEN`, etc.).
- Delete the failed release **and** its tag, both from the GitHub UI and locally if you pulled it:
  ```bash
  git tag -d v0.1.1
  git push origin :refs/tags/v0.1.1
  ```
- Cut a fresh release with the same or next version number.

A release that successfully published the npm package but failed a later step cannot be re-published under the same version — you must bump and re-release.

## Rotating the npm publish token

`NPM_TOKEN` is a repository secret on this repo. To rotate it:

1. Generate a new granular access token on npm scoped to **`@smithkit`** with publish permissions.
2. Update the secret:
   ```bash
   printf "%s" "<new-token>" | gh secret set NPM_TOKEN --repo OneDoshHQ/tanstack-query
   ```
3. Revoke the old token on npm.

No workflow change is needed; subsequent releases pick up the new token automatically.
