// Canvas-based letter physics.
// Words shatter on completion → letters fall with gravity → pile at bottom.
// Truck calls pushLettersNear() to scatter the pile rightward.

const GRAVITY       = 850    // px/s²
const BOUNCE_DAMP   = 0.28
const FRICTION      = 0.60
const SETTLE_SPEED  = 70     // settle when post-bounce |vy| < this
const CHAR_W        = 10.8   // monospace advance at 18px Courier New
const CHAR_H        = 22     // height slot for pile stacking
const FONT          = '18px "Courier New", Courier, monospace'

interface Particle {
  char:     string
  x:        number
  y:        number
  vx:       number
  vy:       number
  rotation: number
  rotVel:   number
  settled:  boolean
  color:    string   // rendered color (active and settled)
}

export class PhysicsWorld {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private active:  Particle[] = []
  private settled: Particle[] = []
  private pile:    Uint16Array        // pile[col] = letters in that column
  private lastTime = 0
  private rafHandle = 0

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx    = canvas.getContext('2d')!
    this.pile   = new Uint16Array(Math.ceil(window.innerWidth / CHAR_W) + 2)
    this.resize()
    window.addEventListener('resize', () => this.resize())
  }

  private resize() {
    this.canvas.width  = window.innerWidth
    this.canvas.height = window.innerHeight
    this.pile          = new Uint16Array(Math.ceil(window.innerWidth / CHAR_W) + 2)
    this.settled       = []
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  // Spawn letters from a completed word's center position.
  spawnWord(word: string, originX: number, originY: number) {
    const startX = originX - (word.length * CHAR_W) / 2

    for (let i = 0; i < word.length; i++) {
      const lx     = startX + i * CHAR_W
      const spread = (lx + CHAR_W / 2 - originX) * 0.4

      this.active.push({
        char:     word[i],
        x:        lx,
        y:        originY,
        vx:       spread + (Math.random() - 0.5) * 130,
        vy:       (Math.random() - 0.45) * 200 - 70,
        rotation: (Math.random() - 0.5) * 0.5,
        rotVel:   (Math.random() - 0.5) * 9,
        settled:  false,
        color:    '#fff',
      })
    }
  }

  // Spawn a single character (e.g. a mistyped key) with a custom color.
  spawnChar(char: string, originX: number, originY: number, color: string) {
    this.active.push({
      char,
      x:        originX,
      y:        originY,
      vx:       (Math.random() - 0.5) * 180,
      vy:       (Math.random() - 0.55) * 220 - 80,
      rotation: (Math.random() - 0.5) * 0.6,
      rotVel:   (Math.random() - 0.5) * 11,
      settled:  false,
      color,
    })
  }

  // Push settled letters near frontX off to the right (truck interaction).
  // Bottom 5 rows are shoved rightward; everything above tumbles free and falls.
  pushLettersNear(frontX: number, radius: number, vxMax: number, _vxMin: number, vyKick: number) {
    const pushed:   Particle[] = []
    const tumbled:  Particle[] = []
    const kept:     Particle[] = []
    const H           = this.canvas.height
    const BOTTOM_ROWS = 5

    for (const p of this.settled) {
      const dist = Math.abs(p.x - frontX)
      if (dist < radius) {
        const rowFromBot = Math.round((H - p.y) / CHAR_H)

        if (rowFromBot <= BOTTOM_ROWS) {
          // Bottom 5 rows: uniform block shove — velocity doesn't taper by distance
          p.vx      = vxMax
          p.vy      = vyKick
          p.rotation = (Math.random() - 0.5) * 0.3
          p.rotVel   = (Math.random() - 0.5) * 5
          p.settled  = false
          pushed.push(p)
        } else {
          // Upper rows: break loose and tumble to the floor
          p.vx      = (Math.random() - 0.5) * 220
          p.vy      = (Math.random() - 0.4) * 160
          p.rotation = (Math.random() - 0.5) * 0.6
          p.rotVel   = (Math.random() - 0.5) * 11
          p.settled  = false
          tumbled.push(p)
        }
      } else {
        kept.push(p)
      }
    }

    if (pushed.length === 0 && tumbled.length === 0) return

    this.settled = kept
    for (const p of pushed)   this.active.push(p)
    for (const p of tumbled)  this.active.push(p)

    // Rebuild pile from remaining settled letters
    this.pile.fill(0)
    for (const p of this.settled) {
      const col = Math.max(0, Math.min(Math.round(p.x / CHAR_W), this.pile.length - 1))
      this.pile[col]++
    }
  }

  maxPileHeight(): number {
    let max = 0
    for (let i = 0; i < this.pile.length; i++) {
      if (this.pile[i] > max) max = this.pile[i]
    }
    return max
  }

  start() {
    this.lastTime  = performance.now()
    this.rafHandle = requestAnimationFrame(t => this.loop(t))
  }

  stop() {
    cancelAnimationFrame(this.rafHandle)
  }

  reset() {
    this.active  = []
    this.settled = []
    this.pile.fill(0)
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
  }

  private loop(now: number) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05)
    this.lastTime = now
    this.update(dt)
    this.draw()
    this.rafHandle = requestAnimationFrame(t => this.loop(t))
  }

  private update(dt: number) {
    const W = this.canvas.width
    const H = this.canvas.height

    for (const p of this.active) {
      p.vy += GRAVITY * dt
      p.x  += p.vx * dt
      p.y  += p.vy * dt
      p.rotation += p.rotVel * dt

      // Left wall bounce
      if (p.x < 0) { p.x = 0; p.vx = Math.abs(p.vx) * 0.4 }

      // No right-wall bounce — letters fly off the right edge naturally

      // Pile surface collision
      const col     = Math.max(0, Math.floor(p.x / CHAR_W))
      const pileH   = this.pile[col] ?? 0
      const surface = H - pileH * CHAR_H - CHAR_H

      if (p.y >= surface) {
        p.y = surface
        if (Math.abs(p.vy) < SETTLE_SPEED) {
          // Snap to grid column and settle
          const snapCol = Math.max(0, Math.min(Math.round(p.x / CHAR_W), Math.floor(W / CHAR_W) - 1))
          const snapH   = this.pile[snapCol] ?? 0
          p.x           = snapCol * CHAR_W
          p.y           = H - snapH * CHAR_H - CHAR_H
          p.rotation    = 0
          p.rotVel      = 0
          p.settled     = true
          this.pile[snapCol] = snapH + 1
          this.settled.push(p)
        } else {
          p.vy    = -Math.abs(p.vy) * BOUNCE_DAMP
          p.vx   *= FRICTION
          p.rotVel *= 0.5
        }
      }
    }

    // Cull off-screen particles
    this.active = this.active.filter(p => !p.settled && p.x < W + 10 && p.x > -200)
  }

  private draw() {
    const ctx = this.ctx
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)
    ctx.font         = FONT
    ctx.textBaseline = 'top'

    // Settled pile — dim, per-particle color
    ctx.globalAlpha = 0.35
    for (const p of this.settled) {
      ctx.fillStyle = p.color
      ctx.fillText(p.char, p.x, p.y)
    }

    // Falling letters — full brightness with rotation, per-particle color
    ctx.globalAlpha = 1
    for (const p of this.active) {
      ctx.save()
      ctx.fillStyle = p.color
      ctx.translate(p.x + CHAR_W / 2, p.y + CHAR_H / 2)
      ctx.rotate(p.rotation)
      ctx.fillText(p.char, -CHAR_W / 2, -CHAR_H / 2)
      ctx.restore()
    }

    ctx.globalAlpha = 1
  }
}
