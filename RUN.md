# Run — Golfbets (web)

## Prereqs

- Node + npm installed

## Clone

```bash
git clone https://github.com/shawncheatham/golfbets.git
cd golfbets/app
npm install
```

## Run (dev)

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open:
- http://127.0.0.1:5173/

Stop:
- press `Ctrl+C` in the terminal running Vite

## Build (production)

```bash
npm run build
```

Output:
- `app/dist/`

## Quick sanity test

1) Enter a few hole scores
2) Refresh the page
3) Confirm the round persists and appears under **Recent rounds**

## Notes

- If you keep your projects under `~/RubisLabs/`, you can clone there; the repo does not require a specific parent directory.
- When started via automation tools, the dev server may get killed (SIGKILL). Running it in your own terminal is the most reliable way.
