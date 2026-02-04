# Decision Log

Keep this short. The goal is to preserve why we chose what we chose.

---

## Decisions

### 2026-02-03 — Define the product job + mantra
- Context: Early GolfBets prototype iteration risked becoming “a calculator with extra steps.”
- Options considered:
  - Build broad support for many games quickly
  - Focus on one game flow and make it frictionless
- Decision:
  - Job: **On-course side games, frictionless: set up fast, enter fast, settle fast.**
  - Mantra: **Less math, fewer arguments.**
- Why: This frames every UX choice as reducing disputes + reducing effort.
- Risks: Over-optimizing for one archetype could limit game expansion.
- Follow-ups: Expand only to games that share the same interaction model.

### 2026-02-03 — Skins first; Wolf only insofar as it matches the model
- Context: Need a clear “archetype” game for fast iteration.
- Options considered: start with Wolf vs start with Skins.
- Decision: **Skins is the initial vehicle**; add Wolf with parity where it fits.
- Why: Skins maps cleanly to quick entry + per-hole story + simple settlement.
- Risks: Wolf complexity can leak into the overall UX.
- Follow-ups: Keep Wolf constraints explicit; avoid feature creep.

### 2026-02-03 — Sharing is a core feature (remove the referee)
- Context: Human arbitration drives friction (“who owes what?”).
- Decision:
  - Add **Share status** (group-chat-friendly)
  - Add **Share settlement** (paste-ready)
- Why: Group chat is the coordination layer on-course; make the app a neutral recorder.
- Risks: Formatting regressions create trust issues.
- Follow-ups: Add fixtures/golden outputs for share text.

### 2026-02-03 — UI signal hygiene: remove noisy progress pill
- Context: Header progress (e.g. “$5/skin • Through X/18”) was redundant on mobile and the game picker.
- Decision: Remove the pill.
- Why: Reduce cognitive load; keep UI focused on the next action.
- Risks: Users may miss round context.
- Follow-ups: Ensure round context is available where it matters (round screens).

### 2026-02-03 — Accessibility direction
- Context: Important to be ADA-conscious; Shawn is colorblind.
- Decision: Prioritize **high contrast** + **focus outlines**; avoid relying on color alone.
- Why: Accessibility improves usability for everyone on-course.
- Risks: None meaningful; minor design constraints.
- Follow-ups: Continue to validate contrast + keyboard focus.

### 2026-02-03 — Source of truth for deployment
- Context: Deployment confusion due to edits happening outside the Vercel-connected repo.
- Decision: Treat `~/clawd/golfbets` (GitHub `shawncheatham/golfbets`) as source of truth.
- Why: Prevent “it works locally but didn’t deploy” churn.
- Risks: Parallel directories diverge.
- Follow-ups: If alternate repos exist, make them read-only or clearly labeled.
