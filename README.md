# Tag Arena

A real-time multiplayer tag game built on the **Usion platform** using **direct mode** (WebSocket to custom server).

Players move around a canvas arena. One player is "it" (red glow) and must tag others. Tagged player becomes "it". Server validates all movement and collisions.

## Quick Start

```bash
npm install

# Configure environment
cp .env.example .env
# Edit .env with your SERVICE_ID and USION_SHARED_SECRET

# Start the game server (WebSocket)
npm run dev:server

# In another terminal, start the Next.js client
npm run dev
```

## Architecture

```
Usion App ──token──> Your Server (server.js)
    │                    │
    └── WebSocket ───────┘
         (direct mode)
```

This game uses **direct mode** — clients connect directly to your WebSocket server. The Usion backend only issues RS256 access tokens. All game traffic goes directly between clients and your server.

## How It Works

1. Player opens game in Usion app
2. Usion backend issues RS256 access token
3. Client connects to your server via WebSocket with token
4. `@usions/game-server` validates token automatically
5. Server manages room lifecycle and broadcasts state at 20fps
6. Client sends real-time input via `Usion.game.realtime('move', {dx, dy})`
7. Server validates movement, checks tag collisions, broadcasts state
8. When a tag occurs, "it" status swaps and scores update

## SDK Methods Used

### Client (`@usions/sdk`)

| Method | Purpose |
|--------|---------|
| `Usion.init(callback)` | Initialize SDK, receive userId and roomId |
| `Usion.game.connectDirect()` | Connect directly to game server WebSocket |
| `Usion.game.join(roomId)` | Join the game room |
| `Usion.game.realtime(type, data)` | Send high-frequency input (movement) |
| `Usion.game.onStateUpdate(cb)` | Receive full state snapshots |
| `Usion.game.onRealtime(cb)` | Receive real-time updates |
| `Usion.game.onPlayerJoined(cb)` | Detect when players join |
| `Usion.game.onPlayerLeft(cb)` | Detect when players leave |
| `Usion.game.onGameFinished(cb)` | Match completion |

### Server (`@usions/game-server`)

| Method | Purpose |
|--------|---------|
| `new UsionGameServer(opts)` | Create server with config |
| `server.onPlayerJoin(cb)` | Handle validated player connections |
| `server.onPlayerLeave(cb)` | Handle disconnections |
| `server.onRealtime(type, cb)` | Handle high-frequency input |
| `server.onForfeit(cb)` | Handle player forfeit |
| `server.onRematch(cb)` | Handle rematch requests |
| `server.submitResult(roomId, data)` | Submit match results to Usion |
| `server.listen(cb)` | Start the server |
| `room.broadcast(type, data)` | Send to all players in room |
| `room.broadcastExcept(id, type, data)` | Send to all except one |
| `room.getState()` / `room.setState()` | Room state management |

## Key Files

| File | Purpose |
|------|---------|
| `server.js` | UsionGameServer setup with event handlers |
| `server/game-logic.js` | Pure game logic (movement, collision, scoring) |
| `app/page.tsx` | Canvas client with input handling |
| `lib/types.ts` | TypeScript type definitions |
| `lib/constants.ts` | Arena size, speed, colors |
| `public/usion-sdk.js` | Usion SDK browser bundle |

## Game Logic

Game logic is separated into `server/game-logic.js` with pure functions:

- `createPlayer(userId, name, index)` — Spawn at position with color
- `applyInput(player, {dx, dy})` — Bounded movement (it-player is slightly slower)
- `checkTag(tagger, target)` — Collision detection for tagging
- `processTag(tagger, target)` — Swap "it" status, increment score

## Controls

- **Desktop**: WASD or Arrow keys
- **Mobile**: Touch and drag in any direction

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SERVICE_ID` | Your game's service ID on Usion |
| `USION_SHARED_SECRET` | HMAC secret for result submission |
| `USION_KEY_ID` | Signing key ID (default: 'default') |
| `API_URL` | Usion backend URL |
| `PORT` | Server port (default: 3004) |

## npm Packages

- [`@usions/sdk`](https://www.npmjs.com/package/@usions/sdk) — Usion Mini App SDK (client)
- [`@usions/game-server`](https://www.npmjs.com/package/@usions/game-server) — Server SDK for direct-mode games

## License

MIT
