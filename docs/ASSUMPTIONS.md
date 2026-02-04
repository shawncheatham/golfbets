# Assumptions (ranked)

Update this file continuously. Rank by risk: if this is wrong, we waste the most time.

## Stage
**2 (Prototype)** | 3 (Pilot) | 4 (Production-ish)

## Success metric (for the next test)
- Metric: **Referee-less completion rate** (rounds completed + settlement shared with no manual reconciliation)
- Target: **≥ 70%** for a small pilot group (TBD sample size)
- By when: **Next on-course test session**

## Kill criteria
We stop or pivot if we observe:
- Users consistently prefer their current workaround (Venmo notes + group chat + memory) and won’t switch after 2–3 uses.
- Data entry overhead remains too high on-course (users abandon mid-round).
- Settlement output is not trusted (frequent corrections/disputes).

---

## Assumptions backlog

### Problem
1. Golf side games create **avoidable friction**: math, disputes, and one person acting as referee.
2. On-course conditions (sun, motion, time pressure) make “heavy UI” fail.

### User / ICP
1. Small groups (2–4 players) playing casual rounds with side games; one person typically runs the math.
2. The coordination layer is **group chat**; the product must fit that reality.

### Value / Willingness
1. Users value **trust + speed** more than flexibility (fewer options, clearer output).
2. “Share settlement” is a primary value driver (reduces post-round hassle).

### Workflow / UX
1. The winning pattern is: **setup fast → enter fast (quick mode) → see story → lock → share**.
2. Output formatting must be paste-ready and stable; regressions here erode trust quickly.
3. Accessibility matters (high contrast, strong focus states; don’t rely on color alone).

### Feasibility
1. We can keep adding games only when they match the interaction model (Skins archetype; Wolf parity only where it fits).
2. The app can stay simple while supporting the minimum viable constraints:
   - Skins: quick + grid parity, carry behavior, per-hole results
   - Wolf (v1): 4 players, pairing per hole, lone wolf confirmation, optional $/pt

### Distribution
1. Sharing links/text into group chat is the “growth loop” (someone in the group becomes the next user).
2. Vercel-hosted PWA is a sufficient distribution channel for early pilot (no app store yet).

---

## Next tests (1–3)

1) Hypothesis: Groups can complete Skins end-to-end without a referee.
- Test: Run a real round with 1–2 groups; require using **Share status** mid-round + **Share settlement** at end.
- Expected signal: ≥70% completion without manual correction.
- If true: Hardening (golden outputs + regressions) and move toward Stage 3 pilot.
- If false: Identify the single biggest friction point and redesign that step.

2) Hypothesis: Settlement formatting is trusted when it is compact + consistent.
- Test: Show two settlement formats (current vs alternate) to users; ask which they’d paste to a group.
- Expected signal: Clear preference + fewer questions.
- If true: Freeze formatting + add fixtures/golden tests.
- If false: Iterate format and add explanatory lines only where necessary.

3) Hypothesis: Wolf can coexist without increasing cognitive load.
- Test: Have a group play Wolf v1 with constraints; measure confusion points.
- Expected signal: Users understand pairing + lone wolf behavior without coaching.
- If true: Keep Wolf in the picker and harden parity.
- If false: Gate Wolf behind “advanced” or tighten the flow.
