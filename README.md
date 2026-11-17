# Earlyma

Earlyma is a small React + Vite app for community health workers to track pregnant mothers and babies, review upcoming clinic visits, and simulate reminders or missed-visit follow-up calls.

## Features

- Switch between Baby and Pregnant mother modes
- Enter a baby date of birth or expected delivery date
- Choose Swahili or English messaging
- View visit dates with status labels:
  - Date passed
  - Due soon
  - Upcoming
- Select a client and simulate a reminder or missed-visit call
- Use browser text-to-speech to play the message aloud
- Press 1 or select No answer to add demo call log entries
- Manage client records in a simple multi-page app

## Project structure

- `App.jsx` — app routes and page layout
- `logic.js` — date and visit schedule logic
- `data.js` — visit rules and message templates
- `main.jsx` — app entry point with router setup
- `index.html` — Vite HTML shell
- `vite.config.js` — Vite configuration

## Run locally

1. Open a terminal in the project folder.
2. Install dependencies:

```bash
npm install
```

3. Start the dev server:

```bash
npm run dev -- --host 0.0.0.0
```

4. Open the local URL shown in the terminal, usually:

```text
http://localhost:5173/
```

## Production build

```bash
npm run build
```

## Notes

This is a demo/prototype app. It stores data in browser local storage and uses browser text-to-speech for the simulated call playback. It does not send real SMS or place real phone calls.

## Tech stack

- React
- Vite
- Mantine UI
- React Router
- Vitest for unit tests
- vite-plugin-pwa for installable/offline support

## Testing

Run the unit tests with:

```bash
npm test
```

## SMS delivery strategy

Earlyma now uses a queued notification layer (`notifications.js`) instead of pretending SMS is sent directly.

- Each reminder becomes a persisted queue entry with status, attempts, error details, and retry time
- The default provider is a mock provider for demos
- Set `VITE_SMS_API_URL` to switch the queue to an HTTP provider
- Failed delivery attempts stay queued and retry with exponential backoff until the attempt limit is reached
- Keep SMS credentials on a backend or secure proxy; do not expose provider keys in browser code
- Delivery receipts and inbound replies such as `press 1` should be handled by webhook endpoints on that backend

## Authentication: local demo vs secure server

The app ships with a clearly-labelled **local demo** authentication so it can run
offline with no backend. Passwords are hashed with PBKDF2 in the browser and
accounts are stored in browser storage. **This is not a production security
boundary.**

For real deployments, run the included secure server and point the app at it:

```bash
# 1. Configure the server (never expose these to the browser)
cp .env.example .env
# set AUTH_SECRET to a long random value

# 2. Start the auth server (scrypt hashing, HMAC-signed HttpOnly session cookie)
npm run server

# 3. Point the app at the server and use it instead of local auth
#    VITE_AUTH_API_URL=http://localhost:3001
```

With `VITE_AUTH_API_URL` set:

- Credentials are verified server-side; the browser only mirrors the returned profile.
- Passwords are hashed with scrypt and sessions use an HttpOnly, SameSite cookie.
- Accounts are active immediately: the first account becomes the administrator,
  later accounts are community health workers. Approval is not required.
- Password recovery is verified server-side from the registered email + phone.
- Duplicate email/phone accounts are rejected on the server.

Set `AUTH_ALLOWED_ORIGIN` to the exact app origin (for example
`https://earlyma.example.org`). A wildcard cannot be combined with the session
cookie, so leave it unset only for same-origin deployments.

Each CHW receives a unique registration ID (`CHW-0001`, `CHW-0002`, …). The server
keeps credentials and sessions; the browser stores only the profile and clinical
data it needs to work offline.

> Always put the server behind HTTPS and set `AUTH_COOKIE_SECURE=true` in
> production. Client-side checks are a convenience, not authorization.

## Automated tests

```bash
# Unit / integration tests (Vitest + jsdom)
npm test

# End-to-end tests against the production build (Playwright)
npm run test:e2e          # local demo auth
npm run test:e2e:remote   # remote server auth (starts server + preview)
npm run test:e2e:single   # single-process production server (dist + API)
npm run test:e2e:all      # all three suites
```

First-time E2E setup installs a browser:

```bash
npx playwright install chromium
```

The local suite (`e2e/local`) covers registration, login/logout, wrong-password
handling, password recovery, duplicate prevention, worker and mother creation,
navigation, en/sw switching, and no-horizontal-scroll at 320/375/430px. The remote
suite (`e2e/remote`) boots `server/index.mjs` with a temporary data directory and
verifies the HttpOnly session cookie, login/logout, and server-side duplicate
rejection. The single suite (`e2e/single`) serves the built `dist/` from the Node
server and verifies same-origin remote auth. All run against the real production
build.

## Deployment (single process)

`server/index.mjs` serves the built frontend (`dist/`) **and** the `/api` routes
from one origin. It injects a `earlyma-auth-api` meta tag into `index.html`, so
the app automatically uses server-backed auth without any CORS or extra static
hosting. Persistent data lives in `AUTH_DATA_DIR` (default `/var/data`).

Docker:

```bash
docker build -t earlyma .
docker run -p 3000:3001 \
  -e AUTH_SECRET="$(openssl rand -hex 32)" \
  -e AUTH_COOKIE_SECURE=true \
  -v earlyma-data:/var/data \
  earlyma
```

Render: this repo includes `render.yaml` (Node web service + 1 GB disk). In the
Render dashboard choose **New → Blueprint**, pick this repository, and deploy.
Disks require a paid instance; without one, omit the disk and the credential
store resets on redeploy.

Any Node host / VPS:

```bash
npm ci && npm run build
AUTH_SECRET="<long-random>" \
AUTH_DATA_DIR="/var/lib/earlyma" \
AUTH_COOKIE_SECURE=true \
PORT=3001 \
node server/index.mjs
```

Required server environment variables:

| Variable | Purpose |
| --- | --- |
| `AUTH_SECRET` | HMAC key for session cookies. Set a long random value in production. |
| `AUTH_DATA_DIR` | Persistent directory for `db.json` and the generated secret. |
| `AUTH_COOKIE_SECURE` | `true` behind HTTPS so the cookie is only sent over TLS. |
| `PORT` | Port to listen on (default `3001`). |
| `AUTH_ALLOWED_ORIGIN` | Only needed when the API is hosted on a different origin than the app. |

The first registered account becomes the administrator. Accounts are active
immediately; there is no approval step.

## Deploy to Vercel

The repo includes `api/*` serverless functions that reuse `server/index.mjs`, plus
`vercel.json` for the Vite SPA. Import the repository in Vercel or run:

```bash
vercel --prod --yes --name earlyma
```

Set these project environment variables:

| Variable | Value |
| --- | --- |
| `AUTH_SECRET` | Long random string (secret). |
| `AUTH_COOKIE_SECURE` | `true` (Vercel is HTTPS). |
| `AUTH_DATA_DIR` | `/tmp` (the only writable path on Vercel). |
| `VITE_AUTH_API_URL` | `https://<your-app>.vercel.app` (build-time). |

`VITE_AUTH_API_URL` is required because Vercel serves the built `index.html`
directly, so the server's meta-tag injection is bypassed. Pointing it at the
production origin makes the client call the same-origin `/api` functions.

> **Storage warning:** Vercel has no persistent disk. Credentials live in `/tmp`
> and reset when an instance is recycled, and different instances can have
> different account data. This is fine for a demo but **not** for durable
> accounts. For production, move the credential store to a persistent database
> (Vercel Postgres, Upstash Redis, MongoDB Atlas, …).
