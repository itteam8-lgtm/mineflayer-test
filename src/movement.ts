import type { Bot } from 'mineflayer'
import { Movements, goals } from 'mineflayer-pathfinder'

const MOVE_TIMEOUT_MS = 30000
const MAX_OWNER_DISTANCE = 48

type MovementResult = 'arrived' | 'cancelled' | 'failed'

export class MovementController {
  private generation = 0
  private isMoving = false
  private paused = false
  private disposed = false
  private cancelCurrent: (() => void) | null = null

  constructor(private readonly bot: Bot) {}

  get state(): string {
    if (this.disposed) return 'disconnected'
    if (this.paused) return 'paused'
    return this.isMoving ? 'moving' : 'idle'
  }

  setup(): void {
    if (this.disposed) return
    const movements = new Movements(this.bot)
    movements.canDig = false
    movements.allow1by1towers = false
    movements.allowParkour = false
    movements.allowSprinting = false
    movements.canOpenDoors = false
    movements.maxDropDown = 1
    movements.scafoldingBlocks = [] // no placing blocks for navigation
    this.bot.pathfinder.setMovements(movements)
  }

  pause(): void {
    this.paused = true
    this.stop()
  }

  resume(): void { this.paused = false }

  stop(): void {
    this.generation += 1
    this.isMoving = false
    const cancel = this.cancelCurrent
    this.cancelCurrent = null
    cancel?.()
    try { this.bot.pathfinder.setGoal(null) } catch { /* may be disconnected */ }
    try { this.bot.pathfinder.stop() } catch { /* may be disconnected */ }
    try { this.bot.clearControlStates() } catch { /* may be disconnected */ }
  }

  dispose(): void {
    this.stop()
    this.disposed = true
  }

  async moveRelative(dx: number, dz: number): Promise<MovementResult> {
    const p = this.bot.entity?.position
    if (!p) return 'failed'
    return this.moveTo(p.x + dx, p.y, p.z + dz)
  }

  async comeToOwner(ownerName: string): Promise<MovementResult | 'too-far' | 'not-visible'> {
    const ownerEntity = this.bot.players[ownerName]?.entity
    const current = this.bot.entity?.position
    if (!current || !ownerEntity) return 'not-visible'
    if (current.distanceTo(ownerEntity.position) > MAX_OWNER_DISTANCE) return 'too-far'
    const p = ownerEntity.position
    return this.moveTo(p.x, p.y, p.z, 2)
  }

  private async moveTo(x: number, y: number, z: number, radius = 1): Promise<MovementResult> {
    if (this.disposed || this.paused) return 'cancelled'
    this.stop() // one active path at a time
    const token = ++this.generation
    this.isMoving = true
    let localTimer: ReturnType<typeof setTimeout> | undefined
    const abort = new Promise<never>((_resolve, reject) => {
      this.cancelCurrent = () => reject(new Error('navigation cancelled'))
      localTimer = setTimeout(() => reject(new Error('navigation timeout')), MOVE_TIMEOUT_MS)
    })
    try {
      await Promise.race([
        this.bot.pathfinder.goto(new goals.GoalNear(Math.floor(x), Math.floor(y), Math.floor(z), radius)),
        abort
      ])
      return token === this.generation ? 'arrived' : 'cancelled'
    } catch (err) {
      if (token !== this.generation) return 'cancelled'
      console.error('[movement]', err instanceof Error ? err.message : String(err))
      this.stop() // explicitly cancel failed/timed-out navigation
      return 'failed'
    } finally {
      if (localTimer) clearTimeout(localTimer)
      if (token === this.generation) {
        this.isMoving = false
        this.cancelCurrent = null
      }
    }
  }
}
