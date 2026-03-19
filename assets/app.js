/* ================================================================
   Bachelor Control Panel — app.js
   All state lives in localStorage['bcp_state']
   ================================================================ */

'use strict';

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════

const STATE_KEY = 'bcp_state';

const DEFAULTS = {
  players: ['Felix', 'Erik', 'Jonas', 'Max', 'Oskar', 'Bachelor'],
  bachelorName: 'Bachelor',
  riggedMode: false,
  weights: { Bachelor: 1.6 },          // keyed by player name; missing = 1.0
  partyModeLevel: 0,                   // 0–5
  soundsOn: false,
  hapticsOn: true,
  wheelItems: [
    '🍺 Down your drink',
    '🕺 Dad dance 30 sec',
    '📞 Call an ex — say hi',
    '🎤 Sing 30 sec of a song',
    '💃 Twerk attempt',
    '🤳 Cringe selfie to group chat',
    '🍋 Lemon shot, no chaser',
    '🦆 Walk like a duck — 60 sec',
    '💌 Text a random contact "You up?"',
    '🙈 Best impression of the Bachelor',
  ],
  scoreCategories: [
    '🤮 Most Embarrassing',
    '🍺 Drinks Down',
    '📱 Phone Checks',
    '😴 Almost Slept',
    '🤡 Biggest Fail',
    '💃 Best Dance Move',
  ],
  scores: {},          // { playerName: { category: count } }
  decisionAnswers: [
    'ABSOLUTELY NOT 🚫',
    'YES AND FILM IT 📹',
    'Only if {{NAME}} pays 💸',
    'Ask {{NAME}} first 🤔',
    'The spirits say… YES 🎱',
    'HELL YES! 🔥',
    'Maybe after one more drink… 🍺',
    'Your future self says NO 🚫',
    'THE GROUP DEMANDS IT 👥',
    'Signs point to regret 🔮',
    'ONLY IF {{NAME}} GOES FIRST',
    'Fortune favors the bold! GO!',
    '{{NAME}} will never forgive you. Do it.',
    'Three words: Don\'t. Do. It.',
    'Certified bad idea. Certified fun. YES!',
  ],
  log: [],             // { ts, text, photoDataUrl }
  blameReasons: [
    'Started it 🙄',
    'Suggested the last round 🍺',
    'Laughed at the wrong moment 😂',
    'Pocket-dialed someone',
    'Lost the game',
    'Looked suspicious 👀',
    'Was already smiling when asked',
    'The vibe doesn\'t lie',
    'Smelled guilty',
    'Blamed someone else first — deflection!',
  ],
  blameTally: {},      // { playerName: count }
  recentPays: [],      // last 3 names picked for "pays"
  recentBlame: [],     // last 3 names picked for "blame"
  paysExcluded: [],    // temp excludes for this round
  wheelRotation: 0,    // current cumulative rotation in degrees
};

let state = {};

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = deepMerge(DEFAULTS, saved);
    } else {
      state = deepClone(DEFAULTS);
    }
  } catch (e) {
    state = deepClone(DEFAULTS);
  }
}

