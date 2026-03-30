import { prepareWithSegments, layoutWithLines } from '@chenglou/pretext'

export interface TowerLine {
  words: string[]
  text: string
}

const FONT = '18px "Courier New", Courier, monospace'
const LINE_HEIGHT_PX = 28
const CYLINDER_RADIUS = 300 // px — virtual cylinder radius
const PERSPECTIVE_PX = 700  // px — CSS perspective distance
const MAX_ANGLE_RAD = (72 * Math.PI) / 180
const LINES_SHOWN = 14      // max lines visible (including current at pos=0)
// arc length per line = LINE_HEIGHT_PX, so angle per line = arc / radius
const ARC_STEP_RAD = LINE_HEIGHT_PX / CYLINDER_RADIUS

// Break a flat word array into lines that fit within pixelWidth using pretext.
// Returns lines in reading order: [0] = first line to type (goes at bottom).
export function breakIntoLines(words: string[], pixelWidth: number): TowerLine[] {
  const text = words.join(' ')
  const prepared = prepareWithSegments(text, FONT)
  const { lines } = layoutWithLines(prepared, pixelWidth, LINE_HEIGHT_PX)
  return lines.map(line => {
    const trimmed = line.text.trim()
    return { text: trimmed, words: trimmed.split(/\s+/).filter(Boolean) }
  })
}

// ---------------------------------------------------------------------------
// Tower renderer
//
// Data model:
//   lines[0] = current line (rendered at bottom, pos=0)
//   lines[1] = next upcoming (pos=1, just above current)
//   lines[n] = further upcoming (higher up, more curved/dim)
//
// The visual metaphor: you're climbing a tower. Upcoming words are visible
// above you, curving away. As you type, the current line vanishes and the
// next line drops to the bottom (you've climbed up).
// ---------------------------------------------------------------------------
export class Tower {
  private container: HTMLElement
  // lines[0] = current, lines[n] = n-th upcoming (reading order)
  private lines: TowerLine[] = []
  private typedInLine = 0
  private currentWordTyped = ''
  private currentWordError = false
  // Called when the user completes a full line (game should append more lines)
  onLineComplete: (() => void) | null = null

  constructor(container: HTMLElement) {
    this.container = container
    this.container.style.cssText = [
      'position:relative',
      'width:100%',
      'height:100%',
      `perspective:${PERSPECTIVE_PX}px`,
      'perspective-origin:50% 100%',
    ].join(';')
  }

  // Load initial set of lines. lines[0] = first to type (bottom).
  load(lines: TowerLine[]) {
    this.lines = [...lines]
    this.typedInLine = 0
    this.currentWordTyped = ''
    this.currentWordError = false
    this.render()
  }

  // Append more upcoming lines to the end of the buffer.
  appendLines(newLines: TowerLine[]) {
    const wasLow = this.lines.length < LINES_SHOWN
    this.lines.push(...newLines)
    if (wasLow) this.render()
  }

  // Update the typed-so-far state for the current word.
  updateTyped(typed: string, isError: boolean) {
    this.currentWordTyped = typed
    this.currentWordError = isError
    this.refreshCurrentLine()
  }

  // Called when the user confirms a word (presses space).
  advanceWord() {
    this.typedInLine++
    this.currentWordTyped = ''
    this.currentWordError = false
    if (this.typedInLine >= this.currentLine.words.length) {
      this.scrollUp()
    } else {
      this.refreshCurrentLine()
    }
  }

  getCurrentWord(): string {
    return this.currentLine.words[this.typedInLine] ?? ''
  }

  private get currentLine(): TowerLine {
    return this.lines[0] ?? { words: [], text: '' }
  }

  private scrollUp() {
    this.lines.shift() // current line is done — next upcoming becomes current
    this.typedInLine = 0
    this.currentWordTyped = ''
    this.currentWordError = false
    this.render()
    this.onLineComplete?.()
  }

  private render() {
    this.container.innerHTML = ''
    const count = Math.min(this.lines.length, LINES_SHOWN)
    // Render highest pos first so current line (pos=0) is appended last
    // and sits on top in the DOM stacking order.
    for (let pos = count - 1; pos >= 0; pos--) {
      const el = document.createElement('div')
      el.className = 'tower-line'
      el.dataset.pos = String(pos)
      this.applyLineStyle(el, pos)
      if (pos === 0) {
        el.innerHTML = this.buildCurrentLineHTML()
      } else {
        el.textContent = this.lines[pos].text
      }
      this.container.appendChild(el)
    }
  }

  private refreshCurrentLine() {
    const el = this.container.querySelector<HTMLElement>('[data-pos="0"]')
    if (el) el.innerHTML = this.buildCurrentLineHTML()
  }

  private applyLineStyle(el: HTMLElement, pos: number) {
    const angleRad = pos * ARC_STEP_RAD
    if (angleRad > MAX_ANGLE_RAD) {
      el.style.display = 'none'
      return
    }
    const angleDeg = (angleRad * 180) / Math.PI
    // Project onto the screen: y-distance from bottom = R * sin(θ)
    const yOnScreen = CYLINDER_RADIUS * Math.sin(angleRad)
    // Foreshortening factor as we rotate away
    const cosA = Math.cos(angleRad)
    const opacity = pos === 0 ? 1 : Math.max(0.08, cosA * 0.75)

    el.style.cssText = [
      'position:absolute',
      'left:0',
      'right:0',
      'white-space:nowrap',
      'overflow:hidden',
      `bottom:${yOnScreen.toFixed(1)}px`,
      `transform:rotateX(${angleDeg.toFixed(2)}deg) scaleY(${cosA.toFixed(3)})`,
      'transform-origin:bottom center',
      `opacity:${opacity.toFixed(3)}`,
    ].join(';')
  }

  private buildCurrentLineHTML(): string {
    const words = this.currentLine.words
    const parts: string[] = []

    for (let i = 0; i < words.length; i++) {
      const word = words[i]
      if (i < this.typedInLine) {
        // Already typed — dim
        parts.push(`<span class="w-done">${esc(word)}</span>`)
      } else if (i === this.typedInLine) {
        // Currently typing
        const typed = this.currentWordTyped
        let inner = ''
        if (this.currentWordError) {
          // Inverted block for the wrong input
          inner += `<span class="w-err">${esc(typed)}</span>`
          inner += `<span class="w-rem">${esc(word.slice(typed.length))}</span>`
        } else {
          if (typed.length > 0) {
            inner += `<span class="w-ok">${esc(typed)}</span>`
          }
          inner += `<span class="w-rem">${esc(word.slice(typed.length))}</span>`
        }
        inner += '<span class="cursor">_</span>'
        parts.push(`<span class="w-cur">${inner}</span>`)
      } else {
        // Upcoming within this line
        parts.push(`<span class="w-up">${esc(word)}</span>`)
      }
    }
    return parts.join(' ')
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
