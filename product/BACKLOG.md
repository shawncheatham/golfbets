# Backlog

## Now (UI polish)
- [ ] Chakra migration: Setup + Quick mode controls + subtle transitions

## Next (BBB — Bingo Bango Bongo, award-entry)

### Epic: Add BBB game (award-entry)
- [ ] Rules contract (v1): Bingo/Bango/Bongo winners or None; no ties in v1
- [ ] Data model: store per-hole award winners (bingo/bango/bongo -> playerId|null)
- [ ] Compute points by player + through-hole progress
- [ ] Game picker: add BBB card/button (Beta tag optional)
- [ ] Setup: players 2–4 + optional $/point
- [ ] Quick mode:
  - [ ] 3 award pickers (Bingo/Bango/Bongo) with None option
  - [ ] Hole story summary (who got what; +points)
  - [ ] Clear hole awards
  - [ ] Next / current / next incomplete navigation
- [ ] Grid mode:
  - [ ] Table with Bingo/Bango/Bongo columns; cells show initials or —
- [ ] Share:
  - [ ] Share status (leaderboard points)
  - [ ] If $/pt set: share settlement (suggested payments)
- [ ] Accessibility: focus rings, tap targets, not color-only
- [ ] Add fixtures for share output (prototype/fixtures)

## Later
- [ ] BBB tie-handling (if users demand it)
- [ ] BBB rules variants (gross vs net, etc.)

## Parking lot
- [ ] More games (only if they match the interaction model)
