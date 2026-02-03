import { useEffect, useMemo, useRef, useState } from 'react'

type Theme = 'dark' | 'light'
import './App.css'
import type { GameType, HoleNumber, Player, PlayerId, Round } from './types'
import { computeSkins, stakeLabel } from './logic/skins'
import { computeSettlement } from './logic/settlement'
import { computeWolf, wolfForHole, wolfLabel } from './logic/wolf'
import { deleteRound, loadRounds, saveRounds, upsertRound } from './storage'

type Screen = 'game' | 'setup' | 'holes' | 'quick' | 'settlement'

const THEME_KEY = 'rubislabs:golf-bets:theme:v1'

function loadTheme(): Theme {
  try {
    const raw = localStorage.getItem(THEME_KEY)
    if (raw === 'light' || raw === 'dark') return raw
  } catch {
    // ignore
  }
  // default: dark (matches current design)
  return 'dark'
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme
  try {
    localStorage.setItem(THEME_KEY, theme)
  } catch {
    // ignore
  }
}

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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomSkinsName(): string {
  // A little funny/rowdy, but still "golf tournament" flavored.
  const adjectives = [
    'Back Nine',
    'Cart Path',
    'Breakfast Ball',
    'Mulligan',
    'Sand Trap',
    'Fairway',
    'Range Rat',
    'Caddie Shack',
    'Turn Dog',
    'Sunset',
    'Birdie Juice',
    'Wedge Wizard',
    'Short Game',
    'Greenside',
    'Dad Golf',
  ]

  const nouns = ['Open', 'Invitational', 'Classic', 'Cup', 'Championship', 'Showdown', 'Shootout', 'Rumble', 'Skins Game']

  const suffixes = ['(No Gimmes)', '(All Gimmes)', '(Low Drama)', '(High Drama)', '(Respectfully)', '(Allegedly)']

  const base = `${pick(adjectives)} ${pick(nouns)}`
  // Keep it playful but not always noisy.
  return Math.random() < 0.35 ? `${base} ${pick(suffixes)}` : base
}

function randomWolfName(): string {
  const adjectives = ['Wolf', 'Lone Wolf', 'Pack', 'Cart Path', 'Trash Talk', 'Breakfast Ball', 'Wedge Wizard', 'Birdie Juice', 'Back Nine']
  const nouns = ['Classic', 'Open', 'Invitational', 'Showdown', 'Shootout', 'Rumble']
  const suffixes = ['(No Mercy)', '(Respectfully)', '(Allegedly)', '(No Gimmes)']

  const base = `${pick(adjectives)} ${pick(nouns)}`
  return Math.random() < 0.35 ? `${base} ${pick(suffixes)}` : base
}

function createEmptySkinsRound(): Round {
  return {
    id: uid('round'),
    game: 'skins',
    name: randomSkinsName(),
    stakeCents: 500,
    players: [
      { id: uid('p'), name: 'Player 1' },
      { id: uid('p'), name: 'Player 2' },
    ],
    strokesByHole: {},
    createdAt: Date.now(),
  }
}

