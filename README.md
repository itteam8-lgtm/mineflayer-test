# Minecraft Companion — Phase 3, Milestone 1

**Status: prototype source; not live-LAN verified.** This milestone implements connection/bootstrap, command authorization, bounded navigation, pause/stop, controlled reconnect, and command validation. **No mining, caves, exploration, combat, crafting, eating, AI, or persistence yet.**

## Compatibility gate (checked November 9, 2026)

- Target **Minecraft Java Edition 26.3**, released September 15, 2026.
- Upstream Mineflayer 4.39.0 documentation currently lists support through **26.1**, not native 26.3.
- ViaProxy **3.4.14** can translate between the Mineflayer 26.1 protocol and a 26.3 world (first supported in ViaProxy 3.4.13). This is a documented community workaround, not a tested guarantee for this project.
- Package versions in `package.json` are exact. **A dependency lockfile could not be generated here** because npm registry downloads were unavailable. Generate and commit `package-lock.json` when `npm install` succeeds on your machine; use `npm ci` after that.
- Other options (experimental unreleased Mineflayer PRs or third-party Mineflayer forks) are deliberately excluded from this baseline.

### Useful upstream references
- [Mineflayer supported versions](https://github.com/PrismarineJS/mineflayer)
- [Mineflayer 26.3 discussion, ViaProxy workaround](https://github.com/PrismarineJS/mineflayer/discussions/4190)
- [ViaProxy releases](https://github.com/ViaVersion/ViaProxy/releases)
- [ViaProxy README](https://github.com/ViaVersion/ViaProxy)

## Installation (Windows PowerShell)

1. Install Node.js 22 LTS or 24 LTS, and Java 25 or newer for Minecraft 26.3 if needed. The Node runtime and dependency combination still needs installation verification.
2. Extract the ZIP to a local folder and open PowerShell in its root.
3. Run:

   ```powershell
   node --version
   npm install
   npm run build
   npm test
   Copy-Item .env.example .env
   ```

4. Edit `.env` with a text editor. The default connects to **ViaProxy on the same PC**, not directly to a 26.3 LAN server. Set `MC_OWNER` to your **exact in-game username**, and `MC_USERNAME` to a separate bot username.

## LAN and Microsoft authentication (important)

For most Java worlds opened with **Open to LAN**, the game shows `Local game hosted on port NNNNN` in chat. Find the host PC's local IPv4 address (via `ipconfig` on Windows). Host and bot must be on the same reachable LAN, and Windows firewall must allow the connection.

**Recommended bridge for Java 26.3**:

1. Download ViaProxy **3.4.14** from the official GitHub releases (download the usual Java jar). Verify the release against the official repository; do not use unknown download mirrors.
2. Open your 26.3 world to LAN and note `<LAN_IP>:<LAN_PORT>`.
3. From the ViaProxy jar's folder (example filename `ViaProxy-3.4.14.jar`):

   ```powershell
   java -jar .\ViaProxy-3.4.14.jar cli --target-address 192.168.1.10:51234 --target-version 26.3
   ```

   Replace that example IP and port with your real LAN host and port. The community-documented CLI proxy normally listens locally on **port 25568**.
4. **Authenticated/online-mode connection:** Use ViaProxy's Accounts GUI to add **the bot's own** Microsoft/Minecraft Java account, not your active human session. Then append `--minecraft-account-index 0` to the CLI command if the bot account is at account index 0. ViaProxy handles upstream authentication; the Mineflayer-to-local-proxy connection uses `MC_AUTH=offline` and `MC_USERNAME=CompanionBot`. **This flow must be tested with the actual LAN host and its authentication setup.**
5. Keep the proxy bound to the loopback interface / Windows firewall restricted to local access. Never expose its offline-auth listener to the network or internet. Confirm the proxy's listen address in its runtime config before connecting.
6. Configure `.env`:

   ```ini
   MC_HOST=127.0.0.1
   MC_PORT=25568
   MC_VERSION=26.1
   MC_AUTH=offline
   MC_USERNAME=CompanionBot
   MC_OWNER=YourExactMinecraftName
   ```

7. Start the bot:

   ```powershell
   npm run dev
   ```

**Direct Microsoft auth (future native protocol support):** Once an upstream Mineflayer release explicitly supports Minecraft 26.3, set `MC_HOST` and `MC_PORT` to the actual LAN target, `MC_VERSION=26.3`, `MC_AUTH=microsoft`, and `MC_USERNAME` to the bot Minecraft account email. Follow any device-login prompts according to the Mineflayer release documentation. Do **not** put Microsoft passwords or auth tokens into `.env` or source code. This direct 26.3 path is **not supported by the currently pinned Mineflayer 4.39.0 baseline**.

## Bot commands (only `MC_OWNER` can invoke)

| In-game command | Behavior |
| --- | --- |
| `!bot help` | Show available commands |
| `!bot status` | Show ready/moving/paused status |
| `!bot move 6 0` | Attempt safe movement six blocks in X direction |
| `!bot move 0 -5` | Attempt movement five blocks in negative Z direction |
| `!bot come` | Approach owner's currently visible entity (maximum 48 blocks) |
| `!bot pause` | Cancel current movement and prevent starting new movement |
| `!bot resume` | Allow new commands; does not restart a cancelled path |
| `!bot stop` | Cancel active movement immediately |

Moving is limited to relative integers within a 16-block radius. Attempts time out after 30 seconds. No digging, pillar-building, placing, parkour, or intentional long falls. These restrictions are not an absolute safety guarantee; **test in a disposable world before using survival items or valuable terrain**.

`!bot come` in Milestone 1 is a short-range action: the owner must be in the bot's currently known world data. Distant autonomous exploration and independent return navigation are planned for later milestones.

## Validation checklist

**Local checks**

```powershell
npm run build
npm test
```

**Live LAN checks (must be done on your actual world and account)**

1. Open a disposable backup world, then the ViaProxy listener; ensure Mineflayer logs `Spawned`.
2. Confirm the bot is visible as a separate Minecraft player.
3. As the owner, issue `!bot status`. Confirm a response.
4. As a second player, issue `!bot move 3 0` and confirm **no movement**.
5. From the owner, issue `!bot move 3 0`. Verify actual movement and stop at a safe location.
6. Issue `!bot come` while close, and `!bot stop` while moving; verify immediate cancellation.
7. Issue `!bot pause`, then a movement request; ensure movement does not start until `!bot resume`.
8. Close the LAN world; verify bounded retries and no infinite login storm. Test a deliberate kick separately; reconnect must be disabled.
9. Respawn/dimension-change or reconnect; confirm a single movement controller, no duplicated chat replies, and no stale movement goal.

## Design and limitations

- One Mineflayer session, one MovementController per session.
- When a new movement command arrives, the old path is explicitly cancelled before starting a new goal.
- The bot will only execute chat commands whose username exactly matches `MC_OWNER`. This is a basic identity check; it assumes the authenticated server and local proxy cannot be impersonated.
- World state is treated as authoritative; pathfinding can fail due to unloaded terrain, collision or protocol translation.
- `spawn` can repeat on respawn; no duplicate plugin installation occurs.
- Unexpected disconnect retries are bounded; kicks stop retries. Reconnect exhaustion currently requires a process restart.
- Listener teardown, dynamic chat throttling and navigation cancellation are included. Mission persistence is **out of scope**.
- **No npm install, TypeScript build against dependencies, or live Mineflayer/Viaproxy connection has been executed in this environment.**

## Next milestone (not included)

Survival: eating, safe threat response, inventory/equipment management, and controlled defensive behavior.
