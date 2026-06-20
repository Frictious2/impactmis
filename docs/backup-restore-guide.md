# ImpactMIS Backup and Restore Guide

## Create a Backup from the UI

1. Log in as a Developer / Super Admin.
2. Open Developer Dashboard > Backups.
3. Click **Create Backup**.
4. Download the generated `impactmis-db-YYYYMMDD-HHmmss.sql` file.

## Create a Backup from the Command Line

Run:

```bash
npm run backup
```

This creates a MySQL dump in `BACKUP_DIR` and removes backups older than `BACKUP_RETENTION_DAYS`.

## Restore the Database

Restores should be done carefully, preferably while the app is offline or in maintenance mode.

```bash
mysql -h DB_HOST -P DB_PORT -u DB_USER -p DB_NAME < impactmis-db-YYYYMMDD-HHmmss.sql
```

Do not run a restore into a live production database without a rollback plan.

## Restore Uploaded Files

Restore the uploaded file backup to:

```text
public/uploads/
```

Preserve the tenant-specific directory structure.

## Suggested Backup Schedule

- Database: daily.
- Uploads folder: daily or after high-volume upload periods.
- Retention: at least 14 days locally plus off-server archival copies.

## Disaster Recovery Steps

1. Put the app in maintenance mode.
2. Stop the Node process.
3. Restore the MySQL backup.
4. Restore `public/uploads`.
5. Run `npm run migrate`.
6. Run `npm run qa:smoke`.
7. Start the app.
8. Verify login, tenant dashboards, and key reports.
9. Disable maintenance mode.

## Important Warnings

- UI restore is intentionally not implemented in this phase.
- Never store database passwords in logs.
- Keep backup files outside public web roots when possible.
- Encrypt off-server backups if they contain sensitive NGO/CBO data.
