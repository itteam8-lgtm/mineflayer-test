import 'dotenv/config'
import { createBot, type Bot } from 'mineflayer'
import { pathfinder } from 'mineflayer-pathfinder'
import { loadConfig } from './config'
import { parseCommand, isAuthorized, type Command } from './commands'
import { MovementController } from './movement'

const config = loadConfig()
let currentBot: Bot | null = null
let currentMovement: MovementController | null = null
let reconnectTimer: NodeJS.Timeout | null = null
let failures = 0
let shuttingDown = false
let connected = false
let nextChatAt = 0
let chatTimer: NodeJS.Timeout | null = null
const chatQueue: Array<{ bot: Bot; message: string }> = []

function flushChat(): void {
  chatTimer = null
  if (!connected || shuttingDown) { chatQueue.length = 0; return }
  const delay = nextChatAt - Date.now()
  if (delay > 0) { chatTimer = setTimeout(flushChat, delay); return }
  const entry = chatQueue.shift()
  if (entry && entry.bot === currentBot) {
    nextChatAt = Date.now() + config.chatCooldownMs
    try { entry.bot.chat(entry.message.substring(0, 180)) } catch (err) {
      console.error('[chat] Send failed:', err instanceof Error ? err.message : String(err))
    }
  }
  if (chatQueue.length) chatTimer = setTimeout(flushChat, config.chatCooldownMs)
}

function send(bot: Bot, message: string): void {
  if (!connected || shuttingDown || bot !== currentBot) return
  if (chatQueue.length >= 4) chatQueue.shift()
  chatQueue.push({ bot, message })
  if (!chatTimer) flushChat()
}

async function execute(bot: Bot, movement: MovementController, command: Command): Promise<void> {
  switch (command.kind) {
    case 'help': send(bot, '!bot status | move <dx> <dz> | come | pause | resume | stop'); break
    case 'status': send(bot, `State: ${movement.state} | version: ${bot.version ?? 'unknown'}`); break
    case 'stop': movement.stop(); send(bot, 'Movement stopped.'); break
    case 'pause': movement.pause(); send(bot, 'Paused. Use !bot resume to enable movement.'); break
    case 'resume': movement.resume(); send(bot, 'Ready for commands.'); break
    case 'error': send(bot, command.message); break
    case 'move': {
      if (movement.state === 'paused') { send(bot, 'Paused. Use !bot resume first.'); break }
      send(bot, `Moving relative: ${command.dx}, ${command.dz}`)
      const result = await movement.moveRelative(command.dx, command.dz)
      if (result !== 'cancelled') send(bot, result === 'arrived' ? 'Destination reached.' : 'Could not reach destination.')
      break
    }
    case 'come': {
      if (movement.state === 'paused') { send(bot, 'Paused. Use !bot resume first.'); break }
      send(bot, 'Trying to reach your location.')
      const result = await movement.comeToOwner(config.owner)
      if (result !== 'cancelled') send(bot,
        result === 'arrived' ? 'I am nearby.' :
        result === 'too-far' ? 'Too far for Milestone 1 (48-block maximum).' :
        result === 'not-visible' ? 'I cannot currently locate your player entity.' : 'No safe path found.')
      break
    }
  }
}

function connect(): void {
  if (shuttingDown) return
  connected = false
  console.log(`[bot] Connecting to ${config.host}:${config.port} using ${config.version} (${config.auth}).`)
  const bot = createBot({
    host: config.host,
    port: config.port,
    username: config.username,
    version: config.version,
    auth: config.auth,
    hideErrors: false
  })
  bot.loadPlugin(pathfinder)
  currentBot = bot
  const movement = new MovementController(bot)
  currentMovement = movement
  let kicked = false
  let spawned = false

  bot.on('spawn', () => {
    if (bot !== currentBot || shuttingDown) return
    movement.stop()
    movement.setup()
    connected = true
    spawned = true
    failures = 0
    console.log(`[bot] Spawned with ${bot.version}. Owner: ${config.owner}`)
  })
  bot.on('chat', (username: string, message: string) => {
    if (!connected || shuttingDown || bot !== currentBot) return
    const command = parseCommand(message)
    if (!command) return
    if (!isAuthorized(username, config.owner, bot.username)) {
      console.warn('[security] Ignored command from an unauthorized player.')
      return
    }
    void execute(bot, movement, command).catch(err => {
      console.error('[command]', err instanceof Error ? err.message : String(err))
    })
  })
  bot.on('kicked', reason => {
    kicked = true
    console.error('[bot] Kicked. Automatic reconnect disabled:', String(reason).slice(0, 300))
  })
  bot.on('error', err => { console.error('[bot] Error:', err.message) })
  bot.on('end', reason => {
    connected = false
    chatQueue.length = 0
    if (chatTimer) clearTimeout(chatTimer)
    chatTimer = null
    movement.dispose()
    if (bot === currentBot) { currentBot = null; currentMovement = null }
    console.warn(`[bot] Connection ended (${String(reason).slice(0, 150)}); spawned=${spawned}.`)
    if (shuttingDown || kicked || failures >= config.reconnectAttempts) {
      console.warn('[bot] Not reconnecting. Check connection/auth and restart manually.')
      return
    }
    failures++
    const delay = Math.min(30000, 1500 * 2 ** (failures - 1)) + Math.floor(Math.random() * 500)
    console.log(`[bot] Reconnect ${failures}/${config.reconnectAttempts} in ${delay}ms`)
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect() }, delay)
  })
}

function shutdown(): void {
  if (shuttingDown) return
  shuttingDown = true
  if (reconnectTimer) clearTimeout(reconnectTimer)
  if (chatTimer) clearTimeout(chatTimer)
  chatQueue.length = 0
  currentMovement?.dispose()
  try { currentBot?.quit('Owner stopped bot') } catch { /* disconnected */ }
  console.log('[bot] Shutdown requested.')
  setTimeout(() => process.exit(process.exitCode ?? 0), 1000).unref()
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
process.on('unhandledRejection', error => {
  console.error('[fatal] Unhandled rejection. Shutting down:', error)
  process.exitCode = 1
  shutdown()
})
process.on('uncaughtException', error => {
  console.error('[fatal] Uncaught exception. Shutting down:', error)
  process.exitCode = 1
  shutdown()
})
connect()