function saveState() {
  try { localStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch (e) { /* full */ }
}

function deepClone(o) { return JSON.parse(JSON.stringify(o)); }

function deepMerge(defaults, saved) {
  const out = deepClone(defaults);
  for (const k of Object.keys(saved)) {
    if (k in out && typeof out[k] === 'object' && !Array.isArray(out[k]) && out[k] !== null) {
      out[k] = deepMerge(out[k], saved[k]);
    } else {
      out[k] = saved[k];
    }
  }
  return out;
}

// ════════════════════════════════════════════════════════════════
// WEIGHTED RANDOM
// ════════════════════════════════════════════════════════════════

/**
 * Pick a player using weighted random:
 *  - base weight from state.weights (default 1.0)
 *  - rigged mode multiplier if enabled
 *  - anti-repeat: small boost for those not picked recently
 *  - chaos: partyModeLevel * 0.05 random perturbation
 * @param {string[]} pool  - player names to pick from
 * @param {string}   context - 'pays' | 'blame' (for anti-repeat tracking)
 * @param {string[]} exclude - names to exclude entirely
 */
function weightedPick(pool, context, exclude = []) {
  const eligible = pool.filter(p => !exclude.includes(p));
  if (!eligible.length) return pool[Math.floor(Math.random() * pool.length)];

  const recent = state['recent' + cap(context)] || [];
  const chaos = state.partyModeLevel * 0.05;

  const weights = eligible.map(p => {
    let w = state.weights[p] !== undefined ? state.weights[p] : 1.0;

    // Rigged mode: if enabled, boost weights above 1 further
    if (state.riggedMode) {
      if (w > 1.0) w *= 1.4;
    }

    // Anti-repeat: small boost for those NOT picked recently
    const recencyPenalty = recent.indexOf(p);
    if (recencyPenalty === -1) w *= 1.15;      // not recent → boost
    else if (recencyPenalty === 0) w *= 0.7;   // most recent → reduce

    // Chaos factor
    w *= (1 + (Math.random() * 2 - 1) * chaos);
    return Math.max(0.01, w);
  });

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < eligible.length; i++) {
    r -= weights[i];
    if (r <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function updateRecent(context, name) {
  const key = 'recent' + cap(context);
  if (!state[key]) state[key] = [];
  state[key] = [name, ...state[key].filter(n => n !== name)].slice(0, 3);
}

// ════════════════════════════════════════════════════════════════
// AUDIO  (Web Audio API — no files needed)
// ════════════════════════════════════════════════════════════════

let _audioCtx = null;
function getAudioCtx() {
  if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return _audioCtx;
}

function playTone(freq, dur, type = 'sine', vol = 0.25) {
  if (!state.soundsOn) return;
  try {
    const ctx = getAudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    gain.gain.setValueAtTime(vol, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.start(); osc.stop(ctx.currentTime + dur);
  } catch (_) {}
}

function playSoundWin()    { playTone(523,.1); setTimeout(()=>playTone(659,.1),110); setTimeout(()=>playTone(784,.35),220); }
function playSoundClick()  { playTone(440,.05,'square',.15); }
function playSoundDrum()   { playTone(80,.3,'sawtooth',.4); }
function playSoundWheel()  {
  if (!state.soundsOn) return;
  // Rapid descending ticks that slow down
  [0,50,110,180,260,350,450,570,700,850,1010,1180,1360,1550,1750].forEach((t,i) => {
    setTimeout(() => playTone(300 - i*5, .04, 'square', .1), t);
  });
}

// ════════════════════════════════════════════════════════════════
// HAPTIC
// ════════════════════════════════════════════════════════════════

function haptic(pattern = [30]) {
  if (!state.hapticsOn) return;
  if (navigator.vibrate) navigator.vibrate(pattern);
}

// ════════════════════════════════════════════════════════════════
// CONFETTI
// ════════════════════════════════════════════════════════════════

const CONFETTI_COLORS = ['#7c3aed','#f59e0b','#ef4444','#22c55e','#3b82f6','#ec4899','#f97316'];

function confetti(count = 40) {
  const container = document.getElementById('confetti-container');
  for (let i = 0; i < count; i++) {
    const el = document.createElement('div');
    el.className = 'confetti-piece';
    el.style.left = Math.random() * 100 + 'vw';
    el.style.top = '-12px';
    el.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    el.style.width = el.style.height = (6 + Math.random() * 8) + 'px';
    el.style.borderRadius = Math.random() > .5 ? '50%' : '2px';
    el.style.animationDuration = (1.2 + Math.random() * 1.8) + 's';
    el.style.animationDelay = (Math.random() * .5) + 's';
    container.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}

// ════════════════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════════════════

function toast(msg) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => el.remove(), 2100);
}

// ════════════════════════════════════════════════════════════════
// TAB SWITCHING
// ════════════════════════════════════════════════════════════════

let currentTab = 'pays';

function switchTab(tab) {
  currentTab = tab;
  document.querySelectorAll('.tab-panel').forEach(p => {
    p.hidden = p.id !== 'tab-' + tab;
    if (!p.hidden) p.removeAttribute('hidden');
    else p.setAttribute('hidden', '');
  });
  document.querySelectorAll('.nav-btn').forEach(b => {
    const active = b.dataset.tab === tab;
    b.classList.toggle('active', active);
    b.setAttribute('aria-current', active ? 'page' : 'false');
  });
  // Render dynamic content
  if (tab === 'score')    renderScore();
  if (tab === 'log')      renderLog();
  if (tab === 'settings') renderSettings();
  if (tab === 'wheel')    drawWheelFrame(state.wheelRotation || 0);
  if (tab === 'blame')    renderBlameTally();
}

// ════════════════════════════════════════════════════════════════
// WHO PAYS
// ════════════════════════════════════════════════════════════════

let lastPaysPick = null;

function pickPays(pool) {
  const exclude = state.paysExcluded || [];
  const name = weightedPick(pool || state.players, 'pays', exclude);
  lastPaysPick = name;
  updateRecent('pays', name);

  const result = document.getElementById('pays-result');

  result.innerHTML = '💸 ' + name + '!';
  result.classList.add('has-result');
  document.getElementById('pays-reason').textContent = getRigNote(name);

  document.getElementById('btn-pays-reroll').disabled = false;
  document.getElementById('btn-pays-exclude').disabled = false;

  confetti(30);
  haptic([20, 30, 20]);
  playSoundWin();
  saveState();
}

function getRigNote(name) {
  if (!state.riggedMode) return '';
  const w = state.weights[name] || 1.0;
  if (w >= 1.5) return '🎛️ (the numbers don\'t lie)';
  return '';
}

function renderPaysExcluded() {
  const ex = state.paysExcluded || [];
  const el = document.getElementById('pays-excluded');
  el.textContent = ex.length ? '🚫 Excluded: ' + ex.join(', ') : '';
}

function initPays() {
  document.getElementById('btn-pays-pick').addEventListener('click', () => {
    playSoundClick();
    pickPays();
  });
  document.getElementById('btn-pays-reroll').addEventListener('click', () => {
    playSoundClick();
    if (lastPaysPick && !state.paysExcluded.includes(lastPaysPick)) {
      state.paysExcluded = [...(state.paysExcluded || []), lastPaysPick];
    }
    pickPays();
    renderPaysExcluded();
  });
  document.getElementById('btn-pays-exclude').addEventListener('click', () => {
    if (!lastPaysPick) return;
    if (!state.paysExcluded.includes(lastPaysPick)) {
      state.paysExcluded = [...(state.paysExcluded || []), lastPaysPick];
      toast('🚫 ' + lastPaysPick + ' excluded this round');
      saveState();
    }
    renderPaysExcluded();
    pickPays();
  });
}

// ════════════════════════════════════════════════════════════════
// WHO'S TO BLAME
// ════════════════════════════════════════════════════════════════

let lastBlamePick = null;

function pickBlame() {
  const name = weightedPick(state.players, 'blame');
  lastBlamePick = name;
  updateRecent('blame', name);

  const reason = state.blameReasons[Math.floor(Math.random() * state.blameReasons.length)];

  document.getElementById('blame-result').innerHTML = '🤬 ' + name + '!';
  document.getElementById('blame-result').classList.add('has-result');
  document.getElementById('blame-reason').textContent = reason;
  document.getElementById('btn-blame-reroll').disabled = false;

  // Update tally
  state.blameTally = state.blameTally || {};
  state.blameTally[name] = (state.blameTally[name] || 0) + 1;

  renderBlameTally();
  confetti(20);
  haptic([50, 30]);
  playSoundDrum();
  saveState();
}

function renderBlameTally() {
  const tally = state.blameTally || {};
  const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted.length ? sorted[0][1] : 1;
  const el = document.getElementById('blame-tally');
  if (!sorted.length) { el.innerHTML = '<div class="empty-state">No culprits yet…</div>'; return; }
  el.innerHTML = sorted.map(([name, count]) => `
    <div class="tally-row">
      <span class="tally-name">${name}</span>
      <div class="tally-bar-bg"><div class="tally-bar" style="width:${Math.round(count/max*100)}%"></div></div>
      <span class="tally-count">${count}x</span>
    </div>
  `).join('');
}

function initBlame() {
  document.getElementById('btn-blame-pick').addEventListener('click', () => {
    playSoundClick();
    pickBlame();
  });
  document.getElementById('btn-blame-reroll').addEventListener('click', () => {
    playSoundClick();
    // Undo last tally entry and repick
    if (lastBlamePick && state.blameTally[lastBlamePick] > 0) {
      state.blameTally[lastBlamePick]--;
      if (state.blameTally[lastBlamePick] === 0) delete state.blameTally[lastBlamePick];
    }
    pickBlame();
  });
}

// ════════════════════════════════════════════════════════════════
// WHEEL OF CONSEQUENCES
// ════════════════════════════════════════════════════════════════

const WHEEL_COLORS = [
  '#7c3aed','#db2777','#ea580c','#d97706',
  '#16a34a','#0891b2','#4f46e5','#be185d',
  '#9a3412','#065f46',
];

let wheelCanvas, wheelCtx;
let wheelSpinning = false;

function drawWheelFrame(rotDeg) {
  if (!wheelCanvas) return;
  const items = state.wheelItems;
  const n = items.length;
  const cx = wheelCanvas.width / 2;
  const cy = wheelCanvas.height / 2;
  const r  = cx - 4;
  const rot = (rotDeg * Math.PI) / 180;

  wheelCtx.clearRect(0, 0, wheelCanvas.width, wheelCanvas.height);

  for (let i = 0; i < n; i++) {
    const startAngle = rot + (i / n) * 2 * Math.PI - Math.PI / 2;
    const endAngle   = rot + ((i + 1) / n) * 2 * Math.PI - Math.PI / 2;

    // Segment
    wheelCtx.beginPath();
    wheelCtx.moveTo(cx, cy);
    wheelCtx.arc(cx, cy, r, startAngle, endAngle);
    wheelCtx.closePath();
    wheelCtx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    wheelCtx.fill();
    wheelCtx.strokeStyle = '#0d0d1a';
    wheelCtx.lineWidth = 2;
    wheelCtx.stroke();

    // Label
    const midAngle = (startAngle + endAngle) / 2;
    const labelR = r * 0.65;
    const lx = cx + labelR * Math.cos(midAngle);
    const ly = cy + labelR * Math.sin(midAngle);

    wheelCtx.save();
    wheelCtx.translate(lx, ly);
    wheelCtx.rotate(midAngle + Math.PI / 2);
    wheelCtx.fillStyle = '#fff';
    wheelCtx.font = `bold ${Math.max(10, Math.floor(r / n * 1.4))}px -apple-system, system-ui, sans-serif`;
    wheelCtx.textAlign = 'center';
    wheelCtx.textBaseline = 'middle';

    // Truncate label if too long
    const maxChars = Math.max(8, Math.floor(28 / n * 4));
    const label = items[i].length > maxChars ? items[i].slice(0, maxChars - 1) + '…' : items[i];
    wheelCtx.fillText(label, 0, 0);
    wheelCtx.restore();
  }

  // Center cap
  wheelCtx.beginPath();
  wheelCtx.arc(cx, cy, 14, 0, 2 * Math.PI);
  wheelCtx.fillStyle = '#0d0d1a';
  wheelCtx.fill();
  wheelCtx.strokeStyle = '#fff';
  wheelCtx.lineWidth = 2;
  wheelCtx.stroke();
}

function spinWheel() {
  if (wheelSpinning) return;
  wheelSpinning = true;

  const btn = document.getElementById('btn-wheel-spin');
  btn.disabled = true;

  const items = state.wheelItems;
  const n = items.length;

  // How much extra to spin: 5–9 full rotations + random angle
  const extraSpins = 5 + Math.floor(Math.random() * 5);
  const extraAngle = Math.random() * 360;
  const totalDelta = extraSpins * 360 + extraAngle;
  const finalRot   = (state.wheelRotation || 0) + totalDelta;

  playSoundWheel();
  haptic([10, 50, 10, 50, 10, 80, 20, 100, 300]);

  // Animate with requestAnimationFrame using ease-out
  const startRot  = state.wheelRotation || 0;
  const startTime = performance.now();
  const duration  = 3800 + Math.random() * 1200; // 3.8–5s

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function frame(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const currentRot = startRot + totalDelta * easeOut(progress);
    drawWheelFrame(currentRot);

    if (progress < 1) {
      requestAnimationFrame(frame);
    } else {
      // Spin done — find winner
      state.wheelRotation = finalRot % 360;

      // Which segment is at top pointer?
      // Segments drawn from -π/2 (top) clockwise.
      // After total rotation R, pointer at top sees wheel's angle 0 - R (in wheel frame).
      const norm = ((-(finalRot % 360)) % 360 + 360) % 360;
      const segmentAngle = 360 / n;
      const winnerIdx = Math.floor(norm / segmentAngle) % n;
      const winner = items[winnerIdx];

      document.getElementById('wheel-result').innerHTML = winner;
      document.getElementById('wheel-result').classList.add('has-result');

      confetti(50);
      haptic([50, 30, 50]);
      playSoundWin();
      toast('🎡 ' + winner.slice(0, 40));

      drawWheelFrame(state.wheelRotation);
      saveState();

      wheelSpinning = false;
      btn.disabled = false;
    }
  }

  requestAnimationFrame(frame);
}

function initWheel() {
  wheelCanvas = document.getElementById('wheel-canvas');
  // Resize canvas to actual display size
  const size = Math.min(300, window.innerWidth - 48);
  wheelCanvas.width  = size;
  wheelCanvas.height = size;
  wheelCtx = wheelCanvas.getContext('2d');

  drawWheelFrame(state.wheelRotation || 0);

  document.getElementById('btn-wheel-spin').addEventListener('click', () => {
    playSoundClick();
    spinWheel();
  });
}

// ════════════════════════════════════════════════════════════════
// SCOREBOARD
// ════════════════════════════════════════════════════════════════

let selectedScorePlayer = null;

function getPlayerTotal(name) {
  const cats = state.scores[name] || {};
  return Object.values(cats).reduce((a, b) => a + b, 0);
}

function renderScore() {
  // Ensure scores have entries for all players
  for (const p of state.players) {
    if (!state.scores[p]) state.scores[p] = {};
    for (const cat of state.scoreCategories) {
      if (state.scores[p][cat] === undefined) state.scores[p][cat] = 0;
    }
  }

  // Leaderboard
  const sorted = [...state.players].sort((a, b) => getPlayerTotal(b) - getPlayerTotal(a));
  const medals = ['🥇', '🥈', '🥉'];
  const classes = ['gold', 'silver', 'bronze'];
  const lbEl = document.getElementById('score-leaderboard');
  lbEl.innerHTML = sorted.slice(0, 3).map((name, i) => `
    <div class="leader-card ${classes[i]}">
      <div class="leader-place">${medals[i]}</div>
      <div class="leader-name">${name}</div>
      <div class="leader-pts">${getPlayerTotal(name)} pts</div>
    </div>
  `).join('');

  // Player selector tabs
  if (!selectedScorePlayer || !state.players.includes(selectedScorePlayer)) {
    selectedScorePlayer = state.players[0];
  }
  const tabsEl = document.getElementById('score-player-tabs');
  tabsEl.innerHTML = state.players.map(p => `
    <button class="player-tab-btn ${p === selectedScorePlayer ? 'active' : ''}"
      data-player="${esc(p)}"
      role="tab"
      aria-selected="${p === selectedScorePlayer}"
      aria-label="${esc(p)}">${esc(p)}</button>
  `).join('');
  tabsEl.querySelectorAll('.player-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      selectedScorePlayer = btn.dataset.player;
      playSoundClick();
      renderScore();
    });
  });

  // Categories for selected player
  const catsEl = document.getElementById('score-categories');
  catsEl.innerHTML = state.scoreCategories.map(cat => {
    const val = (state.scores[selectedScorePlayer] || {})[cat] || 0;
    return `
    <div class="score-cat-row">
      <span class="score-cat-label">${cat}</span>
      <div class="score-cat-controls">
        <button class="score-adj-btn" data-cat="${esc(cat)}" data-delta="-1" aria-label="Remove point from ${esc(cat)}">−</button>
        <span class="score-cat-val">${val}</span>
        <button class="score-adj-btn" data-cat="${esc(cat)}" data-delta="1" aria-label="Add point to ${esc(cat)}">+</button>
      </div>
    </div>`;
  }).join('');

  catsEl.querySelectorAll('.score-adj-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cat   = btn.dataset.cat;
      const delta = parseInt(btn.dataset.delta, 10);
      if (!state.scores[selectedScorePlayer]) state.scores[selectedScorePlayer] = {};
      const cur = state.scores[selectedScorePlayer][cat] || 0;
      state.scores[selectedScorePlayer][cat] = Math.max(0, cur + delta);
      if (delta > 0) { confetti(10); haptic([15]); playSoundClick(); }
      saveState();
      renderScore();
    });
  });
}

