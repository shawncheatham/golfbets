# Run — Golf Bets (web)

## Location

- App: `RubisLabs/products/golf-bets/app`
- Specs: `RubisLabs/products/golf-bets/spec`

## Prereqs

- Node + npm installed

## First-time setup

```bash
cd ~/clawd/RubisLabs/products/golf-bets/app
npm install
```

## Run (dev)

```bash
cd ~/clawd/RubisLabs/products/golf-bets/app
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:
- http://127.0.0.1:5173/

Stop:
- press `Ctrl+C` in the terminal running Vite

## Build (production)

```bash
cd ~/clawd/RubisLabs/products/golf-bets/app
npm run build
```

Output:
- `RubisLabs/products/golf-bets/app/dist/`

## Quick sanity test

1) Enter a few hole scores
2) Refresh the page
3) Confirm the round persists and appears under **Recent rounds**

## Notes

- When started via automation tools, the dev server may get killed (SIGKILL). Running it in your own terminal is the most reliable way.
