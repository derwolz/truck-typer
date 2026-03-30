import type { PhysicsWorld } from './physics'

const TRUCK_SPEED  = 420    // px/s
const PILE_CHAR_W  = 10.8   // physics pile character width — used for push radius
const PUSH_RADIUS  = PILE_CHAR_W * 5   // 5-column block push
const PUSH_VX_MAX  = 1400
const PUSH_VX_MIN  = 1200
const PUSH_VY      = -200

// ASCII art truck — minimum indent stripped, trailing whitespace trimmed
const ART = [
  '                   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '                   @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@',
  '                  @@@                                                                 @@',
  '                 @@@                                                                  @@',
  '                @@@                                                                   @@',
  '               @@@@@                                                                  @@',
  '               @@@@@@@@@@@@@@@@@@                                                     @@',
  '              @@@@  @@@@        @@                                                    @@',
  '             @@@@@@ @@@@        @@                                                    @@',
  '            @@@@@@@@@@@@        @@                                                    @@',
  '            @@@ @@@@@@@@       @@                                                     @@',
  '          @@@@ @@@@ @ @@@@@@@@@@                                                      @@',
  '       @@@@@@  @@@@  @   @@@@@@                                                       @@',
  '    @@@@@@@@    @@                                                                    @@',
  '  @@@@@@                                                                              @@',
  '  @@@                                                                                 @@',
  '  @@                                                                                  @@',
  '  @@            @@@@@@@                                         @@@@                  @@',
  '  @@         @@@@@   @@@@@                                  @@@@@  @@@@@              @@',
  '  @@        @@@ @@@@@@@ @@@                                @@@@@ @@ @@@@@             @@',
  '@@@@       @@@@@@@@@@@@@@@@@                              @@ @@@@@@@@@@ @@           @@@@@',
  '@@@@@@@@@@@@@@@@@@   @@@@@@@@    @ @                     @@ @ @@@  @@@@@@@@          @@@@@',
  '@@@@@@@@@@@@@@ @@@@ @ @@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@@@@@@@ @@@@@@@@@@@@@@@@@@@',
  ' @@@        @@@@@ @@@ @@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@@ @@ @@@@@@@@@@@@@@@@@@@@@@',
  '             @@@@@@@@@@@@@                                 @@@@@@@@@@@@@@',
  '              @@@@@@@@@@@                                   @@@@@@@@@@@',
  '               @@@@@@@@@                                     @@@@@@@@@',
].join('\n')

export class Truck {
  private el: HTMLElement
  private rafHandle = 0
  private _active   = false
  private startX    = 0

  constructor(parent: HTMLElement) {
    this.el = document.createElement('pre')
    this.el.id = 'truck'
    this.el.textContent = ART
    this.el.style.display = 'none'
    parent.appendChild(this.el)
  }

  get active(): boolean { return this._active }

  start(physics: PhysicsWorld, onComplete: () => void) {
    if (this._active) return
    this._active = true

    // Display first so offsetWidth is measurable, then park off-screen left
    this.el.style.display = 'block'
    const truckW  = this.el.offsetWidth
    this.startX   = -(truckW + 40)
    this.el.style.left = `${this.startX}px`

    const begin = performance.now()

    const tick = (now: number) => {
      const elapsed = (now - begin) / 1000
      const left    = this.startX + TRUCK_SPEED * elapsed
      this.el.style.left = `${left}px`

      // Bumper is at the right edge of the art
      const bumperX = left + truckW
      physics.pushLettersNear(bumperX, PUSH_RADIUS, PUSH_VX_MAX, PUSH_VX_MIN, PUSH_VY)

      if (bumperX > window.innerWidth + 100) {
        this._active          = false
        this.el.style.display = 'none'
        onComplete()
        return
      }

      this.rafHandle = requestAnimationFrame(tick)
    }

    this.rafHandle = requestAnimationFrame(tick)
  }

  destroy() {
    cancelAnimationFrame(this.rafHandle)
    this._active          = false
    this.el.style.display = 'none'
  }
}
