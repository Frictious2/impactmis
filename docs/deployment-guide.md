# ImpactMIS Deployment Guide

## Windows VPS

1. Install Node.js LTS and MySQL.
2. Clone or upload the ImpactMIS project.
3. Run `npm ci` or `npm install`.
4. Configure production environment variables from `.env.example`.
5. Run `npm run migrate`.
6. Run `npm run seed` for first deployment if the developer admin is not seeded.
7. Ensure these directories are writable:
   - `storage/backups`
   - `storage/logs`
   - `storage/tmp`
   - `public/uploads`
8. Use PM2 for Windows or NSSM to run `node app.js` as a service.
9. Use IIS reverse proxy, Nginx for Windows, or another reverse proxy with HTTPS.
10. Schedule `npm run backup` with Windows Task Scheduler.

## cPanel Node.js App

1. Upload the project files.
2. Install dependencies from cPanel terminal or the Node.js app interface.
3. Set environment variables in the cPanel Node.js app settings.
4. Run `npm run migrate`.
5. Run `npm run seed` for first deployment if needed.
6. Ensure `public/uploads` and `storage/*` are writable.
7. Restart the Node.js app.
8. Use cPanel Cron Jobs for scheduled backups if terminal access supports `npm run backup`.

Limitations:
- Some shared cPanel environments may not provide `mysqldump`.
- If `mysqldump` is unavailable, use cPanel database backup tools and still back up `public/uploads`.

## Linux VPS

1. Install Node.js LTS, MySQL, and Nginx.
2. Clone the project and run `npm ci`.
3. Configure `.env`.
4. Run `npm run migrate`.
5. Run `npm run seed` for first deployment if needed.
6. Start with PM2:

```bash
pm2 start app.js --name impactmis
pm2 save
```

7. Configure Nginx reverse proxy to the app port.
8. Install SSL with Certbot.
9. Ensure runtime directories are writable by the app user.
10. Add a cron job for `npm run backup`.

## Common Production Checks

- Set `APP_ENV=production`.
- Set `TRUST_PROXY=true` when behind Nginx, IIS, Apache, or cPanel proxying.
- Set a strong `SESSION_SECRET`.
- Keep `.env` out of source control.
- Run `npm run qa:smoke` after deployment.
- Confirm `/health` responds.
- Confirm Developer can access `/diagnostics` and `/developer/backups`.
