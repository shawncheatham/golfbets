# GolfBets App

Frontend app for GolfBets (`React + TypeScript + Vite + Chakra UI`).

## Setup

From repo root:

```bash
cd app
npm install
```

## Local development

```bash
npm run dev -- --host 127.0.0.1 --port 5173
```

Open: `http://127.0.0.1:5173`

## Required quality checks

Run these before every PR:

```bash
npm run -s lint
npm run -s build
```

## Build artifact baseline (2026-02-11)

Command:

```bash
npm run -s build
```

Baseline JS gzip totals:
- `react`: `3.36 kB`
- `vendor`: `14.09 kB`
- `index`: `17.15 kB`
- `react-dom`: `56.20 kB`
- `ui`: `81.11 kB`
- Total initial JS gzip baseline: `171.91 kB`

PR-6 budget guardrail:
- Max allowed initial JS gzip: `180.51 kB` (`+5%`).

## Manual parity smoke (every PR)

- Skins:
  - Create round, enter scores for holes 1-3 in Quick mode, lock/unlock, share status and settlement.
- Wolf:
  - Create 4-player round, test partner and lone holes, verify standings/settlement share.
- BBB:
  - Assign Bingo/Bango/Bongo winners for holes 1-3, verify standings and optional settlement share.

Record explicit `PASS/FAIL` for each flow in PR body.

## Scope protections for PR train

- Do not change storage keys under `rubislabs:golf-bets:*`.
- Do not change `Round` schema in `src/types.ts`.
- Do not edit:
  - `../product/BACKLOG.md`
  - `./test-results/**`
