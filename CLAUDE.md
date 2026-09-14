@AGENTS.md

## Git workflow

This project is worked on from two places — the desktop app on this Mac and
mobile/cloud sessions — and GitHub is the only thing connecting them. Both sides
share one branch: `main`.

- **Work on `main`.** Don't create a separate `claude/...` branch for routine
  changes. If your environment only allows pushing to `claude/...` branches,
  push there and open a pull request into `main` instead.
- **Start from the latest `main`.** A SessionStart hook runs
  `git pull --ff-only`; if it reports it couldn't fast-forward, pull or merge
  before making changes.
- **Commit and push to `main` when a change is done**, so the other side sees it.
- **Don't run desktop and mobile sessions on the same files at the same time.**
  Finish and push on one side before starting on the other.
