# Backlog

Opinionated and small. Keep slices shippable and feedback-driven.

## Now (next 1–2 PRs)
- [ ] Performance / bundle hygiene
  - investigate the Vite/Rollup warning about a >500kB minified JS chunk
  - establish a baseline (bundle size + main route load time)
  - consider low-risk code splitting (e.g., lazy-load settlement/standings screens)
  - avoid premature complexity; keep changes reviewable

## Next
- [ ] Instrumentation v2 (still local-first)
  - formalize event names
  - add a "debug export" button (copy JSON)
  - roadmap: optional external vendor later
- [ ] Accessibility QA (quick sweep)
  - tap targets, focus states, aria labels, not color-only
  - verify reduced-motion behavior

## Later (product)
- [ ] Distribution + learning loop
  - weekend rounds: capture friction + failure cases
  - add a lightweight feedback capture path (copy/paste prompt or link)
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

### Polish
- [x] Typography/spacing pass (Inputs/Textareas/Table headers)
- [x] A11y labels improvements (stepper + grid inputs)
