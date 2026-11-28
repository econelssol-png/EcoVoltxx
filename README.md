# EcoVoltX

EV charging for housing societies, by EcoNelssol. Residents find a free charger in their society's parking, start and stop from their phone, and pay one monthly invoice. Society admins run chargers, approvals, tariffs and billing. Visitors can charge without an account.

One Node server serves everything:

| Path | What |
| --- | --- |
| `/` | Landing page |
| `/app/` | Resident app (React, mobile first) |
| `/app/public` | Visitor charging, no account |
| `/admin/` | Admin portal for society admins and super admins |
| `/api/` | REST API, `/api/health` for health checks |
| `/ocpp/<charger-id>` | OCPP 1.6-J WebSocket for real chargers |

```
server/           Express API, Socket.IO, OCPP server, SQLite (knex)
resident-app/     Vite + React resident app
admin-dashboard/  Vite + React admin portal
```

## Run it locally

Needs Node 20 or newer.

```bash
npm install
cp server/.env.example server/.env   # then fill in the two JWT secrets
npm run build
npm start
```

Open http://localhost:3000. A fresh database is created, migrated and filled with demo data on first start.

For live reload while editing, run `npm run dev` instead: the resident app is on http://localhost:5173/app/ and the admin portal on http://localhost:5174/admin/.

### Demo mode

`DEMO_MODE` is on by default locally and off by default in production.

- **On:** two sample societies, residents and chargers, all with the password `password123`. The demo logins are shown on the landing, resident and admin sign-in pages, and the charger simulator runs.
- **Off:** no demo data. A fresh database gets one super admin from `SUPERADMIN_EMAIL` and `SUPERADMIN_PASSWORD`, who then creates the societies in the admin portal.

Demo accounts: `superadmin@societycharge.com`, `admin_gvr@test.com`, `admin_srt@test.com`, `rahul@test.com`.

## Configuration

Set these as environment variables on the host, or in `server/.env` locally. `server/.env.example` lists them all.

| Variable | Required | Notes |
| --- | --- | --- |
| `NODE_ENV` | yes | `production` on a host |
| `JWT_SECRET` | yes | At least 32 random characters. The server refuses to start in production without it |
| `JWT_REFRESH_SECRET` | yes | Same rules, and different from `JWT_SECRET` |
| `SUPERADMIN_EMAIL` | first start | First super admin on a fresh database when demo mode is off |
| `SUPERADMIN_PASSWORD` | first start | At least 12 characters |
| `DEMO_MODE` | no | `true` for a public demo with sample data |
| `PORT` | no | Most hosts set this for you; defaults to 3000 |
| `DB_PATH` | no | SQLite file; keep it on a persistent volume |
| `CORS_ORIGIN` | no | Your public address, like `https://ecovoltx.example.com` |
| `CHARGER_SIMULATOR` | no | Simulated charging sessions; follows `DEMO_MODE` |
| `API_RATE_LIMIT` | no | API requests per client address per 15 minutes; defaults to 1000. Sign-in stays limited to 30 attempts |
| `PAYMENT_MODE` | no | `test` or `live`. Must match the key (`rzp_test_` or `rzp_live_`), or online payment stays off; left empty, the key decides. Without Razorpay keys, online payment is off and bills stay due; the `mock` demo provider works only while `DEMO_MODE` is on |
| `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` | for payments | Razorpay API keys |
| `RAZORPAY_WEBHOOK_SECRET` | for payments | Webhooks are refused until this is set |

Generate a secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## Deploy

The database is a SQLite file, so the host must keep `server/data` between restarts. Without a persistent disk every restart starts from an empty database.

### Railway (recommended)

The repo already has a `Dockerfile` and `railway.json`.

1. Push this repository to GitHub.
2. In Railway, create a project from the GitHub repository. It builds with the `Dockerfile`.
3. Add a volume to the service, mounted at `/app/server/data`.
4. Set the variables: `NODE_ENV=production`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `SUPERADMIN_EMAIL`, `SUPERADMIN_PASSWORD`. Leave `DEMO_MODE` unset for a real deployment.
5. Under Networking, generate a domain, or add your own, then set `CORS_ORIGIN` to that address.
6. Deploy. Railway checks `/api/health`. Sign in at `https://<your-domain>/admin/` as the super admin and add your first society.

### Docker on your own server

```bash
cp server/.env.example .env   # fill in the secrets and super admin
docker compose up -d --build
```

`docker-compose.yml` reads the secrets from `.env` and keeps the database in the `ecovoltx_data` volume. Put a reverse proxy with HTTPS (Caddy or nginx) in front of port 3000.

### Render

`render.yaml` works, but Render's free plan has no persistent disk, so the database is wiped on every deploy and restart. Use a paid plan with a disk mounted at `/app/server/data` for real use.

## After deploying

- **Payments:** add Razorpay test keys and set `PAYMENT_MODE=test`. In the Razorpay dashboard, point a webhook at `https://<your-domain>/api/payments/webhook` with the same secret as `RAZORPAY_WEBHOOK_SECRET`. Make one test payment and one refund, then switch to live keys and `PAYMENT_MODE=live`.
- **Real chargers:** in the admin portal, open Hardware (OCPP) and set the server address to `wss://<your-domain>/ocpp`. Each charger connects to `wss://<your-domain>/ocpp/<charger-number>` with its auth key, as `?token=<key>` or as the HTTP Basic auth password. New chargers are hardware chargers unless demo mode is on.

## Tests

With the server running on a fresh demo database:

```bash
node server/test_e2e_payments_ocpp.js
```

It covers payments, refunds, the payment and webhook security rules, charger auth keys and an OCPP charging session.

## Known limitations

- Visitors pay the amount due offline; online payment is only for residents.
- Razorpay has been tested end to end in test mode (payment and webhook). Live refunds have not been tried yet.
- `package-lock.json` files are not committed, so hosts install the newest versions allowed by `package.json`.

## Credits

Interface design pass based on [unslop](https://github.com/heydamir/unslop) by Damir Sokolovsky ([@heydamir](https://x.com/heydamir)), CC BY 4.0.
