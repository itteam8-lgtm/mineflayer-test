
export type Config = {
  host: string
  port: number
  version: string
  auth: 'offline' | 'microsoft'
  username: string
  owner: string
  reconnectAttempts: number
  chatCooldownMs: number
}

function integer(name: string, raw: string, min: number, max: number): number {
  const value = Number(raw)
  if (!Number.isSafeInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`)
  }
  return value
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const host = env.MC_HOST?.trim()
  const username = env.MC_USERNAME?.trim()
  const owner = env.MC_OWNER?.trim()
  const version = env.MC_VERSION?.trim()
  const auth = env.MC_AUTH?.trim()
  if (!host || !username || !owner || !version) throw new Error('MC_HOST, MC_USERNAME, MC_OWNER, and MC_VERSION are required')
  if (auth !== 'offline' && auth !== 'microsoft') throw new Error('MC_AUTH must be offline or microsoft')
  if (username === owner) throw new Error('MC_OWNER must differ from MC_USERNAME')
  if (!/^[a-zA-Z0-9_]{3,16}$/.test(owner)) throw new Error('MC_OWNER must be an exact valid Java username')
  if (auth === 'offline' && !/^[a-zA-Z0-9_]{3,16}$/.test(username)) {
    throw new Error('MC_USERNAME must be a valid Java username when MC_AUTH=offline')
  }
  return {
    host,
    port: integer('MC_PORT', env.MC_PORT ?? '25568', 1, 65535),
    version,
    auth,
    username,
    owner,
    reconnectAttempts: integer('MC_RECONNECT_ATTEMPTS', env.MC_RECONNECT_ATTEMPTS ?? '3', 0, 10),
    chatCooldownMs: integer('MC_CHAT_COOLDOWN_MS', env.MC_CHAT_COOLDOWN_MS ?? '1200', 500, 10000)
  }
}
