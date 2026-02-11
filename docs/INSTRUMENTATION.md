# Instrumentation

GolfBets uses local-first event tracking in `app/src/logic/track.ts`.

## Stage metric
- Primary metric: round completion rate.
- Definition: `% of rounds started that reach lock or settlement view`.
- Data source: local tracked events export (`debug_export`) from client devices.

## Core event map (current)

### Activation
- Name: `round_new`
- Trigger: user selects a game type from Game screen.
- Properties: `game`.

### Core action
- Name: `round_start`
- Trigger: user starts round from Setup.
- Properties: `game`, `playerCount`.

### Progress and completion
- Name: `nav_screen`
- Trigger: user moves between major screens.
- Properties: `from`, `to`, optional `resume`, optional `game`.

- Name: `round_lock`
- Trigger: user locks round.
- Properties: `game`, `screen`, `andGoToSettlement`.

- Name: `round_unlock`
- Trigger: user unlocks round.
- Properties: `game`, `screen`.

### Share behavior
- Name: `share_status`
- Trigger: user copies status summary.
- Properties: `game`.

- Name: `share_settlement`
- Trigger: user copies settlement summary.
- Properties: `game`, optional `centsPerPoint`.

### BBB-specific
- Name: `bbb_award_set`
- Trigger: award winner set for hole.
- Properties: `hole`, `award`, `winnerId`.

- Name: `bbb_hole_clear`
- Trigger: all BBB awards cleared for hole.
- Properties: `hole`.

### Diagnostics
- Name: `debug_export`
- Trigger: user copies local event export JSON.
- Properties: `eventCount`.

## Logging and retention
- Storage key: `rubislabs:golf-bets:track:v1`.
- Max retained events: `500` (oldest events dropped beyond cap).
- Export payload includes:
  - schema version `v`
  - `exportedAt`
  - `userAgent`
  - `href`
  - `events[]`

## Traceability model
- Events are local and anonymous by default.
- Use exported JSON plus timestamp ordering (`ts`) to reconstruct session flow.
- No server-side identity is required for Stage 2.

## PR-level instrumentation checks
- New behavior should emit an existing event when possible.
- New event names must be added to `TRACK_EVENTS` constant map.
- Event names must be stable strings (no dynamic interpolation).
- Any event schema change must be called out in PR body.

## Alerts (pilot+)
- No paging alerts at Stage 2.
- Daily review candidate:
  - `% rounds started vs locked`
  - `% rounds with share action`
  - average screens navigated per round
