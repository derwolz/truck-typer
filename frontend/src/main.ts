import './styles.css'
import { Stats }        from './game/stats'
import { Timer }        from './game/timer'
import { PhysicsWorld } from './physics'
import { Cylinder }     from './cylinder'
import { Truck }        from './truck'
import { Settings, SettingsValues } from './settings'
import { Results }      from './results'

// ---------------------------------------------------------------------------
// DOM
// ---------------------------------------------------------------------------
const canvas = document.createElement('canvas')
canvas.id = 'physics-canvas'

const ui = document.createElement('div')
ui.id = 'ui'

const statsEl = document.createElement('pre')
statsEl.id = 'stats-panel'

const splash = document.createElement('div')
splash.id = 'splash'
splash.innerHTML = `
  <div class="splash-inner">
    <div class="splash-title">TYPIST</div>
    <div class="splash-prompt">&gt; PRESS ANY KEY TO BEGIN<span class="blink">_</span></div>
    <div class="splash-hint">[TAB] settings &nbsp;·&nbsp; [ESC] reset</div>
  </div>`

ui.appendChild(statsEl)
ui.appendChild(splash)

const appEl = document.getElementById('app')!
appEl.appendChild(canvas)
appEl.appendChild(ui)

// ---------------------------------------------------------------------------
// Game objects
// ---------------------------------------------------------------------------
type Phase = 'loading' | 'idle' | 'playing' | 'results'
let phase: Phase = 'loading'

const GAME_SECONDS = 60

const stats    = new Stats()
const physics  = new PhysicsWorld(canvas)
const cylinder = new Cylinder(ui)
const truck    = new Truck(appEl)
let settings: Settings
const results  = new Results(appEl)
settings       = new Settings(appEl, onSettingsChange)

const timer = new Timer(
  GAME_SECONDS,
  (remaining) => { timerRemaining = remaining },
  onTimerExpire,
)

let currentInput   = ''
let rafHandle      = 0
let truckTriggered = false
let timerRemaining = GAME_SECONDS

// ---------------------------------------------------------------------------
// Focus mode: track whether window has been interacted with this session
// ---------------------------------------------------------------------------
let windowInteracted = false
window.addEventListener('mousedown', () => { windowInteracted = true })
window.addEventListener('blur',      () => { windowInteracted = false })
window.addEventListener('focus',     () => { /* require click again */ })

// ---------------------------------------------------------------------------
// Word / sentence fetching
// ---------------------------------------------------------------------------
async function fetchWords(): Promise<string[]> {
  const mode = settings.current.mode
  const isSentences = mode === 'sentences'
  const api   = isSentences ? '/api/sentences' : '/api/words'
  const count = isSentences ? 50 : 200
  const res   = await fetch(`${api}?count=${count}`)
  if (!res.ok) throw new Error(`${res.status}`)
  const data  = await res.json() as { words: string[] }
  return data.words
}

async function loadInitial() {
  const words = await fetchWords()
  cylinder.init(words)
  phase = 'idle'
  splash.style.display = 'flex'
}

function refillCheck() {
  const threshold = settings.current.mode === 'sentences' ? 10 : 40
  if (cylinder.queueLength() < threshold) {
    fetchWords()
      .then(w => cylinder.enqueueWords(w))
      .catch(console.error)
  }
}

// ---------------------------------------------------------------------------
// Settings change — reload words when idle so new mode takes effect immediately
// ---------------------------------------------------------------------------
function onSettingsChange(_v: SettingsValues) {
  if (phase === 'playing' || phase === 'loading') return
  phase = 'loading'
  cylinder.hide()
  loadInitial().catch(console.error)
}

// ---------------------------------------------------------------------------
// Input handling
// ---------------------------------------------------------------------------
document.addEventListener('keydown', handleKey)

function handleKey(e: KeyboardEvent) {
  if (e.metaKey || e.ctrlKey || e.altKey) return

  // Settings panel captures all keys when open
  if (settings.handleKey(e)) return

  // Results panel: handled internally by Results.show()
  if (results.visible) return

  // Tab always opens settings (idle or playing)
  if (e.key === 'Tab') {
    e.preventDefault()
    settings.toggle()
    return
  }

  if (phase === 'idle') {
    if (e.key === 'Shift') return

    // Focus mode: require an explicit click before keystrokes start the game
    if (settings.current.focus && !windowInteracted) return

    e.preventDefault()
    startGame()
    return
  }

  if (phase !== 'playing') return

  if (e.key === 'Escape') { resetGame(); return }

  if (e.key === 'Backspace') {
    e.preventDefault()
    currentInput = currentInput.slice(0, -1)
    syncCylinder()
    return
  }

  const isSentences = settings.current.mode === 'sentences'

  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    // In sentences mode, space is a typeable character (part of the sentence).
    // Enter always confirms; space only confirms in words mode.
    if (isSentences && e.key === ' ') {
      const pos    = currentInput.length
      const target = cylinder.currentWord()
      const correct = target[pos] === ' '
      currentInput += ' '
      stats.start()
      stats.recordChar(correct)
      if (!correct) {
        const ox = window.innerWidth  * 0.55
        const oy = window.innerHeight * 0.67
        physics.spawnChar(' ', ox, oy, '#c33')
      }
      syncCylinder()
    } else {
      if (currentInput.length > 0) confirmWord()
    }
    return
  }

  if (e.key.length === 1) {
    e.preventDefault()
    const pos     = currentInput.length
    const target  = cylinder.currentWord()
    const correct = target[pos] === e.key
    currentInput += e.key
    stats.start()
    stats.recordChar(correct)

    if (!correct) {
      // Spawn the mistyped character as a dim red physics particle.
      // Use the cylinder scene's CSS anchor (top:67% left:55%) since the
      // current word's 3D-transformed element doesn't give a reliable rect.
      const ox = window.innerWidth  * 0.55
      const oy = window.innerHeight * 0.67
      physics.spawnChar(e.key, ox, oy, '#c33')
    }

    syncCylinder()

    // In sentences mode, auto-advance when the sentence is fully typed correctly.
    if (isSentences && currentInput === target) {
      confirmWord()
    }
  }
}

