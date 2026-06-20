# ImpactMIS Developer Maintenance Guide

## Common Commands

```bash
npm install
npm run migrate
npm run seed
npm run dev
npm run qa:smoke
npm run qa:ejs
npm run qa:routes
```

Use `BASE_URL=https://yourdomain.com npm run qa:routes` or PowerShell equivalent to enable live HTTP checks.

## License Module Audits

```bash
npm run audit:license-modules
npm run audit:license-modules:fix
```

The expected module keys are documented in `docs/module-list.md`.

## Backups

```bash
npm run backup
npm run backup:cleanup
```

Developer UI backup tools are available at `/developer/backups`. Restore remains manual and should be performed offline or during maintenance mode.

## Diagnostics

- `/health` is public and safe.
- `/diagnostics` is Developer-only and must not expose secrets.

## Coding Notes

- Keep tenant-owned queries scoped by `tenant_id`.
- Keep donor routes read-only and donor-safe.
- Keep finance, expenses, budgets, and accounting under module key `finance`.
- Keep LogFrames and indicators under `projects`; activity reports, surveys, and reporting center under `reports`.
- Do not add new module keys without updating license forms, sidebar logic, module audit scripts, and docs.
