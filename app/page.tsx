'use client';

/**
 * Tag Arena — Real-Time Game Client (Direct Mode)
 *
 * Players move around a canvas arena. One player is "it" (red glow)
 * and must tag others. Tagged player becomes "it".
 *
 * Flow: Usion.init → game.connectDirect → game.join → game.realtime → game.onRealtime
 *
 * SDK: @usions/sdk (browser) + @usions/game-server (server)
 */

import Script from 'next/script';

export default function GamePage() {
  return (
    <>
      <Script src="/usion-sdk.js" strategy="beforeInteractive" />

      <Script id="game-logic" strategy="afterInteractive">{`
(function() {
  'use strict';

  var ARENA_W = 800;
  var ARENA_H = 600;
  var PLAYER_R = 18;
  var MOVE_SPEED = 5;
  var INPUT_RATE_MS = 50;
  var COLORS = ['#4FC3F7','#FF7043','#66BB6A','#AB47BC','#FFCA28','#EF5350','#26C6DA','#8D6E63'];

  var state = {
    phase: 'connecting',
    myId: null,
    players: {},
    keys: { up: false, down: false, left: false, right: false },
    error: null,
    tagFlash: null,
  };

  var canvas, ctx;
  var lastInputSent = 0;

  // ─── Input ──────────────────────────────────────────────
  var KEY_MAP = {
    ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
    w: 'up', s: 'down', a: 'left', d: 'right',
    W: 'up', S: 'down', A: 'left', D: 'right',
  };

  window.addEventListener('keydown', function(e) {
    var dir = KEY_MAP[e.key];
    if (dir) { state.keys[dir] = true; e.preventDefault(); }
  });
  window.addEventListener('keyup', function(e) {
    var dir = KEY_MAP[e.key];
    if (dir) { state.keys[dir] = false; e.preventDefault(); }
  });

  // ─── Touch Controls ────────────────────────────────────
  var touchStart = null;
  window.addEventListener('touchstart', function(e) {
    var t = e.touches[0];
    touchStart = { x: t.clientX, y: t.clientY };
  });
  window.addEventListener('touchmove', function(e) {
    if (!touchStart) return;
    e.preventDefault();
    var t = e.touches[0];
    var dx = t.clientX - touchStart.x;
    var dy = t.clientY - touchStart.y;
    var deadzone = 10;
    state.keys.left = dx < -deadzone;
    state.keys.right = dx > deadzone;
    state.keys.up = dy < -deadzone;
    state.keys.down = dy > deadzone;
  }, { passive: false });
  window.addEventListener('touchend', function() {
    touchStart = null;
    state.keys = { up: false, down: false, left: false, right: false };
  });

  // ─── Render ─────────────────────────────────────────────
  function render() {
    if (!ctx) return;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, ARENA_W, ARENA_H);

    // Grid
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1;
    for (var x = 0; x < ARENA_W; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, ARENA_H); ctx.stroke();
    }
    for (var y = 0; y < ARENA_H; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(ARENA_W, y); ctx.stroke();
    }

    // Tag flash effect
    if (state.tagFlash && Date.now() - state.tagFlash < 300) {
      ctx.fillStyle = 'rgba(255, 50, 0, 0.15)';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
    }

    // Players
    var players = Object.values(state.players);
    players.forEach(function(p) {
      // "It" player has red glow
      if (p.isIt) {
        ctx.shadowColor = '#ff3300';
        ctx.shadowBlur = 20;
      }

      ctx.fillStyle = p.isIt ? '#ff3300' : (p.color || '#4FC3F7');
      ctx.beginPath();
      ctx.arc(p.x, p.y, PLAYER_R, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // "IT" label
      if (p.isIt) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('IT', p.x, p.y + 4);
      }

      // Name
      ctx.fillStyle = '#ccc';
      ctx.font = '11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(p.name || 'Player', p.x, p.y - PLAYER_R - 8);

      // Score
      ctx.fillStyle = '#888';
      ctx.font = '9px system-ui';
      ctx.fillText('Tags: ' + (p.score || 0), p.x, p.y - PLAYER_R - 20);

      // "You" ring
      if (p.id === state.myId) {
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(p.x, p.y, PLAYER_R + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    });

    // HUD
    ctx.fillStyle = '#666';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText('WASD / Arrow keys to move', 10, ARENA_H - 12);

    var me = state.players[state.myId];
    if (me) {
      ctx.textAlign = 'right';
      ctx.fillStyle = me.isIt ? '#ff3300' : '#4FC3F7';
      ctx.fillText(me.isIt ? 'YOU ARE IT!' : 'RUN!', ARENA_W - 10, ARENA_H - 12);
    }

    // Overlays
    if (state.phase === 'waiting') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.fillStyle = '#fff';
      ctx.font = '24px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for players...', ARENA_W / 2, ARENA_H / 2);
      ctx.font = '14px system-ui';
      ctx.fillStyle = '#888';
      ctx.fillText('Need at least 2 players', ARENA_W / 2, ARENA_H / 2 + 30);
    } else if (state.phase === 'finished') {
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, ARENA_W, ARENA_H);
      ctx.fillStyle = '#fff';
      ctx.font = '28px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', ARENA_W / 2, ARENA_H / 2 - 20);

      // Show scoreboard
      var sorted = players.slice().sort(function(a, b) { return (b.score || 0) - (a.score || 0); });
      sorted.forEach(function(p, i) {
        ctx.font = '14px system-ui';
        ctx.fillStyle = i === 0 ? '#FFD700' : '#aaa';
        ctx.fillText(p.name + ': ' + (p.score || 0) + ' tags', ARENA_W / 2, ARENA_H / 2 + 20 + i * 24);
      });
    }

    // Error
    if (state.error) {
      ctx.fillStyle = '#ff4444';
      ctx.font = '13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(state.error, ARENA_W / 2, 20);
    }
  }

  // ─── Game Loop ──────────────────────────────────────────
  function gameLoop() {
    var now = Date.now();

    if (state.phase === 'playing' && now - lastInputSent >= INPUT_RATE_MS) {
      var dx = (state.keys.right ? 1 : 0) - (state.keys.left ? 1 : 0);
      var dy = (state.keys.down ? 1 : 0) - (state.keys.up ? 1 : 0);

      if (dx !== 0 || dy !== 0) {
        Usion.game.realtime('move', { dx: dx, dy: dy });

        // Local prediction
        var me = state.players[state.myId];
        if (me) {
          var len = Math.sqrt(dx*dx + dy*dy);
          var speedMult = me.isIt ? 0.9 : 1.0;
          me.x = Math.max(PLAYER_R, Math.min(ARENA_W - PLAYER_R, me.x + (dx/len)*MOVE_SPEED*speedMult));
          me.y = Math.max(PLAYER_R, Math.min(ARENA_H - PLAYER_R, me.y + (dy/len)*MOVE_SPEED*speedMult));
        }

        lastInputSent = now;
      }
    }

    render();
    requestAnimationFrame(gameLoop);
  }

  // ─── SDK Init ───────────────────────────────────────────
  Usion.init(function(config) {
    state.myId = config.userId;

    Usion.game.connectDirect()
      .then(function() { return Usion.game.join(config.roomId); })
      .then(function() {
        state.phase = 'waiting';
        render();
      })
      .catch(function(err) {
        state.error = 'Connection failed: ' + err.message;
        render();
      });

    Usion.game.onPlayerJoined(function() {
      state.phase = 'playing';
      render();
    });

    Usion.game.onStateUpdate(function(data) {
      var gs = data.game_state || data.payload?.game_state || data;
      if (gs.players) state.players = gs.players;
      if (gs.phase) state.phase = gs.phase;
    });

    Usion.game.onRealtime(function(data) {
      var d = data.action_data || data;

      // Tag event
      if (d.type === 'tag' || data.action_type === 'tag') {
        state.tagFlash = Date.now();
        return;
      }

      // Position update
      if (d.player_id && d.x !== undefined) {
        if (state.players[d.player_id]) {
          state.players[d.player_id].x = d.x;
          state.players[d.player_id].y = d.y;
        }
      }
    });

    Usion.game.onGameFinished(function() {
      state.phase = 'finished';
      render();
    });

    Usion.game.onPlayerLeft(function(data) {
      delete state.players[data.player_id];
      render();
    });

    Usion.game.onError(function(data) {
      state.error = data.message || 'Error occurred';
      render();
    });

    Usion.game.onDisconnect(function() {
      state.error = 'Disconnected';
      render();
    });

    Usion.game.onReconnect(function() {
      state.error = null;
      render();
    });
  });

  // ─── Canvas Setup ───────────────────────────────────────
  // Script runs via afterInteractive so DOM is already ready
  var app = document.getElementById('app');
  if (app) {
    app.innerHTML =
      '<canvas id="game-canvas" width="' + ARENA_W + '" height="' + ARENA_H + '"></canvas>';
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    gameLoop();
  }
})();
      `}</Script>

      <div id="app" />

      <style jsx global>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { height: 100%; background: #000; overflow: hidden; }

        #app {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 100vh;
        }

        canvas {
          max-width: 100vw;
          max-height: 100vh;
          border: 1px solid #222;
          border-radius: 4px;
        }
      `}</style>
    </>
  );
}