function syncCylinder() {
  const target  = cylinder.currentWord()
  const isError = currentInput.length > 0 && !target.startsWith(currentInput)
  cylinder.renderTypedState(currentInput, isError)
}

function confirmWord() {
  const word = cylinder.currentWord()
  if (!word) return
  stats.recordWordComplete(word.length)
  currentInput = ''
  cylinder.advance((completedWord, ox, oy) => {
    physics.spawnWord(completedWord, ox, oy)
  })
  refillCheck()
}

// ---------------------------------------------------------------------------
// Timer expiry → end game, show results
// ---------------------------------------------------------------------------
function onTimerExpire() {
  if (phase !== 'playing') return
  phase = 'results'
  cancelAnimationFrame(rafHandle)
  physics.stop()
  truck.destroy()

  const s   = stats.snapshot()
  const mode = settings.current.mode

  // Final stats render at 0
  renderStats(s.rawWPM, s.accuracy, 0, s.rawCorrect, s.rawWrong)

  results.show(s.rawWPM, s.accuracy, mode, () => {
    resetGame()
  })
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------
function startGame() {
  splash.style.display = 'none'
  phase          = 'playing'
  timerRemaining = GAME_SECONDS
  truckTriggered = false
  currentInput   = ''
  stats.reset()
  timer.reset()
  physics.start()
  cancelAnimationFrame(rafHandle)
  rafHandle = requestAnimationFrame(statsLoop)
}

function resetGame() {
  cancelAnimationFrame(rafHandle)
  timer.stop()
  physics.stop()
  physics.reset()
  truck.destroy()
  truckTriggered  = false
  timerRemaining  = GAME_SECONDS
  phase           = 'loading'
  currentInput    = ''
  stats.reset()
  statsEl.textContent = ''
  cylinder.hide()
  results.hide()
  loadInitial().catch(console.error)
}

// ---------------------------------------------------------------------------
// Stats panel render + game loop
// ---------------------------------------------------------------------------
const BOX = 13

function renderStats(wpm: number, accuracy: number, remaining: number, correct: number, wrong: number) {
  const top = '╔' + '═'.repeat(BOX) + '╗'
  const mid = '╠' + '═'.repeat(BOX) + '╣'
  const bot = '╚' + '═'.repeat(BOX) + '╝'
  const row = (t: string) => '║' + t.slice(0, BOX).padEnd(BOX) + '║'
  const num = (n: number, sfx = '') => '║' + (String(n) + sfx).padStart(BOX) + '║'

  const timeLabel = remaining <= 10 ? '  !! TIME !! ' : '  TIME LEFT  '
  const rawLine   = ('+' + correct).padStart(6) + ('  -' + wrong).padEnd(7)

  statsEl.textContent = [
    top,
    row('  WPM        '),
    num(wpm),
    mid,
    row('  ACCURACY   '),
    num(accuracy, '%'),
    mid,
    row('  RAW        '),
    row(rawLine),
    mid,
    row(timeLabel),
    num(remaining, 's'),
    bot,
  ].join('\n')
}

function statsLoop() {
  if (phase !== 'playing') return
  const s = stats.snapshot()

  // Start timer on first character typed
  if (s.elapsed > 0 && !timer.running) timer.start()

  renderStats(s.rawWPM, s.accuracy, timerRemaining, s.rawCorrect, s.rawWrong)

  // Truck trigger
  if (!truckTriggered && !truck.active && physics.maxPileHeight() >= 5) {
    truckTriggered = true
    truck.start(physics, () => { truckTriggered = false })
  }

  rafHandle = requestAnimationFrame(statsLoop)
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
loadInitial().catch(() => {
  const el = splash.querySelector('.splash-prompt')!
  el.innerHTML = '&gt; ERROR: server unreachable<span class="blink">_</span>'
})