function createEmptyWolfRound(): Round {
  return {
    id: uid('round'),
    game: 'wolf',
    name: randomWolfName(),
    wolfPointsPerHole: 1,
    wolfLoneMultiplier: 2,
    wolfStartingIndex: 0,
    wolfPartnerByHole: {},
    players: [
      { id: uid('p'), name: 'Player 1' },
      { id: uid('p'), name: 'Player 2' },
      { id: uid('p'), name: 'Player 3' },
      { id: uid('p'), name: 'Player 4' },
    ],
    strokesByHole: {},
    createdAt: Date.now(),
  }
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('game')
  const [theme, setTheme] = useState<Theme>(() => loadTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Local persistence
  const [stored, setStored] = useState(() => loadRounds())
  const [round, setRound] = useState<Round>(() => {
    const st = loadRounds()
    const active = st.activeRoundId ? st.rounds.find((r) => r.id === st.activeRoundId) : undefined
    // If there is an active round, resume it, but keep landing page available.
    return active || createEmptySkinsRound()
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

  const skins = useMemo(() => (round.game === 'skins' ? computeSkins(round) : null), [round])
  const settlement = useMemo(() => (round.game === 'skins' ? computeSettlement(round) : null), [round])
  const wolf = useMemo(() => (round.game === 'wolf' ? computeWolf(round) : null), [round])

  const allPlayersHaveNames = round.players.every((p) => p.name.trim().length > 0)

  const canStart = useMemo(() => {
    if (!allPlayersHaveNames) return false
    if (round.game === 'skins') {
      return round.players.length >= 2 && round.players.length <= 4 && (round.stakeCents || 0) > 0
    }
    // wolf v1: 4 only
    const pts = round.wolfPointsPerHole || 0
    return round.players.length === 4 && pts > 0
  }, [allPlayersHaveNames, round])

  function updatePlayer(id: PlayerId, patch: Partial<Player>) {
    setRound((r) => ({
      ...r,
      players: r.players.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    }))
  }

  const focusPlayerId = useRef<PlayerId | null>(null)

  function addPlayer() {
    setRound((r) => {
      if (r.game === 'wolf') return r
      if (r.players.length >= 4) return r
      const id = uid('p')
      focusPlayerId.current = id
      return { ...r, players: [...r.players, { id, name: `Player ${r.players.length + 1}` }] }
    })
  }

  function removePlayer(id: PlayerId) {
    setRound((r) => {
      if (r.game === 'wolf') return r
      if (r.players.length <= 2) return r
      const players = r.players.filter((p) => p.id !== id)
      // If we removed the focused player, clear.
      if (focusPlayerId.current === id) focusPlayerId.current = null
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

  function resetToGamePicker() {
    if (!confirm('Start a new game? This will clear the current round on screen (saved rounds remain in Recent).')) {
      return
    }
    setScreen('game')
  }

  function resetSameGame() {
    if (!confirm('Start a new round? This will clear the current round on screen (saved rounds remain in Recent).')) {
      return
    }
    setRound(round.game === 'wolf' ? createEmptyWolfRound() : createEmptySkinsRound())
    setScreen('setup')
  }

  function startNew(game: GameType) {
    setRound(game === 'wolf' ? createEmptyWolfRound() : createEmptySkinsRound())
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
    if (!settlement) return ''
    const stake = stakeLabel(round.stakeCents || 0)
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

  function headerPill() {
    if (round.game === 'wolf') return wolfLabel(round.wolfPointsPerHole)
    return `${stakeLabel(round.stakeCents || 0)} per skin`
  }

  function setWolfPartnerForHole(hole: HoleNumber, partnerId: PlayerId | null) {
    if (round.locked) return
    setRound((r) => {
      if (r.game !== 'wolf') return r
      const cur = r.wolfPartnerByHole || {}
      return { ...r, wolfPartnerByHole: { ...cur, [hole]: partnerId } }
    })
  }

  const wolfHole = useMemo(() => {
    if (round.game !== 'wolf') return null
    return wolfForHole(round, quickHole as HoleNumber)
  }, [round, quickHole])

  return (
    <div className="container">
      <div className="header">
        <div className="brand">
          <h1>Golf Bets</h1>
          <span>{round.game === 'wolf' ? 'Wolf (web prototype) — points' : 'Skins (web prototype) — money-adjacent'}</span>
        </div>

        <div className="headerRight">
          <div className="pill">{headerPill()}</div>
          <button
            className="btn ghost iconBtn"
            onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            type="button"
          >
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </div>

      {screen === 'game' && (
        <div className="card">
          <div className="label">Choose a game</div>
          <div className="row two">
            <button className="btn primary" onClick={() => startNew('skins')} type="button">
              Skins →
            </button>
            <button className="btn primary" onClick={() => startNew('wolf')} type="button">
              Wolf →
            </button>
          </div>

          {stored.rounds.length > 0 && (
            <>
              <div style={{ height: 18 }} />
              <div className="label">Recent rounds</div>
              <table className="table">
                <thead>
                  <tr>
                    <th>Game</th>
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
                    .slice(0, 10)
                    .map((r) => (
                      <tr key={r.id}>
                        <td className="small">{r.game === 'wolf' ? 'Wolf' : 'Skins'}</td>
                        <td>{r.name || (r.game === 'wolf' ? 'Wolf' : 'Skins')}</td>
                        <td className="small">{r.players.map((p) => p.name).join(', ')}</td>
                        <td style={{ textAlign: 'right' }}>
                          {r.game === 'wolf' ? wolfLabel(r.wolfPointsPerHole) : stakeLabel(r.stakeCents || 0)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn ghost" onClick={() => loadExistingRound(r)} type="button">
                            Open
                          </button>{' '}
                          <button className="btn danger" onClick={() => deleteExistingRound(r.id)} type="button">
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

      {screen === 'setup' && (
        <div className="card">
          <div className="row two">
            <div>
              <div className="labelRow">
                <div className="label">Round name</div>
                {round.game === 'skins' ? (
                  <button
                    className="btn ghost iconBtn"
                    type="button"
                    onClick={() => setRound((r) => ({ ...r, name: randomSkinsName() }))}
                    title="Reroll name"
                  >
                    🎲 Reroll
                  </button>
                ) : (
                  <button
                    className="btn ghost iconBtn"
                    type="button"
                    onClick={() => setRound((r) => ({ ...r, name: randomWolfName() }))}
                    title="Reroll name"
                  >
                    🎲 Reroll
                  </button>
                )}
              </div>
              <input
                className="input"
                value={round.name}
                onChange={(e) => setRound((r) => ({ ...r, name: e.target.value }))}
                placeholder="Saturday skins"
              />
            </div>

            {round.game === 'skins' ? (
              <div>
                <div className="label">Stake ($/skin)</div>
                <input
                  className="input"
                  value={dollarsStringFromCents(round.stakeCents || 0)}
                  onChange={(e) => setRound((r) => ({ ...r, stakeCents: centsFromDollarsString(e.target.value) }))}
                  inputMode="decimal"
                  placeholder="5"
                />
                <div className="small">Gross skins. Carryovers on ties. Tie after 18 remains a tie.</div>
              </div>
            ) : (
              <div>
                <div className="label">Points per hole</div>
                <input
                  className="input"
                  value={String(round.wolfPointsPerHole ?? 1)}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (!Number.isFinite(n)) return
                    setRound((r) => ({ ...r, wolfPointsPerHole: Math.max(1, Math.min(10, Math.round(n))) }))
                  }}
                  inputMode="numeric"
                  placeholder="1"
                />
                <div className="small">Wolf is 4 players only (v1). Best-ball match-play points per hole.</div>
              </div>
            )}
          </div>

          <div style={{ height: 16 }} />

          <div className="label">Players (2–4)</div>
          <div className="small">{round.game === 'wolf' ? 'Wolf is 4 players only.' : 'Start with 2. Add up to 4.'}</div>

          <div className="row">
            {round.players.map((p, idx) => (
              <div key={p.id} className="row two">
                <div>
                  <input
                    className="input"
                    ref={(el) => {
                      if (!el) return
                      if (focusPlayerId.current && focusPlayerId.current === p.id) {
                        queueMicrotask(() => el.focus())
                        focusPlayerId.current = null
                      }
                    }}
                    value={p.name}
                    onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                    placeholder={`Player ${idx + 1}`}
                  />
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'flex-end' }}>
                  {round.game === 'skins' && round.players.length > 2 && (
                    <button className="btn ghost" onClick={() => removePlayer(p.id)} type="button">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {round.game === 'skins' && (
                <button className="btn" onClick={addPlayer} disabled={round.players.length >= 4} type="button">
                  + Add player
                </button>
              )}
              <button className="btn primary" disabled={!canStart} onClick={() => setScreen('quick')} type="button">
                Start round →
              </button>
              <button className="btn ghost" disabled={!canStart} onClick={() => setScreen('holes')} type="button">
                Grid view
              </button>
              <button className="btn ghost" onClick={resetToGamePicker} type="button">
                Change game
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
                New round
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'holes' && (
        <div className="card">
          <div className="row">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div className="label">Round</div>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || (round.game === 'wolf' ? 'Wolf' : 'Skins')}</div>
                {round.game === 'skins' && skins && <div className="small">Carry to next hole: {skins.carryToNext} skin(s)</div>}
                {round.game === 'wolf' && wolf && (
                  <div className="small">
                    Points leader: {
                      round.players
                        .slice()
                        .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))[0]?.name
                    }
                  </div>
                )}
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
                <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                  Quick mode
                </button>
                <button className="btn ghost" onClick={() => setScreen('setup')} type="button">
                  ← Setup
                </button>
                <button className="btn primary" onClick={() => setScreen('settlement')} type="button">
                  {round.game === 'wolf' ? 'Standings →' : 'Settlement →'}
                </button>
              </div>
            </div>

            <div className="holes">
              <div className="holeGrid" style={{ minWidth: 720 }}>
                <div className="holeRow header">
                  <div className="holeCell">
                    <span className="small">Hole</span>
                  </div>
                  {round.players.map((p) => (
                    <div key={p.id} className="holeCell">
                      <span className="small">{p.name}</span>
                    </div>
                  ))}
                </div>

                {Array.from({ length: 18 }, (_, i) => i + 1).map((hole) => (
                  <div key={hole} className="holeRow">
                    <div className="holeCell">
                      <span className="holeNum">{hole}</span>
                    </div>
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

            {round.game === 'skins' && skins && (
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
            )}

            {round.game === 'wolf' && wolf && (
              <div>
                <div className="label">Points (leaderboard)</div>
                <table className="table">
                  <tbody>
                    {round.players
                      .slice()
                      .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))
                      .map((p) => (
                        <tr key={p.id}>
                          <td>{p.name}</td>
                          <td style={{ textAlign: 'right' }}>{wolf.pointsByPlayer[p.id] || 0}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                <div className="small">Wolf rotates each hole (starting from Player 1 on hole 1). Choose partner in Quick mode (or play Lone Wolf).</div>
              </div>
            )}
          </div>
        </div>
      )}

      {screen === 'quick' && (
        <div className="card">
          <div className="quickTop">
            <div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || (round.game === 'wolf' ? 'Wolf' : 'Skins')}</div>
              {round.game === 'skins' && skins && <div className="small">Carry to next hole: {skins.carryToNext} skin(s)</div>}
              {round.game === 'wolf' && wolfHole && (
                <div className="small">
                  Hole {quickHole}: Wolf = {round.players.find((p) => p.id === wolfHole.wolfId)?.name || 'Wolf'}
                </div>
              )}
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
                  <button className="btn ghost" onClick={() => setQuickHole((h) => Math.max(1, h - 1))} type="button">
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
                  <button className="btn ghost" onClick={() => setQuickHole((h) => Math.min(18, h + 1))} type="button">
                    →
                  </button>
                ) : (
                  <span style={{ width: 44 }} />
                )}
              </div>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                Grid
              </button>
            </div>
          </div>

          {round.game === 'wolf' && wolfHole && (
            <div className="card" style={{ padding: 12, marginTop: 12, marginBottom: 12 }}>
              <div className="label">Wolf partner (for this hole)</div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                {round.players
                  .filter((p) => p.id !== wolfHole.wolfId)
                  .map((p) => {
                    const selected = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) === p.id
                    return (
                      <button
                        key={p.id}
                        className={`chip ${selected ? 'active' : ''}`}
                        onClick={() => setWolfPartnerForHole(quickHole as HoleNumber, p.id)}
                        disabled={!!round.locked}
                        type="button"
                      >
                        {p.name}
                      </button>
                    )
                  })}
                {(() => {
                  const selected = (round.wolfPartnerByHole?.[quickHole as HoleNumber] ?? null) === null
                  return (
                    <button
                      className={`chip ${selected ? 'active' : ''}`}
                      onClick={() => setWolfPartnerForHole(quickHole as HoleNumber, null)}
                      disabled={!!round.locked}
                      type="button"
                      title="Play lone wolf"
                    >
                      Lone
                    </button>
                  )
                })()}
              </div>
              <div className="small">If you don’t pick a partner, it counts as Lone Wolf.</div>
            </div>
          )}

          <div className="row">
            {round.players.map((p) => {
              const val = round.strokesByHole[quickHole]?.[p.id]
              return (
                <div key={p.id} className="incRow">
                  <div>
                    <div style={{ fontWeight: 800 }}>{p.name}</div>
                  </div>
                  <div className="quickScore">
                    <div className="chipRow" aria-label={`${p.name} quick score buttons`}>
                      {[3, 4, 5, 6, 7].map((n) => (
                        <button
                          key={n}
                          className={`chip ${val === n ? 'active' : ''}`}
                          onClick={() => setStroke(quickHole, p.id, String(n))}
                          disabled={!!round.locked}
                          type="button"
                          title={`Set ${p.name} to ${n}`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>

                    <div className="stepper">
                      <button className="stepBtn" onClick={() => incStroke(quickHole, p.id, -1)} disabled={!!round.locked} type="button">
                        −
                      </button>
                      <div className="stepVal">{typeof val === 'number' ? val : '—'}</div>
                      <button
                        className="stepBtn"
                        onClick={() => incStroke(quickHole, p.id, +1)}
                        disabled={!!round.locked}
                        type="button"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <button className="btn ghost" disabled={!!round.locked} onClick={() => setStroke(quickHole, p.id, '')} title="Clear" type="button">
                    Clear
                  </button>
                </div>
              )
            })}

            <div className="footerActions">
              {quickHole > 1 ? (
                <button className="btn ghost" onClick={() => setQuickHole((h) => Math.max(1, h - 1))} type="button">
                  Prev hole
                </button>
              ) : (
                <span />
              )}

              {quickHole < 18 ? (
                <button className="btn primary" onClick={() => setQuickHole((h) => Math.min(18, h + 1))} type="button">
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
                type="button"
              >
                Next incomplete
              </button>

              <button className="btn primary" onClick={() => setScreen('settlement')} type="button">
                {round.game === 'wolf' ? 'Standings →' : 'Settlement →'}
              </button>

              <button className="btn ghost" onClick={() => setScreen('setup')} type="button">
                Setup
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'settlement' && round.game === 'skins' && settlement && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">Settlement</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Skins'}</div>
              <div className="small">Skins stake: {stakeLabel(round.stakeCents || 0)} (winner collects from each opponent)</div>
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
              <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                Quick mode
              </button>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                ← Back to holes
              </button>
              <button className="btn" onClick={copySettlement} type="button">
                Copy
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
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
                      <td colSpan={3} className="small">
                        No payments needed.
                      </td>
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
            <button className="btn" onClick={copySettlement} type="button">
              Copy settlement
            </button>
            <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
              Back
            </button>
          </div>
        </div>
      )}

      {screen === 'settlement' && round.game === 'wolf' && wolf && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <div className="label">Standings</div>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{round.name || 'Wolf'}</div>
              <div className="small">{wolfLabel(round.wolfPointsPerHole)} • Lone Wolf = {round.wolfLoneMultiplier || 2}x</div>
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
              <button className="btn ghost" onClick={() => setScreen('quick')} type="button">
                Quick mode
              </button>
              <button className="btn ghost" onClick={() => setScreen('holes')} type="button">
                ← Back to holes
              </button>
              <button className="btn ghost" onClick={resetSameGame} type="button">
                New round
              </button>
            </div>
          </div>

          <div style={{ height: 14 }} />

          <div className="label">Points by player</div>
          <table className="table">
            <tbody>
              {round.players
                .slice()
                .sort((a, b) => (wolf.pointsByPlayer[b.id] || 0) - (wolf.pointsByPlayer[a.id] || 0))
                .map((p) => (
                  <tr key={p.id}>
                    <td>{p.name}</td>
                    <td style={{ textAlign: 'right' }}>{wolf.pointsByPlayer[p.id] || 0}</td>
                  </tr>
                ))}
            </tbody>
          </table>

          <div style={{ height: 14 }} />

          <div className="small">Tip: pick Wolf partner per hole in Quick mode (or tap Lone).</div>
        </div>
      )}
    </div>
  )
}
