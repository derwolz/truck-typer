export class Timer {
  private duration:  number
  private remaining: number
  private startTs  = 0
  private rafId    = 0
  private _running = false

  private onTick:   (remaining: number) => void
  private onExpire: () => void

  constructor(
    durationSeconds: number,
    onTick:   (remaining: number) => void,
    onExpire: () => void,
  ) {
    this.duration  = durationSeconds
    this.remaining = durationSeconds
    this.onTick    = onTick
    this.onExpire  = onExpire
  }

  get running()   { return this._running }
  get timeLeft()  { return Math.ceil(this.remaining) }

  start() {
    if (this._running) return
    this._running = true
    this.startTs  = performance.now()
    this._tick()
  }

  stop() {
    this._running = false
    cancelAnimationFrame(this.rafId)
  }

  reset() {
    this.stop()
    this.remaining = this.duration
  }

  private _tick() {
    const elapsed  = (performance.now() - this.startTs) / 1000
    this.remaining = Math.max(0, this.duration - elapsed)
    this.onTick(Math.ceil(this.remaining))
    if (this.remaining <= 0) {
      this._running = false
      this.onExpire()
      return
    }
    this.rafId = requestAnimationFrame(() => this._tick())
  }
}
