# Dependency Management

## Transitive Dependency Bumps (CVE Fixes)

When a CVE fix targets a transitive dependency (one not listed in package.json `dependencies` or `devDependencies`):

1. **Check the parent's semver range first.** Look in `package-lock.json` for the parent that pulls in the vulnerable dep. If the parent's declared range (e.g. `~2.0.7`) already covers the fixed version (e.g. `2.0.8`), a lockfile-only update is sufficient.

2. **Prefer `npm update <package>` over `overrides`.** When the range allows it, run `npm update <package>` to bump the version in the lockfile. Do NOT add an `overrides` entry in `package.json` — overrides are heavier-handed, persist indefinitely, and diverge from how MintMaker handles dependency upgrades for this project.

3. **Use `overrides` only when necessary.** Add an override only if the parent's semver range does NOT include the fixed version (e.g. parent pins `1.2.3` exactly and the fix is `1.2.4`). Remove the override once the parent updates its range.

## Lockfile Hygiene

`npm update` and `npm install` often introduce unrelated lockfile noise — extraneous entries like `"dev": true` flag changes, or new nested dependency blocks (e.g. `@noble/hashes` appearing under unrelated packages). These happen when the local npm/Node version differs from what generated the original lockfile.

**Keep diffs minimal:**
- After running `npm update <package>`, review the `package-lock.json` diff
- Remove any changes not directly related to the targeted dependency
- The PR diff should contain ONLY the version, integrity, resolved URL, and any new metadata (e.g. `funding`) for the bumped package
- Manual lockfile editing is acceptable and often necessary to achieve a clean diff

## MintMaker Conventions

This project uses MintMaker (Konflux) for automated dependency upgrades. MintMaker produces lockfile-only PRs — it does not add `overrides`. Manual CVE fix PRs should follow the same pattern for consistency:
- Modify only `package-lock.json` when possible
- Avoid `package.json` changes unless the dependency is direct

## PR Conventions for Dependency Bumps

- Commit message: `OLS-XXXX Bump <package> to <version> to fix CVE-YYYY-NNNNN`
- The PR should touch as few files as possible (ideally only `package-lock.json`)
- Run the full validation suite before pushing: `npm run lint && npm run type-check && npm run test-unit`
