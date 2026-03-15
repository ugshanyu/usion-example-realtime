/**
 * Tag Arena — Game Server (Direct Mode)
 *
 * Players move around an arena. One player is "it" and tries to
 * tag others. Tagged player becomes "it". Server is authoritative.
 *
 * Uses @usions/game-server for token validation, WebSocket management,
 * and HMAC-signed result submission.
 *
 * Start: node server.js
 */
import { UsionGameServer } from '@usions/game-server';
import { createPlayer, applyInput, checkTag, processTag } from './server/game-logic.js';

const PORT = Number(process.env.PORT || 3004);
const MAX_PLAYERS = 4;
const TICK_RATE = 20; // 20fps state broadcast

const server = new UsionGameServer({
  serviceId: process.env.SERVICE_ID || 'tag-arena',
  sharedSecret: process.env.USION_SHARED_SECRET || 'dev-secret',
  keyId: process.env.USION_KEY_ID || 'default',
  apiUrl: process.env.API_URL || 'http://localhost:8089',
  port: PORT,
  maxPlayersPerRoom: MAX_PLAYERS,
});

// Track game tick intervals per room
const roomTicks = new Map();

// ─── Player Join ─────────────────────────────────────────────

server.onPlayerJoin((player, room) => {
  console.log(`[${room.id}] Player joined: ${player.name} (${player.id})`);

  const players = room.getState().players || {};
  const playerState = createPlayer(player.id, player.name, Object.keys(players).length);

  // First player is "it"
  if (Object.keys(players).length === 0) {
    playerState.isIt = true;
  }

  players[player.id] = playerState;
  room.setState({ players, phase: 'waiting' });

  // Start game when 2+ players
  if (room.playerCount >= 2) {
    room.setState({ phase: 'playing' });

    // Start game tick loop for this room
    if (!roomTicks.has(room.id)) {
      const interval = setInterval(() => {
        if (room.playerCount === 0) {
          clearInterval(interval);
          roomTicks.delete(room.id);
          return;
        }
        room.broadcast('state_snapshot', {
          room_id: room.id,
          game_state: room.getState(),
        });
      }, 1000 / TICK_RATE);
      roomTicks.set(room.id, interval);
    }

    // Send initial state
    room.broadcast('state_snapshot', {
      room_id: room.id,
      game_state: room.getState(),
    });
  }
});

// ─── Player Leave ────────────────────────────────────────────

server.onPlayerLeave((player, room) => {
  console.log(`[${room.id}] Player left: ${player.name}`);

  const state = room.getState();
  const wasIt = state.players?.[player.id]?.isIt;

  if (state.players) {
    delete state.players[player.id];
    room.setState({ players: state.players });
  }

  // If the "it" player left, assign to someone else
  if (wasIt && room.playerCount > 0) {
    const remaining = Object.values(state.players);
    if (remaining.length > 0) {
      remaining[0].isIt = true;
      room.setState({ players: state.players });
    }
  }

  // If only one player left during game, they win
  if (room.playerCount === 1 && state.phase === 'playing') {
    const winnerId = room.playerIds[0];
    room.setState({ phase: 'finished' });

    room.broadcast('match_end', {
      room_id: room.id,
      winner_ids: [winnerId],
      reason: 'opponent_left',
    });

    // Stop tick loop
    if (roomTicks.has(room.id)) {
      clearInterval(roomTicks.get(room.id));
      roomTicks.delete(room.id);
    }

    server.submitResult(room.id, {
      winnerIds: [winnerId],
      reason: 'opponent_left',
    }).catch(err => console.error('Result submission failed:', err.message));
  }

  // Clean up empty rooms
  if (room.playerCount === 0 && roomTicks.has(room.id)) {
    clearInterval(roomTicks.get(room.id));
    roomTicks.delete(room.id);
  }
});

// ─── Real-time Input (fire-and-forget, high frequency) ───────

server.onRealtime('move', (data, player, room) => {
  const state = room.getState();
  if (!state.players || state.phase !== 'playing') return;

  const playerState = state.players[player.id];
  if (!playerState) return;

  // Apply movement
  state.players[player.id] = applyInput(playerState, data);

  // Check for tag collisions if this player is "it"
  if (state.players[player.id].isIt) {
    for (const [otherId, other] of Object.entries(state.players)) {
      if (otherId === player.id) continue;
      if (checkTag(state.players[player.id], other)) {
        const result = processTag(state.players[player.id], other);
        state.players[player.id] = result.tagger;
        state.players[otherId] = result.target;

        // Notify all players of the tag
        room.broadcast('tag', {
          tagger: player.id,
          tagged: otherId,
        });
        break; // Only one tag per tick
      }
    }
  }

  room.setState({ players: state.players });
});

// ─── Forfeit ─────────────────────────────────────────────────

server.onForfeit((player, room) => {
  console.log(`[${room.id}] ${player.name} forfeited`);

  const winnerIds = room.playerIds.filter(id => id !== player.id);
  room.setState({ phase: 'finished' });

  room.broadcast('match_end', {
    room_id: room.id,
    winner_ids: winnerIds,
    reason: 'forfeit',
  });

  if (roomTicks.has(room.id)) {
    clearInterval(roomTicks.get(room.id));
    roomTicks.delete(room.id);
  }

  server.submitResult(room.id, {
    winnerIds,
    reason: 'forfeit',
  }).catch(err => console.error('Result submission failed:', err.message));
});

// ─── Rematch ─────────────────────────────────────────────────

server.onRematch((player, room) => {
  console.log(`[${room.id}] ${player.name} requests rematch`);
});

// ─── Start Server ────────────────────────────────────────────

server.listen(() => {
  console.log(`Tag Arena server ready on port ${PORT}`);
});
