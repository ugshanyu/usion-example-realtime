/**
 * Pure game logic — no networking, no side effects.
 * This file is importable and testable independently.
 */

const ARENA_WIDTH = 800;
const ARENA_HEIGHT = 600;
const PLAYER_RADIUS = 18;
const MOVE_SPEED = 5;
const TAG_RADIUS = PLAYER_RADIUS * 2;
const COLORS = ['#4FC3F7', '#FF7043', '#66BB6A', '#AB47BC', '#FFCA28', '#EF5350', '#26C6DA', '#8D6E63'];

/**
 * Create initial state for a new player.
 */
export function createPlayer(userId, name, index) {
  return {
    id: userId,
    name: name,
    x: 100 + (index * 200) % (ARENA_WIDTH - 200),
    y: 100 + Math.floor(index / 3) * 200,
    score: 0,
    color: COLORS[index % COLORS.length],
    isIt: false,
  };
}

/**
 * Apply a movement input to a player.
 * Returns the updated player object.
 */
export function applyInput(player, input) {
  const dx = typeof input.dx === 'number' ? input.dx : 0;
  const dy = typeof input.dy === 'number' ? input.dy : 0;

  // Normalize diagonal movement
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return player;

  const ndx = (dx / len) * MOVE_SPEED;
  const ndy = (dy / len) * MOVE_SPEED;

  // "It" player moves slightly slower
  const speedMult = player.isIt ? 0.9 : 1.0;

  return {
    ...player,
    x: Math.max(PLAYER_RADIUS, Math.min(ARENA_WIDTH - PLAYER_RADIUS, player.x + ndx * speedMult)),
    y: Math.max(PLAYER_RADIUS, Math.min(ARENA_HEIGHT - PLAYER_RADIUS, player.y + ndy * speedMult)),
  };
}

/**
 * Check if the tagger can tag the target.
 * Returns true if a tag occurs.
 */
export function checkTag(tagger, target) {
  if (!tagger.isIt) return false;
  const dx = tagger.x - target.x;
  const dy = tagger.y - target.y;
  return Math.sqrt(dx * dx + dy * dy) < TAG_RADIUS;
}

/**
 * Process a tag: swap "it" status and update scores.
 * Returns updated copies of both players.
 */
export function processTag(tagger, target) {
  return {
    tagger: { ...tagger, isIt: false, score: tagger.score + 1 },
    target: { ...target, isIt: true },
  };
}
