# Agent instructions

## Git workflow

This section is the git authority for this repo. It overrides the "no git operations" line that `bd prime` prints, which only describes beads' own `no-git-ops` setting.

- **One branch per feature or fix**, cut from `main` and named `<type>/<slug>` (`feat/ranked-matching`, `fix/basepath-links`). One bead or plan gets one branch.
- **Atomic commits**: each commit is one logical change and passes the CI checks (`.github/workflows/ci.yml`) on its own. Tests go in the commit with the change they cover. Tooling and formatting changes get their own commit.
- **Commit subjects** follow the existing history: `<type>: <Capitalized imperative summary>`, where type is `feat`, `fix`, `docs`, `chore`, `refactor` or `test`. Add a body when the reason isn't obvious from the diff.
- **Merge when done**: once the CI checks pass locally and the bead's acceptance criteria are met:
  1. Rebase onto `main`.
  2. `git merge --ff-only` into `main`, so `main` stays linear.
  3. Delete the branch.
  4. Close the bead.
- **Push** only when the maintainer asks.
