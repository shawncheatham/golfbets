# Definition of Done (evolves by stage)

Before building a slice, fill this out.

---

## BBB v1 — Award-entry (Epic Definition of Done)

## Goal
Ship Bingo Bango Bongo (BBB) as a third game that fits GolfBets’ interaction model:
**setup fast → enter fast → standings/story → share**.

## Non-goals
- Stroke entry (BBB is award-entry only)
- Tie-handling logic for awards (v1 uses **None** when unclear)
- Net/gross variants or handicaps

## Happy-path acceptance
- Users can set up BBB with 2–4 players and start a round.
- In Quick mode, for each hole:
  - user can pick Bingo/Bango/Bongo winners (or None)
  - points update immediately
  - hole story clearly states who earned points
- Users can share a paste-ready status summary to group chat.
- If $/point is set, users can generate a settlement suggestion.

## Edge cases
- Awards left unassigned (None) should not break scoring.
- Changing an award winner updates points deterministically.
- Locked round prevents edits.

## Instrumentation
- Event(s):
  - bbb_round_started
  - bbb_award_set (awardType, hole, playerId|null)
  - bbb_share_status
  - bbb_share_settlement (if money enabled)
- Logs/metrics: basic error logging for clipboard + state persistence.

## Rollback plan
- Feature-flag BBB in the game picker (or keep as “Beta” until validated).

---

## Slice template (copy/paste for other work)

### Slice name

### Goal

### Non-goals

### Happy-path acceptance
- 
- 

### Edge cases
- 
- 

### Instrumentation
- Event(s):
- Logs/metrics:

### Rollback plan
- 
