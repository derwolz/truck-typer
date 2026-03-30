// ---------------------------------------------------------------------------
// Cookie helpers (JS-readable, no HttpOnly)
// ---------------------------------------------------------------------------
function getCookie(name: string): string {
  const m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'))
  return m ? decodeURIComponent(m[1]) : ''
}
function setCookie(name: string, value: string) {
  document.cookie =
    `${name}=${encodeURIComponent(value)}; max-age=${365 * 24 * 3600}; path=/; SameSite=Lax`
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type GameMode = 'words' | 'sentences'

export interface SettingsValues {
  mode:  GameMode
  focus: boolean   // require window click before accepting keystrokes
}

// ---------------------------------------------------------------------------
// Settings panel
// ---------------------------------------------------------------------------
export class Settings {
  private el:       HTMLElement
  private values:   SettingsValues
  private onChange: (v: SettingsValues) => void

  constructor(parent: HTMLElement, onChange: (v: SettingsValues) => void) {
    this.onChange = onChange
    this.values   = {
      mode:  (getCookie('typist_mode') as GameMode) || 'words',
      focus: getCookie('typist_focus') === 'true',
    }

    this.el          = document.createElement('pre')
    this.el.id       = 'settings-panel'
    this.el.style.display = 'none'
    parent.appendChild(this.el)
    this._render()
  }

  get visible() { return this.el.style.display !== 'none' }
  get current() { return { ...this.values } }

  show()   { this.el.style.display = 'block'; this._render() }
  hide()   { this.el.style.display = 'none' }
  toggle() { this.visible ? this.hide() : this.show() }

  /** Returns true if the event was consumed (panel is open). */
  handleKey(e: KeyboardEvent): boolean {
    if (!this.visible) return false
    e.preventDefault()
    switch (e.key) {
      case 'Escape': case 'Tab': this.hide(); break
      case 'm': case 'M':       this._toggleMode();  break
      case 'f': case 'F':       this._toggleFocus(); break
    }
    return true
  }

  private _toggleMode() {
    this.values.mode = this.values.mode === 'words' ? 'sentences' : 'words'
    setCookie('typist_mode', this.values.mode)
    this._render()
    this.onChange(this.values)
  }

  private _toggleFocus() {
    this.values.focus = !this.values.focus
    setCookie('typist_focus', String(this.values.focus))
    this._render()
    this.onChange(this.values)
  }

  private _render() {
    const W   = 26
    const top = '╔' + '═'.repeat(W) + '╗'
    const mid = '╠' + '═'.repeat(W) + '╣'
    const bot = '╚' + '═'.repeat(W) + '╝'
    const row = (s: string) => '║ ' + s.padEnd(W - 1) + '║'
    const sel = (label: string, on: boolean) => on ? `[${label}]` : ` ${label} `

    const m = this.values.mode
    const f = this.values.focus

    this.el.textContent = [
      top,
      row('  SETTINGS               '),
      mid,
      row('  MODE               [M] '),
      row(`  ${sel('WORDS', m === 'words')}  ${sel('SENTENCES', m === 'sentences')}    `),
      mid,
      row('  FOCUS MODE         [F] '),
      row(`  ${sel('OFF', !f)}  ${sel('ON', f)}                `),
      row('  (require click before  '),
      row('   typing registers)     '),
      mid,
      row('  [ESC] or [TAB] close   '),
      bot,
    ].join('\n')
  }
}
