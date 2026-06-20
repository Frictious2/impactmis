# Phase 16 Worktree Release Summary

This worktree contains accumulated release-candidate changes from multiple late phases.

## Commit Together

Recommended single release-candidate commit group:

- Phase 13 production readiness: backups, diagnostics, maintenance mode, runtime storage, deployment/backup docs.
- Phase 14 accounting foundation: chart of accounts, journals, bank accounts, bank transactions, statements, accounting navigation.
- Phase 15 advanced M&E: LogFrames, indicator measurements, surveys, donor M&E summaries, M&E reports.
- Phase 16 QA/release prep: route smoke checks, EJS compile checks, documentation refresh, release checklist.

These changes are related because they represent the current v1 release candidate surface and their docs/scripts reference each other.

## Do Not Remove

- Migrations `040` through `052`.
- New repos, services, controllers, views, middleware, docs, and scripts.
- Runtime directory `.gitkeep` files.

## Notes

- Existing dirty files before Phase 16 included Phase 13/14/15 modifications and untracked files.
- No obvious generated junk was removed automatically.
- `storage/*` and `public/uploads/*` should remain ignored except `.gitkeep`.
