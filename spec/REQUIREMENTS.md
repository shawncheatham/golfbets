# Requirements — Golf Bets (Skins MVP)

## Primary user story
As a golfer in a group, I want to set up a Skins game quickly, track hole-by-hole outcomes, and get a clear settlement so we can pay each other outside the app.

## MVP user stories
1) Create a round
- Enter round name/date (optional)
- Add 2–4 players (name only)

2) Configure Skins
- Stake per skin (e.g., $5)
- Carryovers on ties (on by default, required for MVP)

3) Enter hole results (18 holes)
- For each hole: enter strokes per player (integer)
- Compute low score(s):
  - single low = wins the skin (and any carry)
  - tie low = carry to next hole

4) Running totals
- Show skins won per player
- Show carry value for current hole

5) Settlement
- Compute net owed amounts based on total skins won * stake
- Net results so each player has one net amount (positive/negative)
- Provide a “who pays whom” suggested settlement list
- Copy/share summary text

## Acceptance criteria (MVP)
- Setup to first hole entry in < 60 seconds
- Hole entry usable in bright sunlight (large tap targets)
- Settlement totals reconcile with per-hole breakdown

## Non-goals
- No accounts/login
- No course database
- No payment processing
