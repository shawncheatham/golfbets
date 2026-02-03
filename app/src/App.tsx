import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import type { Player, PlayerId, Round } from './types'
import { computeSkins, stakeLabel } from './logic/skins'
import { computeSettlement } from './logic/settlement'
import { deleteRound, loadRounds, saveRounds, upsertRound } from './storage'

type Screen = 'setup' | 'holes' | 'quick' | 'settlement'

function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`
}

function centsFromDollarsString(s: string): number {
  const cleaned = s.replace(/[^0-9.]/g, '')
  const n = Number(cleaned)
  if (!Number.isFinite(n) || n <= 0) return 0
  return Math.round(n * 100)
}

function dollarsStringFromCents(cents: number): string {
  if (!cents) return ''
  const d = cents / 100
  return d % 1 === 0 ? `${d.toFixed(0)}` : `${d.toFixed(2)}`
}

function createEmptyRound(): Round {
  return {
    id: uid('round'),
    name: 'Skins',
    stakeCents: 500,
    players: [
      { id: uid('p'), name: 'Player 1' },
      { id: uid('p'), name: 'Player 2' },
    ],
    strokesByHole: {},
    createdAt: Date.now(),
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('setup')

  // Local persistence
  const [stored, setStored] = useState(() => loadRounds())
  const [round, setRound] = useState<Round>(() => {
    const st = loadRounds()
    const active = st.activeRoundId ? st.rounds.find((r) => r.id === st.activeRoundId) : undefined
    return active || createEmptyRound()
  })

  // Avoid writing on initial mount before state settles
  const hydrated = useRef(false)
  useEffect(() => {
    if (!hydrated.current) {
      hydrated.current = true
      return
    }
    setStored((prev) => {
      const next = upsertRound(prev, round)
      saveRounds(next)
      return next
    })
  }, [round])

  const skins = useMemo(() => computeSkins(round), [round])
  const settlement = useMemo(() => computeSettlement(round), [round])

  const allPlayersHaveNames = round.players.every((p) => p.name.trim().length > 0)
  const canStart = allPlayersHaveNames && round.players.length >= 2 && round.players.length <= 4 && round.stakeCents > 0

  function updatePlayer(id: PlayerId, patch: Partial<Player>) {
    setRound((r) => ({
      ...r,
      players: r.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  function addPlayer() {
    setRound((r) => {
      if (r.players.length >= 4) return r
      return { ...r, players: [...r.players, { id: uid('p'), name: `Player ${r.players.length + 1}` }] }
    })
  }

  function removePlayer(id: PlayerId) {
    setRound((r) => {
      if (r.players.length <= 2) return r
      const players = r.players.filter((p) => p.id !== id)
      const strokesByHole: Round['strokesByHole'] = {}
      for (const [holeStr, byPlayer] of Object.entries(r.strokesByHole)) {
        const hole = Number(holeStr)
        const next: Record<PlayerId, number | null> = {}
        for (const p of players) next[p.id] = byPlayer?.[p.id] ?? null
        strokesByHole[hole] = next
      }
      return { ...r, players, strokesByHole }
    })
  }

  function clampStroke(n: number): number {
    // Guardrails: keep plausible golf score range. Still allows bad holes.
    return Math.max(1, Math.min(25, Math.round(n)))
  }

  function setStroke(hole: number, playerId: PlayerId, v: string) {
    if (round.locked) return

    const n = v.trim() === '' ? null : Number(v)
    if (n !== null && (!Number.isFinite(n) || n < 0 || !Number.isInteger(n))) return

    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: {
            ...holeRec,
            [playerId]: n === null ? null : clampStroke(n),
          },
        },
      }
    })
  }

  function incStroke(hole: number, playerId: PlayerId, delta: number) {
    if (round.locked) return

    setRound((r) => {
      const holeRec = r.strokesByHole[hole] || {}
      const cur = holeRec[playerId]
      const base = typeof cur === 'number' ? cur : 4
      const next = clampStroke(base + delta)
      return {
        ...r,
        strokesByHole: {
          ...r.strokesByHole,
          [hole]: {
            ...holeRec,
            [playerId]: next,
          },
        },
      }
    })
  }

  // Quick-entry mode
  const [quickHole, setQuickHole] = useState<number>(1)

  const isHoleComplete = (h: number) => {
    const by = round.strokesByHole[h]
    return round.players.every((p) => typeof by?.[p.id] === 'number')
  }

  const firstIncompleteHole = () => {
    for (let h = 1; h <= 18; h++) {
      if (!isHoleComplete(h)) return h
    }
    return 18
  }

  useEffect(() => {
    // When entering quick mode, jump to first incomplete hole.
    if (screen !== 'quick') return
    setQuickHole(firstIncompleteHole())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen])

  function reset() {
    if (!confirm('Start a new round? This will clear the current round on screen (saved rounds remain in Recent).')) {
      return
    }
    setRound(createEmptyRound())
    setScreen('setup')
  }

  function loadExistingRound(r: Round) {
    setRound(r)
    setScreen('holes')
    setStored((prev) => {
      const next = { ...prev, activeRoundId: r.id }
      saveRounds(next)
      return next
    })
  }

  function deleteExistingRound(id: string) {
    if (!confirm('Delete this saved round?')) return
    setStored((prev) => {
      const next = deleteRound(prev, id)
      saveRounds(next)
      return next
    })
  }

  function settlementText(): string {
    const stake = stakeLabel(round.stakeCents)
    const lines = settlement.lines
      .map((l) => `${l.from.name} pays ${l.to.name} $${(l.amountCents / 100).toFixed(2)}`)
      .join('\n')

    const totals = round.players
      .map((p) => {
        const net = settlement.netByPlayer[p.id] || 0
        const sign = net >= 0 ? '+' : '-'
        return `${p.name}: ${sign}$${Math.abs(net / 100).toFixed(2)}`
      })
      .join('\n')

    return `Skins settlement (${stake} per skin)\n\nNet:\n${totals}\n\nSuggested payments:\n${lines || '(no payments)'}`
  }

  async function copySettlement() {
    try {
      await navigator.clipboard.writeText(settlementText())
      alert('Copied settlement to clipboard')
    } catch {
      alert('Could not copy. You can manually select and copy the text.')
    }
  }

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Golf Bets</h1>
          <span>Skins (web prototype) — money-adjacent</span>
        </div>
        <div className="pill">{stakeLabel(round.stakeCents)} per skin</div>
      </div>

      {screen === 'setup' && (
        <div className="card">
          <div className="row two">
            <div>
              <div className="label">Round name</div>
              <input
                className="input"
                value={round.name}
                onChange={(e) => setRound((r) => ({ ...r, name: e.target.value }))}
                placeholder="Saturday skins"
              />
            </div>
            <div>
              <div className="label">Stake ($/skin)</div>
              <input
                className="input"
                value={dollarsStringFromCents(round.stakeCents)}
                onChange={(e) => setRound((r) => ({ ...r, stakeCents: centsFromDollarsString(e.target.value) }))}
                inputMode="decimal"
                placeholder="5"
              />
              <div className="small">Gross skins. Carryovers on ties. Tie after 18 remains a tie.</div>
            </div>
          </div>

          <div style={{ height: 16 }} />

          <div className="label">Players (2–4)</div>
          <div className="row">
            {round.players.map((p, idx) => (
              <div key={p.id} className="row two">
                <div>
                  <input
                    className="input"
                    value={p.name}
                    onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                    placeholder={`Player ${idx + 1}`}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {round.players.length > 2 && (
                    <button className="btn ghost" onClick={() => removePlayer(p.id)}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <button className="btn" onClick={addPlayer} disabled={round.players.length >= 4}>
                + Add player
              </button>
              <button className="btn primary" disabled={!canStart} onClick={() => setScreen('quick')}>
                Start round →
              </button>
              <button className="btn ghost" disabled={!canStart} onClick={() => setScreen('holes')}>
                Grid view
              </button>
              <button className="btn danger" onClick={reset}>
                New round
              </button>
            </div>
          </div>

          {stored.rounds.length > 0 && (
            <>
              <div style={{ height: 18 }} />
              <div className="label">Recent rounds</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Players</th>
                    <th style={{ textAlign: 'right' }}>Stake</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {stored.rounds
                    .slice()
                    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
                    .slice(0, 8)
                    .map((r) => (
                      <tr key={r.id}>
                        <td>{r.name || 'Skins'}</td>
                        <td className="small">{r.players.map((p) => p.name).join(', ')}</td>
                        <td style={{ textAlign: 'right' }}>{stakeLabel(r.stakeCents)}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn ghost" onClick={() => loadExistingRound(r)}>
                            Open
                          </button>{' '}
                          <button className="btn danger" onClick={() => deleteExistingRound(r.id)}>
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      )}

      {screen === 'holes' && (
        <div className="card">
          <div className="row">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="label">Round</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Skins'}</div>
                <div className="small">Carry to next hole: {skins.carryToNext} skin(s)</div>
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <label className="toggle small" title="Lock disables edits (useful once a round is final)">
                  <input
                    type="checkbox"
                    checked={!!round.locked}
                    onChange={(e) => setRound((r) => ({ ...r, locked: e.target.checked }))}
                  />
                  Lock round
                </label>
                <button className="btn ghost" onClick={() => setScreen('quick')}>
                  Quick mode
                </button>
                <button className="btn ghost" onClick={() => setScreen('setup')}>
                  ← Setup
                </button>
                <button className="btn primary" onClick={() => setScreen('settlement')}>
                  Settlement →
                </button>
              </div>
            </div>

            <div className="holes">
              <div className="holeGrid">
                <div className="holeRow header">
                  <div className="holeCell"><span className="small">Hole</span></div>
                  {round.players.map((p) => (
                    <div key={p.id} className="holeCell"><span className="small">{p.name}</span></div>
                  ))}
                </div>

                {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
                  <div key={hole} className="holeRow">
                    <div className="holeCell"><span className="holeNum">{hole}</span></div>
                    {round.players.map((p) => (
                      <div key={p.id} className="holeCell">
                        <input
                          className="holeInput"
                          value={round.strokesByHole[hole]?.[p.id] ?? ''}
                          onChange={(e) => setStroke(hole, p.id, e.target.value)}
                          inputMode="numeric"
                          placeholder="-"
                        />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div style={{ height: 14 }} />

            <div className="row two">
              <div>
                <div className="label">Skins won</div>
                <table className="table">
                  <tbody>
                    {round.players.map((p) => (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td style={{ textAlign: 'right' }}>{skins.skinsWon[p.id] || 0}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <div className="label">Per-hole (winner / carry)</div>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Hole</th>
                      <th>Winner</th>
                      <th style={{ textAlign: 'right' }}>Skins</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skins.holeResults.map((hr) => {
                      const winner = hr.winnerId ? round.players.find((p) => p.id === hr.winnerId)?.name : '—'
                      const label = hr.winnerId ? winner : `tie (carry)`
                      return (
                        <tr key={hr.hole}>
                          <td>{hr.hole}</td>
                          <td>{label}</td>
                          <td style={{ textAlign: 'right' }}>{hr.winnerId ? hr.wonSkins : hr.carrySkins ? `+${hr.carrySkins}` : '—'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
                <div className="small">Note: ties carry 1 skin forward. Carry resets on a win. Ties after 18 remain unresolved.</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {screen === 'quick' && (
        <div className="card">
          <div className="quickTop">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Skins'}</div>
              <div className="small">Carry to next hole: {skins.carryToNext} skin(s)</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="toggle small" title="Lock disables edits (useful once a round is final)">
                <input
                  type="checkbox"
                  checked={!!round.locked}
                  onChange={(e) => setRound((r) => ({ ...r, locked: e.target.checked }))}
                />
                Lock round
              </label>
              <div className="holePicker">
                {quickHole > 1 ? (
                  <button className="btn ghost" onClick={() => setQuickHole((h) => Math.max(1, h - 1))}>
                    ←
                  </button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
                <select
                  className="input"
                  style={{ width: 110, padding: '10px 10px', fontWeight: 800 }}
                  value={quickHole}
                  onChange={(e) => setQuickHole(Number(e.target.value))}
                >
                  {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>
                      Hole {h}
                    </option>
                  ))}
                </select>
                {quickHole < 18 ? (
                  <button className="btn ghost" onClick={() => setQuickHole((h) => Math.min(18, h + 1))}>
                    →
                  </button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
              </div>
              <button className="btn ghost" onClick={() => setScreen('holes')}>
                Grid
              </button>
            </div>
          </div>

          <div style={{ height: 10 }} />

          <div className="card" style={{ padding: 12, marginBottom: 12 }}>
            <div className="label">Hole summary</div>
            {(() => {
              const hr = skins.holeResults.find((x) => x.hole === quickHole)
              if (!hr) return <div className="small">No data for this hole yet.</div>
              if (!isHoleComplete(quickHole)) {
                return <div className="small">Enter all players to score this hole.</div>
              }
              if (hr.winnerId) {
                const winner = round.players.find((p) => p.id === hr.winnerId)?.name || 'Winner'
                return (
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span className="pill">Winner: {winner}</span>
                    <span className="pill">Skins: {hr.wonSkins}</span>
                  </div>
                )
              }
              return (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="pill">Result: tie</span>
                  <span className="pill">Carry now: {hr.carrySkins + 1} skin(s)</span>
                </div>
              )
            })()}
          </div>

          <div className="row">
            {round.players.map((p) => {
              const val = round.strokesByHole[quickHole]?.[p.id]
              return (
                <div key={p.id} className="incRow">
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                  </div>
                  <div className="stepper">
                    <button className="stepBtn" onClick={() => incStroke(quickHole, p.id, -1)} disabled={!!round.locked}>
                      −
                    </button>
                    <div className="stepVal">{typeof val === 'number' ? val : '—'}</div>
                    <button
                      className="stepBtn"
                      onClick={() => {
                        incStroke(quickHole, p.id, +1)
                        // If this completes the hole, auto-advance to next incomplete.
                        // Use a microtask so state updates apply first.
                        queueMicrotask(() => {
                          // Find next incomplete starting from current hole
                          for (let h = quickHole; h <= 18; h++) {
                            if (!isHoleComplete(h)) return
                          }
                          // current and all later holes complete; jump to next incomplete (wrap)
                          for (let h = 1; h <= quickHole; h++) {
                            if (!isHoleComplete(h)) {
                              setQuickHole(h)
                              return
                            }
                          }
                        })
                      }}
                      disabled={!!round.locked}
                    >
                      +
                    </button>
                  </div>
                  <button
                    className="btn ghost"
                    disabled={!!round.locked}
                    onClick={() => setStroke(quickHole, p.id, '')}
                    title="Clear"
                  >
                    Clear
                  </button>
                </div>
              )
            })}

            <div className="footerActions">
              {quickHole > 1 ? (
                <button className="btn ghost" onClick={() => setQuickHole((h) => Math.max(1, h - 1))}>
                  Prev hole
                </button>
              ) : (
                <span />
              )}

              {quickHole < 18 ? (
                <button
                  className="btn primary"
                  onClick={() => {
                    const next = Math.min(18, quickHole + 1)
                    setQuickHole(next)
                  }}
                >
                  Next hole
                </button>
              ) : (
                <span />
              )}
              <button
                className="btn"
                onClick={() => {
                  // Jump to next incomplete hole; if all complete, stay on 18.
                  for (let h = Math.min(18, quickHole + 1); h <= 18; h++) {
                    if (!isHoleComplete(h)) {
                      setQuickHole(h)
                      return
                    }
                  }
                  // wrap
                  for (let h = 1; h <= quickHole; h++) {
                    if (!isHoleComplete(h)) {
                      setQuickHole(h)
                      return
                    }
                  }
                  setQuickHole(18)
                }}
              >
                Next incomplete
              </button>

              <button className="btn primary" onClick={() => setScreen('settlement')}>
                Settlement →
              </button>

              <button className="btn ghost" onClick={() => setScreen('setup')}>
                Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'settlement' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">Settlement</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Skins'}</div>
              <div className="small">Skins stake: {stakeLabel(round.stakeCents)} (winner collects from each opponent)</div>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <label className="toggle small" title="Lock disables edits (useful once a round is final)">
                <input
                  type="checkbox"
                  checked={!!round.locked}
                  onChange={(e) => setRound((r) => ({ ...r, locked: e.target.checked }))}
                />
                Lock round
              </label>
              <button className="btn ghost" onClick={() => setScreen('quick')}>
                Quick mode
              </button>
              <button className="btn ghost" onClick={() => setScreen('holes')}>
                ← Back to holes
              </button>
              <button className="btn" onClick={copySettlement}>
                Copy
              </button>
              <button className="btn danger" onClick={reset}>
                New round
              </button>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="row two">
            <div>
              <div className="label">Net by player</div>
              <table className="table">
                <tbody>
                  {round.players.map((p) => {
                    const net = settlement.netByPlayer[p.id] || 0
                    return (
                      <tr key={p.id}>
                        <td>{p.name}</td>
                        <td style={{ textAlign: 'right' }} className={net >= 0 ? 'positive' : 'negative'}>
                          {net >= 0 ? '+' : '-'}${Math.abs(net / 100).toFixed(2)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <div className="small">Positive = they should receive money. Negative = they owe.</div>
            </div>

            <div>
              <div className="label">Suggested payments</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {settlement.lines.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="small">No payments needed.</td>
                    </tr>
                  ) : (
                    settlement.lines.map((l, idx) => (
                      <tr key={idx}>
                        <td>{l.from.name}</td>
                        <td>{l.to.name}</td>
                        <td style={{ textAlign: 'right' }}>${(l.amountCents / 100).toFixed(2)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <div className="small">This is a suggestion to minimize transactions. Pay via Venmo/Cash App/etc.</div>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="label">Shareable text</div>
          <textarea className="input" style={{ height: 180 }} readOnly value={settlementText()} />

          <div className="footerActions">
            <button className="btn" onClick={copySettlement}>Copy settlement</button>
            <button className="btn ghost" onClick={() => setScreen('holes')}>Back</button>
          </div>
        </div>
      )}
    </div>
  )
}
