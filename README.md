# Visitor IP Log

A tiny Node.js site. Visiting `/` records the visitor's IP; `/admin` (password protected) lists them.

## Run

```bash
npm install
ADMIN_PASSWORD='choose-a-long-password' npm start
```

- Public page: http://localhost:3000/
- Admin page: http://localhost:3000/admin (user `admin`, password = `ADMIN_PASSWORD`)

## Options (environment variables)

| Variable | Default | Purpose |
|---|---|---|
| `ADMIN_PASSWORD` | required | Admin password |
| `ADMIN_USER` | `admin` | Admin username |
| `PORT` | `3000` | Port |
| `RETENTION_DAYS` | `30` | Visits older than this are deleted automatically |
| `TRUST_PROXY` | unset | Set to `1` when behind Nginx/Cloudflare/etc. so the real client IP is read from `X-Forwarded-For` |

## Deploying

- Serve it over **HTTPS** (e.g. behind Nginx/Caddy or a host that provides TLS). The admin login uses HTTP Basic auth, which is not safe over plain HTTP.
- Behind a proxy or CDN, set `TRUST_PROXY=1`, otherwise you'll log the proxy's IP. Don't set it when the app is exposed directly, since visitors could then fake their IP.

## Privacy

IP addresses are personal data under laws like the GDPR and Australia's Privacy Act. The public page includes a notice; keep it, and keep the retention period as short as you need. Data is stored in `visits.json`.
