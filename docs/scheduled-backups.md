# Scheduled Backups

Use this command for scheduled database backup jobs:

```bash
npm run backup
```

Run the command from the ImpactMIS project directory.

## Windows Task Scheduler

Example action:

```text
Program/script: cmd.exe
Arguments: /c cd /d C:\path\to\ImpactMIS && npm run backup
```

Schedule daily during low-traffic hours.

## Linux Cron

Example daily 2:15 AM job:

```cron
15 2 * * * cd /var/www/impactmis && /usr/bin/npm run backup >> storage/logs/backup-cron.log 2>&1
```

## cPanel Cron

Example:

```bash
cd /home/USERNAME/impactmis && npm run backup >> storage/logs/backup-cron.log 2>&1
```

If `npm` is not available in cron, use the full Node/npm path shown by your cPanel terminal.

## Retention

`npm run backup` automatically calls cleanup based on `BACKUP_RETENTION_DAYS`.

To clean up without creating a new backup:

```bash
npm run backup:cleanup
```