function copyScoreResults() {
  const sorted = [...state.players].sort((a, b) => getPlayerTotal(b) - getPlayerTotal(a));
  let text = '🏆 Bachelor Party Scoreboard 🏆\n\n';
  sorted.forEach((p, i) => {
    const medal = ['🥇','🥈','🥉'][i] || '  ';
    text += `${medal} ${p}: ${getPlayerTotal(p)} pts\n`;
    for (const cat of state.scoreCategories) {
      const v = (state.scores[p] || {})[cat] || 0;
      if (v) text += `   ${cat}: ${v}\n`;
    }
    text += '\n';
  });
  text += '\n🎩 Generated by Bachelor Control Panel';

  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => toast('📋 Copied!'));
  } else {
    const ta = document.createElement('textarea');
    ta.value = text; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    ta.remove(); toast('📋 Copied!');
  }
}

function initScore() {
  document.getElementById('btn-score-copy').addEventListener('click', () => {
    playSoundClick(); copyScoreResults();
  });
  document.getElementById('btn-score-reset').addEventListener('click', () => {
    if (!confirm('Reset ALL scores? This cannot be undone.')) return;
    state.scores = {};
    saveState();
    toast('🗑️ Scores reset');
    renderScore();
  });
}

// ════════════════════════════════════════════════════════════════
// NIGHT LOG
// ════════════════════════════════════════════════════════════════

