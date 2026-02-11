# Testing

GolfBets is currently Stage 2 (Prototype), moving toward Stage 3 (Pilot).

## PR train quality gates (required every PR)
- `npm run -s lint` passes from `app/`
- `npm run -s build` passes from `app/`
- Manual parity smoke passes for Skins, Wolf, and BBB
- No intentional UX behavior or copy changes unless called out in PR

## Baseline metrics (captured 2026-02-11)
Run from `app/`:

```bash
npm run -s build
```

Baseline output (production build):
- `dist/assets/index-Dus64PJ7.css` gzip: `2.06 kB`
- `dist/assets/react-Ie-exLm1.js` gzip: `3.36 kB`
- `dist/assets/vendor-B-FxQ79v.js` gzip: `14.09 kB`
- `dist/assets/index-CghpK5Ap.js` gzip: `17.15 kB`
- `dist/assets/react-dom-2Vj6VfxD.js` gzip: `56.20 kB`
- `dist/assets/ui-BNr8K6kz.js` gzip: `81.11 kB`

Initial JS gzip baseline for budget tracking:
- `171.91 kB` (sum of JS gzip chunks above)

For PR-6 budget checks:
- Pass threshold = no more than `+5%` initial JS gzip vs `171.91 kB`
- Upper bound = `180.51 kB`

## Manual parity smoke (required every PR)

### Skins flow
1. Start a new Skins round with 2+ players.
2. Enter holes 1-3 in Quick mode.
3. Confirm carry/leader updates are coherent.
4. Lock round, then unlock round.
5. Use Share status and Share settlement.
6. Refresh page and confirm round resumes from Recent/Active.

### Wolf flow
1. Start a new Wolf round (4 players).
2. Enter scores for holes 1-3.
3. For at least one hole, set partner; for one hole, set Lone.
4. Confirm standings update after score entry.
5. If $/pt is set, confirm settlement view and Share settlement.
6. Refresh page and confirm persistence.

### BBB flow
1. Start a new BBB round.
2. In Quick mode, set Bingo/Bango/Bongo awards for holes 1-3.
3. Confirm through-hole and points leaderboard updates.
4. If $/pt is set, confirm settlement lines render.
5. Use Share status (and Share settlement when enabled).
6. Refresh page and confirm persistence.

## Smoke result logging format (copy into PR body)

```md
Manual parity smoke results
- Skins: PASS/FAIL - notes
- Wolf: PASS/FAIL - notes
- BBB: PASS/FAIL - notes
```

## UI polish checks (quick)
- Contrast works in light and dark themes.
- Focus ring is visible on interactive controls.
- Color is not the only signal for state/result.
- Tap targets remain comfortable on mobile.
- Primary action hierarchy remains clear per screen.

## Regression rule
Any user-impacting bug fixed in this repo should add a reproducible test note (manual or automated) to prevent reintroduction.
