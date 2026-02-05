# Testing (Discovery + Engineering)

This project uses the RubisLabs **Ship-Fast Testing Playbook**.

## Current stage
**2 (Prototype)** → moving toward **3 (Pilot)**

## Stage checklist

### Stage 0–1: Discovery testing
- [ ] 5–10 user conversations (problem-first)
- [ ] Task narrative: walk through the last time the problem occurred
- [ ] Fake-door or concierge test where possible
- [ ] Define success metric + kill criteria
- [ ] Record learnings in `docs/DECISIONS.md`

### Stage 2: Prototype testing (minimum bar)
- [ ] Manual smoke checklist (≤10 min)
- [ ] One golden-path automated check
- [ ] Basic error logging
- [ ] Top 3 failure modes documented + handled

### Stage 3: Pilot testing
- [ ] Regression suite for top 10 flows
- [ ] Contract tests for integrations
- [ ] Dashboards/alerts for key failures

### Stage 4: Production-ish
- [ ] CI gates: lint + unit + integration + e2e smoke
- [ ] Rollback/feature flag plan
- [ ] SLOs defined and monitored

---

## UI polish checklist (quick)
Run this anytime we change styling/components.

- [ ] Contrast: text is readable in **light + dark** (no low-contrast gray-on-gray)
- [ ] Colorblind-safe: meaning is not conveyed by color alone (icons/text patterns present)
- [ ] Focus states: keyboard focus ring is visible on buttons/inputs (Tab through)
- [ ] Tap targets: key controls are comfortably tappable on phone (no tiny chips)
- [ ] Button hierarchy: one clear primary action per screen; secondary actions are visually quieter
- [ ] Inputs: consistent height/radius; placeholder legible; error/confirm prompts don’t feel jarring
- [ ] Motion: subtle transitions only (150–200ms); respects reduced motion
- [ ] Icon consistency: single icon set (Lucide); consistent stroke weight/size

---

## Manual smoke checklist (edit per project)
1) Create a Skins round, enter holes 1–3 in Quick mode
2) Share status, then share settlement after locking
3) Repeat in dark mode

## Regression rules
- Any bug that matters must produce a regression test.
