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

## Manual smoke checklist (edit per project)
1) 
2) 
3) 

## Regression rules
- Any bug that matters must produce a regression test.
