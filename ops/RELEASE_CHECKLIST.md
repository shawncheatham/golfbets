# Release Checklist (Ship-Fast)

## Pre-release
- [ ] Stage metric defined (what success looks like)
- [ ] Manual smoke checklist completed
- [ ] Observability check: errors/metrics/logs visible
- [ ] Rollback plan exists (flag/revert)

## Post-release (same day)
- [ ] Verify primary metric not broken
- [ ] Check error logs for spikes
- [ ] Capture learnings in `docs/DECISIONS.md`
