export type Command =
  | { kind: 'help' | 'status' | 'stop' | 'pause' | 'resume' | 'come' }
  | { kind: 'move'; dx: number; dz: number }
  | { kind: 'error'; message: string }

// Exact prefix protects against accidentally acting on casual player chat.
export function parseCommand(message: string): Command | null {
  const parts = message.trim().split(/\s+/)
  if (parts[0]?.toLowerCase() !== '!bot') return null
  if (parts.length === 1) return { kind: 'help' }
  const action = parts[1]?.toLowerCase()
  if (['help', 'status', 'stop', 'pause', 'resume', 'come'].includes(action ?? '')) {
    if (parts.length !== 2) return { kind: 'error', message: 'Unexpected arguments. Use !bot help.' }
    return { kind: action as 'help' | 'status' | 'stop' | 'pause' | 'resume' | 'come' }
  }
  if (action === 'move') {
    if (parts.length !== 4) return { kind: 'error', message: 'Usage: !bot move <dx> <dz> (within 16 blocks).' }
    const dx = Number(parts[2]); const dz = Number(parts[3])
    if (!Number.isSafeInteger(dx) || !Number.isSafeInteger(dz) ||
        Math.abs(dx) > 16 || Math.abs(dz) > 16 || Math.hypot(dx, dz) > 16 || (dx === 0 && dz === 0)) {
      return { kind: 'error', message: 'Move requires nonzero integer offsets within a 16-block radius.' }
    }
    return { kind: 'move', dx, dz }
  }
  return { kind: 'error', message: 'Unknown command. Use !bot help.' }
}

export function isAuthorized(username: string, owner: string, botName: string): boolean {
  return username === owner && username !== botName
}
