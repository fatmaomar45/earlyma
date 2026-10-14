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
