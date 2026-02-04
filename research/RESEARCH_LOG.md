# Research Log

This is the running log of discovery + pilot learnings.

---

## Current research focus (Prototype → Pilot)

**Primary question:** Can a group complete a round + settlement with **no referee**?

**Primary metric:** Referee-less completion rate (see `docs/ASSUMPTIONS.md`).

---

## Pilot script (use this for on-course tests)

### Setup (5 min)
- Confirm game: **Skins** (start here; Wolf is secondary)
- Confirm device context:
  - Primary device (phone)
  - Secondary device (optional)
- Confirm comms context:
  - Group chat used (yes/no)

### Tasks (do not coach unless they are stuck)

**Task 1 — Create round (setup fast)**
- Create a new Skins round
- Add players
- Set stake

**Task 2 — Enter scores (enter fast)**
- Enter holes 1–3 using Quick mode
- Ask them to describe aloud what they think is happening (carry, winner, $ value)

**Task 3 — Share status (group chat reality)**
- Use **Share status** and paste it into the group chat
- Observe: does anyone ask questions or challenge the output?

**Task 4 — Finish + lock + settle (settle fast)**
- Jump forward: enter 2 more holes quickly (or finish round if time allows)
- Complete round
- **Lock** and **Share settlement** into the group chat

### Prompts (ask after each task)
- “What felt slow or annoying?”
- “What part would cause an argument?”
- “If this didn’t exist, what would you do instead?”
- “Would you use this again next round? Why/why not?”

### Observations to record (checklist)
- Time to create round (rough)
- # of moments they asked for help
- Any misunderstanding of:
  - carry
  - winner/tie
  - $ value
  - settlement wording
- Any corrections requested by others in the group chat
- UI friction points (taps, scrolling, clarity)

### Exit questions (2 min)
- “Would you pay for this? If yes, how would you expect it to be priced?”
- “What’s the one feature that would make this a ‘must have’?”

---

## Interviews / sessions

### 2026-02-03 — Internal build review (Shawn)
- Link/notes: `~/.openclaw/workspace/memory/2026-02-03.md`
- Top pains targeted:
  - Reduce math / disputes (“Less math, fewer arguments.”)
  - Reduce referee burden via shareable status + settlement
- Current workaround: group chat + manual math + Venmo
- Signals:
  - Strong: quick mode score chips; hole story; share settlement
  - Watch: Wolf complexity
- Follow-ups:
  - Run real on-course pilot with the script above

---

## Artifacts
- Pilot script: (this file)
- Share output fixtures: `prototype/fixtures/` (to be populated)
