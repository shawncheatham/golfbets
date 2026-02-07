# Backlog

Opinionated and small. Keep slices shippable and feedback-driven.

## Now (next 1–2 PRs)
- [ ] Accessibility QA (quick sweep)
  - tap targets, focus states, aria labels, not color-only
  - verify reduced-motion behavior
  - quick pass on keyboard navigation for all interactive controls
- [ ] Distribution + learning loop
  - weekend rounds: capture friction + failure cases
  - add a lightweight feedback capture path (copy/paste prompt or link)

## Next
- [ ] Instrumentation v2 follow-ups (still local-first)
  - add a “clear debug events” button (confirm + clears localStorage)
  - add a “debug view” modal (last N events) for non-technical sharing
  - decide whether to keep/remove console logging in `track()` for prod

## Later (product)
- [ ] More games (only if they match the on-course interaction model)
- [ ] "Chat referee" direction
  - Phase 1: single scorekeeper
  - Phase 2: all players participate

## Done (shipped)

### BBB (Bingo Bango Bongo)
- [x] Award-entry BBB game (no stroke entry)
- [x] Quick mode award pickers (Bingo/Bango/Bongo + None)
- [x] Grid mode holes view
- [x] Optional $/pt settlement (per-opponent-per-point, zero-sum)
- [x] Share status + share settlement

### Chakra migration (UI)
- [x] Setup → Chakra
- [x] Quick mode → Chakra (header/nav, chips/stepper, footer)
- [x] Holes/Grid → Chakra (header/actions + interactive controls)
- [x] Settlement/Standings → Chakra
- [x] CSS cleanup + remaining legacy UI cleanup

### Perf / bundle hygiene
- [x] Bundle analyzer (`ANALYZE=1` → `dist/stats.html`)
- [x] Split vendor chunks to avoid >500kB minified chunk warning

### Quality gates
- [x] Fix ESLint `no-explicit-any` issues
- [x] Make lint a build gate (`prebuild` runs `npm run lint`)

### Instrumentation v2 (local-first)
- [x] Formalize event names (`TRACK_EVENTS`)
- [x] Debug export (copy JSON)

### Polish
- [x] Typography/spacing pass (Inputs/Textareas/Table headers)
- [x] A11y labels improvements (stepper + grid inputs)
