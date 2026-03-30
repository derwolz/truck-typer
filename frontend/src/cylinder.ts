// 3D vertical-cylinder word display — helix/corkscrew layout.
//
// Each word slot is a group <div> with transform: translateY + rotateY (no translateZ).
// Non-current words: each letter is an individual <span> inside the group with its own
//   rotateY(delta) translateZ(RADIUS) translateX(-50%)  — curving the word around the surface.
// Current word: a single flat <span> with translateZ(RADIUS) translateX(-50%) for typed display.
//
// Combined per-letter world transform:
//   translateY(-rel*LINE_H)  rotateY(rel*ANGLE_STEP + delta_i)  translateZ(RADIUS)  translateX(-50%)
// which is exactly the arc position for letter i on the helix.

const NUM_SLOTS  = 90
const ANGLE_STEP = 12       // degrees between consecutive words around the cylinder
const RADIUS     = 220      // px — cylinder radius
const LINE_H     = 18       // px — vertical step per word in the helix
const TRANS_MS   = 200      // CSS transition duration

const RECYCLE_OFFSET = Math.floor(NUM_SLOTS * 0.65)
const MAX_FRONT_DEG  = 70

export class Cylinder {
  private scene:     HTMLElement
  private groupEls:  HTMLElement[] = []
  private slotWords: string[]      = new Array(NUM_SLOTS).fill('')
  private wordQueue: string[]      = []
  private front      = 0
  private charAngle  = 2.8         // degrees per character — measured after font loads

  constructor(parent: HTMLElement) {
    this.scene    = document.createElement('div')
    this.scene.id = 'cylinder-scene'

    for (let k = 0; k < NUM_SLOTS; k++) {
      const g     = document.createElement('div')
      g.className = 'cy-group'
      this.groupEls.push(g)
      this.scene.appendChild(g)
    }

    parent.appendChild(this.scene)

    // Measure actual character width once fonts are loaded
    requestAnimationFrame(() => {
      const probe = document.createElement('span')
      probe.style.cssText =
        "position:absolute;visibility:hidden;font-size:18px;" +
        "font-family:'Courier New',Courier,monospace;white-space:nowrap;"
      probe.textContent = 'MMMMMMMMMM'
      this.scene.appendChild(probe)
      const cw = probe.getBoundingClientRect().width / 10
      this.scene.removeChild(probe)
      if (cw > 0) this.charAngle = Math.atan(cw / RADIUS) * (180 / Math.PI)
    })
  }

  init(words: string[]) {
    this.wordQueue = [...words]
    this.front     = 0

    for (const g of this.groupEls) g.style.transition = 'none'

    for (let k = 0; k < NUM_SLOTS; k++) {
      this.slotWords[k] = this.wordQueue.shift() ?? ''
    }

    this._updateAllTransforms(false)
    this._renderCurrentSlot('', false)
    this.scene.style.display = 'block'

    requestAnimationFrame(() => requestAnimationFrame(() => {
      for (const g of this.groupEls) {
        g.style.transition = `transform ${TRANS_MS}ms ease-out`
      }
    }))
  }

  currentWord(): string { return this.slotWords[this.front] }

  renderTypedState(typed: string, isError: boolean) {
    this._renderCurrentSlot(typed, isError)
  }

  advance(onSpawn: (word: string, ox: number, oy: number) => void) {
    const prevFront = this.front
    const word      = this.slotWords[prevFront]

    // Bounding rect from the inner flat word span
    const inner = this.groupEls[prevFront].querySelector('.cy-slot') as HTMLElement | null
    const rect  = (inner ?? this.groupEls[prevFront]).getBoundingClientRect()
    const ox    = rect.left + rect.width  / 2
    const oy    = rect.top  + rect.height / 2

    // Clear the completed word immediately (physics takes over)
    this.groupEls[prevFront].innerHTML = ''

    this.front = (this.front + 1) % NUM_SLOTS

    const recycleK = (this.front + RECYCLE_OFFSET) % NUM_SLOTS
    this.slotWords[recycleK] = this.wordQueue.shift() ?? ''

    this._updateAllTransforms(true)
    this._renderCurrentSlot('', false)

    setTimeout(() => onSpawn(word, ox, oy), TRANS_MS)
  }