let pendingPhotoDataUrl = null;

function compressPhoto(file, cb) {
  const reader = new FileReader();
  reader.onload = e => {
    const img = new Image();
    img.onload = () => {
      const MAX = 800;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width  = Math.round(img.width  * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      cb(c.toDataURL('image/jpeg', 0.72));
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderLog() {
  const el = document.getElementById('log-entries');
  const entries = (state.log || []).slice().reverse(); // newest first
  if (!entries.length) {
    el.innerHTML = '<div class="empty-state">Nothing logged yet 👀</div>';
    return;
  }
  el.innerHTML = entries.map(entry => `
    <div class="log-entry">
      <div class="log-entry-ts">${formatTs(entry.ts)}</div>
      <div class="log-entry-text">${esc(entry.text)}</div>
      ${entry.photoDataUrl ? `<img src="${entry.photoDataUrl}" alt="Log photo" loading="lazy">` : ''}
    </div>
  `).join('');
}

function formatTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('sv-SE') + ' ' + d.toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });
}

function addLogEntry(text, photo) {
  if (!text.trim() && !photo) return;
  state.log = state.log || [];
  state.log.push({ ts: Date.now(), text: text.trim(), photoDataUrl: photo || null });
  saveState();
  toast('✍️ Logged!');
  haptic([20]);
  playSoundClick();
}

function exportLog() {
  const entries = state.log || [];
  if (!entries.length) { toast('📝 Log is empty!'); return; }
  let text = '📝 BACHELOR PARTY NIGHT LOG 📝\n';
  text += '='.repeat(40) + '\n\n';
  entries.forEach(e => {
    text += `[${formatTs(e.ts)}]\n${e.text}\n`;
    if (e.photoDataUrl) text += '(photo attached)\n';
    text += '\n';
  });
  text += '🎩 Exported from Bachelor Control Panel';

  const blob = new Blob([text], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'bachelor-night-log.txt';
  a.click(); URL.revokeObjectURL(url);
  toast('📤 Log exported!');
}

function initLog() {
  const photoInput = document.getElementById('log-photo-input');
  const photoThumb = document.getElementById('log-photo-thumb');
  const photoName  = document.getElementById('log-photo-name');

  photoInput.addEventListener('change', () => {
    const file = photoInput.files[0];
    if (!file) return;
    photoName.textContent = file.name.slice(0, 20);
    compressPhoto(file, dataUrl => {
      pendingPhotoDataUrl = dataUrl;
      photoThumb.innerHTML = `<img src="${dataUrl}" alt="Preview">`;
    });
  });

  document.getElementById('btn-log-add').addEventListener('click', () => {
    const text = document.getElementById('log-text').value;
    if (!text.trim() && !pendingPhotoDataUrl) { toast('✏️ Write something first!'); return; }
    addLogEntry(text, pendingPhotoDataUrl);
    document.getElementById('log-text').value = '';
    photoInput.value = '';
    photoName.textContent = '';
    photoThumb.innerHTML = '';
    pendingPhotoDataUrl = null;
    renderLog();
  });

  document.getElementById('btn-log-export').addEventListener('click', exportLog);

  document.getElementById('btn-log-clear').addEventListener('click', () => {
    if (!confirm('Clear all log entries?')) return;
    state.log = [];
    saveState();
    toast('🗑️ Log cleared');
    renderLog();
  });
}

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════

function renderSettings() {
  const el = document.getElementById('settings-content');

  el.innerHTML = `
    <!-- Players -->
    <div class="setting-card">
      <label>👥 Players</label>
      <div class="players-list" id="settings-players-list"></div>
      <button id="btn-add-player" class="btn-secondary btn-sm" style="margin-top:.5rem">+ Add Player</button>
    </div>

    <!-- Bachelor name -->
    <div class="setting-card">
      <label>🎩 Bachelor Name</label>
      <input type="text" id="settings-bachelor" value="${esc(state.bachelorName)}" placeholder="Bachelor">
    </div>

    <!-- Wheel items -->
    <div class="setting-card">
      <label>🎡 Wheel Items (one per line)</label>
      <textarea id="settings-wheel-items">${state.wheelItems.join('\n')}</textarea>
    </div>

    <!-- Score categories -->
    <div class="setting-card">
      <label>🏆 Score Categories (one per line)</label>
      <textarea id="settings-score-cats">${state.scoreCategories.join('\n')}</textarea>
    </div>

    <!-- Blame reasons -->
    <div class="setting-card">
      <label>🤬 Blame Reasons (one per line)</label>
      <textarea id="settings-blame-reasons">${state.blameReasons.join('\n')}</textarea>
    </div>

    <!-- Toggles -->
    <div class="setting-card">
      <div class="setting-row">
        <span>🔊 Sounds</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-sounds" ${state.soundsOn ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>
      <div class="setting-row" style="margin-top:.75rem">
        <span>📳 Haptics</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-haptics" ${state.hapticsOn ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    <!-- Party mode -->
    <div class="setting-card">
      <label>🔥 Party Mode (chaos level)</label>
      <div class="party-slider">
        <span>😇</span>
        <input type="range" id="settings-party" min="0" max="5" step="1" value="${state.partyModeLevel}">
        <span>🔥</span>
        <span class="party-slider-val" id="party-val">${state.partyModeLevel}</span>
      </div>
    </div>

    <!-- Reset -->
    <div class="setting-card">
      <label>⚠️ Danger Zone</label>
      <div class="btn-group">
        <button id="btn-reset-paysexclude" class="btn-secondary btn-sm">🔄 Clear Pay Excludes</button>
        <button id="btn-reset-blame-tally" class="btn-secondary btn-sm">🔄 Reset Blame Tally</button>
        <button id="btn-factory-reset" class="btn-danger btn-sm">💥 Factory Reset</button>
      </div>
    </div>
  `;

  // Players list
  renderSettingsPlayersList();

  document.getElementById('btn-add-player').addEventListener('click', () => {
    const name = prompt('Player name:');
    if (!name || !name.trim()) return;
    state.players.push(name.trim());
    if (!state.weights[name.trim()]) { /* use default 1.0 */ }
    saveState();
    renderSettingsPlayersList();
    updateRigPanel();
    toast('👤 Added ' + name.trim());
  });

  document.getElementById('settings-bachelor').addEventListener('change', e => {
    const old = state.bachelorName;
    const nw  = e.target.value.trim() || 'Bachelor';
    // Rename in players list & weights
    const idx = state.players.indexOf(old);
    if (idx !== -1) state.players[idx] = nw;
    if (state.weights[old] !== undefined) { state.weights[nw] = state.weights[old]; delete state.weights[old]; }
    state.bachelorName = nw;
    saveState(); toast('✅ Saved');
  });

  const saveTextarea = (id, key, splitFn) => {
    document.getElementById(id).addEventListener('change', e => {
      state[key] = splitFn(e.target.value);
      saveState(); toast('✅ Saved');
    });
  };

  saveTextarea('settings-wheel-items',  'wheelItems',      v => v.split('\n').map(s=>s.trim()).filter(Boolean));
  saveTextarea('settings-score-cats',   'scoreCategories', v => v.split('\n').map(s=>s.trim()).filter(Boolean));
  saveTextarea('settings-blame-reasons','blameReasons',     v => v.split('\n').map(s=>s.trim()).filter(Boolean));

  document.getElementById('settings-sounds').addEventListener('change', e => {
    state.soundsOn = e.target.checked;
    if (state.soundsOn) {
      // Unlock audio context on user gesture
      try { getAudioCtx().resume(); } catch(_) {}
      playSoundWin();
    }
    saveState();
  });
  document.getElementById('settings-haptics').addEventListener('change', e => {
    state.hapticsOn = e.target.checked; saveState();
  });
  document.getElementById('settings-party').addEventListener('input', e => {
    state.partyModeLevel = parseInt(e.target.value, 10);
    document.getElementById('party-val').textContent = state.partyModeLevel;
    saveState();
  });

  document.getElementById('btn-reset-paysexclude').addEventListener('click', () => {
    state.paysExcluded = []; saveState();
    document.getElementById('pays-excluded').textContent = '';
    toast('✅ Pay excludes cleared');
  });
  document.getElementById('btn-reset-blame-tally').addEventListener('click', () => {
    if (!confirm('Reset blame tally?')) return;
    state.blameTally = {}; saveState();
    toast('✅ Blame tally reset');
  });
  document.getElementById('btn-factory-reset').addEventListener('click', () => {
    if (!confirm('FACTORY RESET? This deletes EVERYTHING including the log.')) return;
    localStorage.removeItem(STATE_KEY);
    location.reload();
  });
}

function renderSettingsPlayersList() {
  const list = document.getElementById('settings-players-list');
  if (!list) return;
  list.innerHTML = state.players.map((p, i) => `
    <div class="player-setting-row">
      <input type="text" value="${esc(p)}" data-index="${i}" class="player-name-input" aria-label="Player ${i+1} name">
      <button class="btn-sm btn-danger remove-player-btn" data-index="${i}" aria-label="Remove ${esc(p)}">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('.player-name-input').forEach(inp => {
    inp.addEventListener('change', e => {
      const idx = parseInt(e.target.dataset.index, 10);
      const old = state.players[idx];
      const nw  = e.target.value.trim();
      if (!nw) return;
      state.players[idx] = nw;
      // Update weights key
      if (state.weights[old] !== undefined) { state.weights[nw] = state.weights[old]; delete state.weights[old]; }
      if (state.bachelorName === old) state.bachelorName = nw;
      saveState(); toast('✅ Saved'); updateRigPanel();
    });
  });

  list.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (state.players.length <= 2) { toast('❌ Need at least 2 players'); return; }
      const removed = state.players.splice(idx, 1)[0];
      delete state.weights[removed];
      saveState(); renderSettingsPlayersList(); updateRigPanel();
      toast('🗑️ Removed ' + removed);
    });
  });
}

// ════════════════════════════════════════════════════════════════
// DECISION HELPER
// ════════════════════════════════════════════════════════════════

function openDecision() {
  document.getElementById('modal-decision').hidden = false;
  document.getElementById('btn-decision-roll').focus();
}

function closeDecision() {
  document.getElementById('modal-decision').hidden = true;
}

function rollDecision() {
  const answers = state.decisionAnswers || DEFAULTS.decisionAnswers;
  let answer = answers[Math.floor(Math.random() * answers.length)];

  // Replace {{NAME}} with a random player
  if (answer.includes('{{NAME}}')) {
    const name = state.players[Math.floor(Math.random() * state.players.length)];
    answer = answer.replace(/\{\{NAME\}\}/g, name);
  }

  const el = document.getElementById('decision-result');
  el.textContent = answer;
  el.classList.add('has-result');
  confetti(20);
  haptic([30, 20, 30]);
  playSoundWin();
}

function initDecision() {
  document.getElementById('btn-decision').addEventListener('click', () => {
    playSoundClick();
    openDecision();
  });
  document.getElementById('btn-decision-roll').addEventListener('click', () => {
    playSoundClick();
    rollDecision();
  });
  document.getElementById('btn-decision-close').addEventListener('click', closeDecision);
  document.querySelector('.modal-backdrop').addEventListener('click', closeDecision);
}

// ════════════════════════════════════════════════════════════════
// RIGGED MODE  (long-press on app title 800ms)
// ════════════════════════════════════════════════════════════════

let rigPressTimer = null;

function initRiggedMode() {
  const title = document.getElementById('app-title');
  const panel = document.getElementById('rig-panel');

  const startPress = () => {
    rigPressTimer = setTimeout(() => {
      panel.hidden = false;
      updateRigPanel();
      haptic([20, 50, 20]);
      toast('🎛️ Rigging panel unlocked');
    }, 800);
  };
  const cancelPress = () => { clearTimeout(rigPressTimer); };

  title.addEventListener('touchstart', startPress, { passive: true });
  title.addEventListener('touchend',   cancelPress);
  title.addEventListener('mousedown',  startPress);
  title.addEventListener('mouseup',    cancelPress);
  title.addEventListener('mouseleave', cancelPress);

  document.getElementById('rig-enabled').addEventListener('change', e => {
    state.riggedMode = e.target.checked;
    document.getElementById('rigged-badge').hidden = !state.riggedMode;
    saveState();
    toast(state.riggedMode ? '🎛️ Rigging enabled' : '✅ Rigging off');
  });

  document.getElementById('btn-rig-close').addEventListener('click', () => {
    panel.hidden = true;
  });
}

function updateRigPanel() {
  // Sync checkbox
  document.getElementById('rig-enabled').checked = state.riggedMode;
  document.getElementById('rigged-badge').hidden  = !state.riggedMode;

  // Build weight sliders
  const container = document.getElementById('rig-weights');
  container.innerHTML = state.players.map(p => {
    const w = state.weights[p] !== undefined ? state.weights[p] : 1.0;
    return `
      <div class="rig-weight-row">
        <label>${p}</label>
        <input type="range" min="0.1" max="3.0" step="0.1" value="${w.toFixed(1)}"
          data-player="${esc(p)}" class="rig-weight-slider">
        <span class="rig-weight-val" id="rig-val-${esc(p)}">${w.toFixed(1)}×</span>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.rig-weight-slider').forEach(slider => {
    slider.addEventListener('input', e => {
      const p = e.target.dataset.player;
      const v = parseFloat(e.target.value);
      state.weights[p] = v;
      const valEl = document.getElementById('rig-val-' + p);
      if (valEl) valEl.textContent = v.toFixed(1) + '×';
      saveState();
    });
  });
}

// ════════════════════════════════════════════════════════════════
// NAVIGATION
// ════════════════════════════════════════════════════════════════

function initNav() {
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      playSoundClick();
      haptic([10]);
      switchTab(btn.dataset.tab);
    });
  });
}

// ════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════

function esc(s) {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

// ════════════════════════════════════════════════════════════════
// SERVICE WORKER
// ════════════════════════════════════════════════════════════════

function registerSW() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

// ════════════════════════════════════════════════════════════════
// INIT
// ════════════════════════════════════════════════════════════════

function init() {
  loadState();
  initNav();
  initPays();
  initBlame();
  initWheel();
  initScore();
  initLog();
  initDecision();
  initRiggedMode();

  // Restore rigged badge
  document.getElementById('rigged-badge').hidden = !state.riggedMode;

  // Set initial tab
  switchTab('pays');

  registerSW();

  // Reset pay excludes on new session if they exist
  // (Leave them — user clears in Settings if needed)
}

document.addEventListener('DOMContentLoaded', init);
