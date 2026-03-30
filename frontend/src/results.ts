// ---------------------------------------------------------------------------
// Cookie helpers for personal leaderboard (JS-readable)
// ---------------------------------------------------------------------------
function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}
function setCookie(name: string, value: string) {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; max-age=${365 * 24 * 3600}; path=/; SameSite=Lax`
}

// Minimal HTML escaping for text embedded in innerHTML
function he(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Personal leaderboard persisted in a cookie
// ---------------------------------------------------------------------------
interface PersonalEntry { wpm: number; accuracy: number; mode: string; at: number }

function loadPersonal(): PersonalEntry[] {
  try { return JSON.parse(getCookie('typist_pb')) || [] } catch { return [] }
}
function savePersonal(wpm: number, accuracy: number, mode: string): PersonalEntry[] {
  const pb = loadPersonal()
  pb.push({ wpm, accuracy, mode, at: Date.now() })
  pb.sort((a, b) => b.wpm - a.wpm)
  const top = pb.slice(0, 10)
  setCookie('typist_pb', JSON.stringify(top))
  return top
}

// ---------------------------------------------------------------------------
// Public leaderboard entry shape
// ---------------------------------------------------------------------------
export interface LeaderEntry {
  wpm:      number
  accuracy: number
  at:       number
  name?:    string
}

// ---------------------------------------------------------------------------
// Results overlay
// ---------------------------------------------------------------------------
export class Results {
  private el:    HTMLElement       // <pre> container
  private _name  = ''              // preserved across re-renders
  private _posted = false

  constructor(parent: HTMLElement) {
    this.el          = document.createElement('pre')
    this.el.id       = 'results-panel'
    this.el.style.display = 'none'
    parent.appendChild(this.el)
  }

  get visible() { return this.el.style.display !== 'none' }

  /**
   * If the user already has a saved name (cookie): post score immediately, show leaderboard,
   * then wait for Enter/Escape to restart.
   *
   * If no name saved yet: show name input first (one-time), then same flow above.
   */
  async show(
    wpm:      number,
    accuracy: number,
    mode:     string,
    onRestart: () => void,
  ) {
    this._posted = false
    this._name   = getCookie('typist_name')
    const hasName = this._name.trim().length > 0

    this.el.style.display = 'block'
    const personal = savePersonal(wpm, accuracy, mode)

    if (hasName) {
      // ── Known user: post immediately, no name input ──
      this._render(wpm, accuracy, mode, personal, null, true)
      this._posted = true

      let publicLb: LeaderEntry[] | null = null
      try {
        const res  = await fetch('/api/scores', {
          method:      'POST',
          headers:     { 'Content-Type': 'application/json' },
          credentials: 'include',
          body:        JSON.stringify({ wpm, accuracy, mode, name: this._name }),
        })
        const data = await res.json() as { leaderboard?: LeaderEntry[] }
        publicLb   = data.leaderboard ?? []
      } catch { publicLb = [] }

      this._render(wpm, accuracy, mode, personal, publicLb, true)

      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          document.removeEventListener('keydown', handler)
          this.hide()
          onRestart()
        }
      }
      document.addEventListener('keydown', handler)
      return
    }

    // ── New user: show name input ──
    this._render(wpm, accuracy, mode, personal, null, false)
    this._focusInput()

    const handler = async (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        document.removeEventListener('keydown', handler)
        this.hide()
        onRestart()
        return
      }

      if (e.key === 'Enter') {
        e.preventDefault()

        if (!this._posted) {
          // ── Phase 1: save name, submit score ──
          this._posted = true

          const inp = this.el.querySelector('#rni') as HTMLInputElement | null
          if (inp) this._name = inp.value
          const name = this._name.trim().slice(0, 16)
          if (name) setCookie('typist_name', name)

          this._render(wpm, accuracy, mode, personal, null, true)

          let publicLb: LeaderEntry[] | null = null
          try {
            const res  = await fetch('/api/scores', {
              method:      'POST',
              headers:     { 'Content-Type': 'application/json' },
              credentials: 'include',
              body:        JSON.stringify({ wpm, accuracy, mode, name }),
            })
            const data = await res.json() as { leaderboard?: LeaderEntry[] }
            publicLb   = data.leaderboard ?? []
          } catch { publicLb = [] }

          this._render(wpm, accuracy, mode, personal, publicLb, true)

        } else {
          // ── Phase 2: restart ──
          document.removeEventListener('keydown', handler)
          this.hide()
          onRestart()
        }
      }
    }
    document.addEventListener('keydown', handler)
  }

  hide() {
    this._name   = ''
    this._posted = false
    this.el.style.display = 'none'
  }

  // ---------------------------------------------------------------------------
  private _focusInput() {
    requestAnimationFrame(() => {
      const inp = this.el.querySelector('#rni') as HTMLInputElement | null
      if (inp) {
        inp.focus()
        inp.setSelectionRange(inp.value.length, inp.value.length)
        inp.addEventListener('input', (ev) => {
          this._name = (ev.target as HTMLInputElement).value
        })
      }
    })
  }

  private _render(
    wpm:      number,
    accuracy: number,
    mode:     string,
    personal: PersonalEntry[],
    publicLb: LeaderEntry[] | null,
    submitted: boolean,
  ) {
    // Preserve any name the user has typed before overwriting innerHTML
    const existing = this.el.querySelector('#rni') as HTMLInputElement | null
    if (existing) this._name = existing.value

    const W       = 30
    const top     = '╔' + '═'.repeat(W) + '╗'
    const mid     = '╠' + '═'.repeat(W) + '╣'
    const bot     = '╚' + '═'.repeat(W) + '╝'
    // row(): text rows with box borders
    const row     = (s: string) => '║ ' + s.slice(0, W - 1).padEnd(W - 1) + '║'
    const modeLabel = mode === 'sentences' ? 'SENTENCES' : 'WORDS'

    const fmtDate = (ms: number) => {
      const d = new Date(ms)
      return `${d.getMonth() + 1}/${d.getDate()}`
    }

    const personalMode = personal.filter(e => (e.mode ?? 'words') === mode)

    // Build as HTML strings (all user content is he()-escaped)
    const lines: string[] = [
      he(top),
      he(row(`  1-MIN · ${modeLabel}`)),
      he(mid),
    ]

    if (!submitted) {
      // Embed a real <input> for the name, inline within the pre.
      // Box interior is W=30 chars: "  NAME: " (8) + input (20ch) + "  " (2) = 30
      const safeVal = he(this._name)
      lines.push(
        `║  NAME: <input id="rni" class="rni" type="text" value="${safeVal}" maxlength="16" autocomplete="off" spellcheck="false" placeholder="your name">  ║`
      )
      lines.push(he(mid))
    }

    lines.push(
      he(row(`  WPM       ${String(wpm).padStart(4)}`)),
      he(row(`  ACCURACY  ${String(accuracy).padStart(3)}%`)),
      he(mid),
    )

    // Personal best
    lines.push(he(row(`  PERSONAL BEST · ${modeLabel}`)))
    if (personalMode.length === 0) {
      lines.push(he(row('  (none yet)')))
    } else {
      personalMode.slice(0, 5).forEach((e, i) => {
        lines.push(he(row(
          `  ${i + 1}.  ${String(e.wpm).padStart(3)} WPM  ${String(e.accuracy).padStart(3)}%  ${fmtDate(e.at)}`
        )))
      })
    }

    lines.push(he(mid))
    lines.push(he(row(`  PUBLIC · ${modeLabel}`)))

    if (publicLb === null) {
      lines.push(he(row('  loading...')))
    } else if (publicLb.length === 0) {
      lines.push(he(row('  (no scores yet)')))
    } else {
      publicLb.slice(0, 10).forEach((e, i) => {
        const namePart = e.name ? `  ${e.name.slice(0, 10)}` : ''
        lines.push(he(row(
          `  ${String(i + 1).padStart(2)}.  ${String(e.wpm).padStart(3)} WPM  ${String(e.accuracy).padStart(3)}%${namePart}`
        )))
      })
    }

    lines.push(he(mid))
    if (!submitted) {
      lines.push(he(row('  [ENTER] submit  [ESC] skip')))
    } else {
      lines.push(he(row('  [ENTER] restart')))
    }
    lines.push(he(bot))

    this.el.innerHTML = lines.join('\n')

    if (!submitted) this._focusInput()
  }
}