  enqueueWords(words: string[]) { this.wordQueue.push(...words) }
  queueLength():  number         { return this.wordQueue.length  }
  show()  { this.scene.style.display = 'block' }
  hide()  { this.scene.style.display = 'none'  }

  // ─────────────────────────────────────────────────────────────────────────

  private _relPos(k: number): number {
    let rel = k - this.front
    if (rel >  NUM_SLOTS / 2) rel -= NUM_SLOTS
    if (rel <= -NUM_SLOTS / 2) rel += NUM_SLOTS
    return rel
  }

  private _updateAllTransforms(_animate: boolean) {
    for (let k = 0; k < NUM_SLOTS; k++) {
      const rel = this._relPos(k)
      const g   = this.groupEls[k]

      // Group only handles Y position + base rotation — no translateZ (letters do that)
      g.style.transform = `translateY(${-rel * LINE_H}px) rotateY(${rel * ANGLE_STEP}deg)`

      if (rel === 0) continue  // current word managed by _renderCurrentSlot

      if (rel < 0) {
        g.innerHTML = ''
        continue
      }

      const deg360   = ((rel * ANGLE_STEP) % 360 + 360) % 360
      const angleRad = deg360 * (Math.PI / 180)
      const cosA     = Math.cos(angleRad)

      let opacity: number
      let color:   string

      if (deg360 >= 90 && deg360 <= 270) {
        // Back face — dark gray, CSS naturally mirrors text
        opacity = Math.max(0, -cosA * 0.35)
        color   = '#555'
      } else if (deg360 < MAX_FRONT_DEG || deg360 > (360 - MAX_FRONT_DEG)) {
        // Front face — safe zone, white
        opacity = Math.max(0, cosA * 0.6)
        color   = '#fff'
      } else {
        // Transition zone (70°–90°, 270°–290°) — hide to avoid perspective-mirror artifact
        opacity = 0
        color   = '#fff'
      }

      this._renderLetters(k, opacity, color)
    }
  }

  // Render a non-current word as individual letter spans, each curved to the cylinder surface
  private _renderLetters(k: number, opacity: number, color: string) {
    const g    = this.groupEls[k]
    const word = this.slotWords[k]

    if (!word || opacity <= 0) {
      g.innerHTML = ''
      return
    }

    const len  = word.length
    const html = word.split('').map((ch, i) => {
      // Centre the word at the group's rotation angle; letter i fans out by delta degrees
      const delta = (i - (len - 1) / 2) * this.charAngle
      const tf    = `rotateY(${delta.toFixed(2)}deg) translateZ(${RADIUS}px) translateX(-50%)`
      const op    = opacity.toFixed(3)
      return `<span class="cy-letter" style="transform:${tf};opacity:${op};color:${color}">${esc(ch)}</span>`
    }).join('')

    g.innerHTML = html
  }

  // Render the current (active) word as a single flat span for typed-state highlighting
  private _renderCurrentSlot(typed: string, isError: boolean) {
    const g    = this.groupEls[this.front]
    const word = this.slotWords[this.front]

    g.style.transform = `translateY(0px) rotateY(0deg)`

    const innerHtml = this._buildHtml(word, typed, isError)
    g.innerHTML = `<span class="cy-slot current" style="transform:translateZ(${RADIUS}px) translateX(-50%)">${innerHtml}</span>`
  }

  private _buildHtml(word: string, typed: string, isError: boolean): string {
    const cursorSpan = (ch: string) => `<span class="w-cur-char">${esc(ch)}</span>`
    const remSpan    = (s: string)  => s ? `<span class="w-rem">${esc(s)}</span>` : ''

    let html = ''
    if (isError) {
      html += `<span class="w-err">${esc(typed)}</span>`
      if (typed.length < word.length) {
        html += cursorSpan(word[typed.length])
        html += remSpan(word.slice(typed.length + 1))
      }
    } else {
      if (typed.length > 0) html += `<span class="w-ok">${esc(typed)}</span>`
      if (typed.length < word.length) {
        html += cursorSpan(word[typed.length])
        html += remSpan(word.slice(typed.length + 1))
      }
    }
    return html
  }
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
