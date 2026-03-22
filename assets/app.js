/* ================================================================
   Bachelor Control Panel — app.js
   All state lives in localStorage['bcp_state']
   ================================================================ */

'use strict';

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════

const STATE_KEY = 'bcp_state';
const STATE_VERSION = 4;  // bump when defaults that override saved state change

const DEFAULTS = {
  stateVersion: STATE_VERSION,
  players: [
    'Alexander Larsen', 'Andre Sundh', 'Andreas Lelli', 'Axel Carlborg', 'Daniel Adersteg',
    'Felix Ihd', 'Filip Düsing', 'Fredrik Hain', 'Jacob Blomgren', 'Jakob Norrby',
    'Jim Cargill', 'Johan Julin', 'Jona Dahl', 'Kalle Lund', 'Karsten Ihd',
    'Ludde Flyckt', 'Marcus Alm', 'Martin Fuentes', 'Oscar Krook', 'Oskar Kappel',
    'Oskar Sjöblom', 'Peter Arneryd',
  ],
  bachelorName: 'Pontus',
  riggedMode: false,
  weights: {},                          // keyed by player name; missing = 1.0
  partyModeLevel: 0,                   // 0–5
  soundsOn: false,
  hapticsOn: true,
  wheelItems: [
    '🧠 Förklara hur en termostat fungerar som om du håller en föreläsning för ingenjörsstudenter. Minst 90 sekunder. Gruppen sätter betyg.',
    '🎭 Byt personlighet med personen till vänster i 10 minuter — samma röst, samma kroppsspråk, samma sätt att röra sig.',
    '🗳️ Personen till höger väljer en karaktär som du ska gestalta. Du får instruktionen i hemlighet — och börjar spela den direkt, utan att avslöja vem det är. Resten av gruppen gissar.',
    '🎯 Gruppen ger dig ett adjektiv — ett enda beskrivande ord, som mjuk, aggressiv eller kunglig. Du måste beställa nästa drink helt i linje med det ordet. Röst, kroppsspråk, allt.',
    '😶 Du får bara kommunicera via frågor resten av drinken. Kommer ett påstående ur munnen på dig — ny konsekvens direkt.',
    '🪑 Gå fram till en okänd person i närheten och för ett 5-minuters samtal. Personen till vänster om dig väljer vilket ämne du måste ta upp.',
    '🎤 Håll ett 2-minuters försvarstal för en åsikt som gruppen väljer åt dig — oavsett vad du själv tycker.',
    '🧾 Personen som snurrade hjulet skriver Pontus bröllopstal på 3 minuter. Pontus framför det högt direkt efteråt — utan att ha läst det först.',
    '🤝 Ditt namn är struket för resten av kvällen. Gruppen döper om dig nu.',
    '🔄 Du och personen till höger byter identitet. Ni svarar på varandras frågor och beställer varandras drinkar i 15 minuter.',
    '🎪 Du har 60 sekunder på dig att sälja in en helt påhittad produkt till gruppen. De röstar om de köper — majoriteten avgör.',
    '🕵️ Du ska avslöja en hemlighet om personen till höger om dig för närmaste främling i närheten. Helt stonefaced. Personen som snurrade hjulet väljer hemligheten.',
    '🧩 Personen som snurrade hjulet formulerar ett problem. Du har 1 minut på dig att samla ihop saker från omgivningen — sedan 2 minuter att lösa det med bara det du hittade.',
    '🎬 Gruppen väljer en filmscen. Du spelar samtliga roller själv — direkt och utan förberedelse.',
    '👑 Du är gruppens personlige butler i 20 minuter. Vad det innebär beslutar gruppen gemensamt.',
  ],
  decisionAnswers: [
    'ABSOLUT INTE 🚫',
    'JA OCH FILMA DET 📹',
    'Bara om {{NAME}} betalar 💸',
    'Fråga {{NAME}} först 🤔',
    'Andarna säger… JA 🎱',
    'HELVETES JA! 🔥',
    'Kanske efter en drink till… 🍺',
    'Ditt framtida jag säger NEJ 🚫',
    'GRUPPEN KRÄVER DET 👥',
    'Tecknen pekar mot ånger 🔮',
    'BARA OM {{NAME}} GÅR FÖRST',
    'Lyckan gynnar de modiga! KÖR!',
    '{{NAME}} förlåter dig aldrig. Gör det.',
    'Tre ord: Gör. Det. Inte.',
    'Garanterat dålig idé. Garanterat kul. JA!',
  ],
  recentPays: [],      // last 3 names picked for "pays"
  paysExcluded: [],    // temp excludes for this round
};

let state = {};

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      state = deepMerge(DEFAULTS, saved);
      // Migrate: reset versioned arrays when state is from an older version
      if ((saved.stateVersion || 0) < STATE_VERSION) {
        state.players = deepClone(DEFAULTS.players);
        state.wheelItems = deepClone(DEFAULTS.wheelItems);
        state.stateVersion = STATE_VERSION;
        saveState();
      }
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
  if (tab === 'settings') renderSettings();
  if (tab === 'wheel')    buildSlotTrack();
  if (tab === 'decision') {
    // Reset result so each visit feels fresh
    const el = document.getElementById('decision-result');
    el.innerHTML = '<span class="result-placeholder">Fråga oraklet…</span>';
    el.classList.remove('has-result');
  }
}

// ════════════════════════════════════════════════════════════════
// WHO PAYS
// ════════════════════════════════════════════════════════════════

let lastPaysPick = null;

function pickPays(pool) {
  const allPlayers = pool || state.players;
  const exclude = state.paysExcluded || [];
  const eligible = allPlayers.filter(p => !exclude.includes(p));

  if (!eligible.length) {
    toast('⚠️ Alla är uteslutna – återställer!');
    state.paysExcluded = [];
    saveState();
    renderPaysExcluded();
  }

  const name = weightedPick(allPlayers, 'pays', state.paysExcluded);
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
  el.textContent = ex.length ? '🚫 Uteslutna: ' + ex.join(', ') : '';
  document.getElementById('btn-pays-reset').hidden = ex.length === 0;
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
      toast('🚫 ' + lastPaysPick + ' utesluten!');
      saveState();
    }
    renderPaysExcluded();
    pickPays();
  });
  document.getElementById('btn-pays-reset').addEventListener('click', () => {
    state.paysExcluded = [];
    state.recentPays = [];
    lastPaysPick = null;
    saveState();
    renderPaysExcluded();
    document.getElementById('pays-result').innerHTML = '<span class="result-placeholder">Tryck på knappen!</span>';
    document.getElementById('pays-result').classList.remove('has-result');
    document.getElementById('pays-reason').textContent = '';
    document.getElementById('btn-pays-reroll').disabled = true;
    document.getElementById('btn-pays-exclude').disabled = true;
    haptic([10, 20, 10]);
    toast('🔁 Återställt – alla är med igen!');
  });
}

// ════════════════════════════════════════════════════════════════
// SHOULD WE DO THIS?
// ════════════════════════════════════════════════════════════════

function rollDecision() {
  const answers = state.decisionAnswers || DEFAULTS.decisionAnswers;
  if (!answers.length) { toast('⚠️ Inga svar att välja bland!'); return; }

  let answer = answers[Math.floor(Math.random() * answers.length)];

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
  document.getElementById('btn-decision-roll').addEventListener('click', () => {
    playSoundClick();
    rollDecision();
  });
}

// ════════════════════════════════════════════════════════════════
// ENARMAD BANDIT (Slot Machine)
// ════════════════════════════════════════════════════════════════

const SLOT_ITEM_H = 90; // must match .slot-item height in CSS
let slotSpinning = false;

function buildSlotTrack() {
  const track = document.getElementById('slot-track');
  if (!track) return;
  const items = state.wheelItems;
  const reps = 8;
  track.innerHTML = '';
  for (let r = 0; r < reps; r++) {
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'slot-item';
      div.textContent = item;
      track.appendChild(div);
    });
  }
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';
}

function spinSlot() {
  if (slotSpinning) return;
  const items = state.wheelItems;
  if (!items || !items.length) { toast('⚠️ Inga alternativ att snurra!'); return; }

  slotSpinning = true;
  const btn = document.getElementById('btn-wheel-spin');
  btn.disabled = true;

  const n = items.length;
  const winnerIdx = Math.floor(Math.random() * n);
  // Land on winner in the 6th repetition (0-indexed) for a long satisfying spin
  const targetPos = (6 * n + winnerIdx) * SLOT_ITEM_H;
  const duration  = 3800 + Math.floor(Math.random() * 1200);

  playSoundWheel();
  haptic([10, 50, 10, 50, 10, 80, 20, 100, 300]);

  const track = document.getElementById('slot-track');
  track.style.transition = 'none';
  track.style.transform = 'translateY(0)';

  // Double rAF ensures the reset is painted before animation starts
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      track.style.transition = `transform ${duration}ms cubic-bezier(0.19, 1, 0.22, 1)`;
      track.style.transform  = `translateY(-${targetPos}px)`;
    });
  });

  setTimeout(() => {
    const winner = items[winnerIdx];
    document.getElementById('wheel-result').innerHTML = esc(winner);
    document.getElementById('wheel-result').classList.add('has-result');

    confetti(50);
    haptic([50, 30, 50]);
    playSoundWin();
    toast('🎰 ' + winner.slice(0, 40));
    saveState();

    slotSpinning = false;
    btn.disabled = false;

    // Silently snap to stable position (winner at top of first rep)
    setTimeout(() => {
      track.style.transition = 'none';
      track.style.transform  = `translateY(-${winnerIdx * SLOT_ITEM_H}px)`;
    }, 800);
  }, duration + 150);
}

function initWheel() {
  buildSlotTrack();
  document.getElementById('btn-wheel-spin').addEventListener('click', () => {
    playSoundClick();
    spinSlot();
  });
}

// ════════════════════════════════════════════════════════════════
// NIGHT LOG
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// SETTINGS
// ════════════════════════════════════════════════════════════════

function renderSettings() {
  const el = document.getElementById('settings-content');

  el.innerHTML = `
    <!-- Spelare -->
    <div class="setting-card">
      <label>👥 Spelare</label>
      <div class="players-list" id="settings-players-list"></div>
      <div class="player-add-row">
        <input type="text" id="settings-new-player" placeholder="Namn…" aria-label="Nytt spelarnamn">
        <button id="btn-add-player" class="btn-secondary btn-sm">+ Lägg till</button>
      </div>
    </div>

    <!-- Bachelorns namn -->
    <div class="setting-card">
      <label>🎩 Bachelorns namn</label>
      <input type="text" id="settings-bachelor" value="${esc(state.bachelorName)}" placeholder="Bachelor">
    </div>

    <!-- Bandit-alternativ -->
    <div class="setting-card">
      <label>🎰 Bandit-alternativ (ett per rad)</label>
      <textarea id="settings-wheel-items">${state.wheelItems.join('\n')}</textarea>
    </div>

    <!-- Ljud & Vibration -->
    <div class="setting-card">
      <div class="setting-row">
        <span>🔊 Ljud</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-sounds" ${state.soundsOn ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>
      <div class="setting-row">
        <span>📳 Vibration</span>
        <label class="toggle-switch">
          <input type="checkbox" id="settings-haptics" ${state.hapticsOn ? 'checked' : ''}>
          <span class="toggle-track"></span>
        </label>
      </div>
    </div>

    <!-- Kaosläge -->
    <div class="setting-card">
      <label>🔥 Kaosläge</label>
      <div class="party-slider">
        <span>😇</span>
        <input type="range" id="settings-party" min="0" max="5" step="1" value="${state.partyModeLevel}">
        <span>🔥</span>
        <span class="party-slider-val" id="party-val">${state.partyModeLevel}</span>
      </div>
    </div>

    <!-- Öppna på telefonen -->
    <div class="setting-card">
      <label>📱 Öppna på telefonen</label>
      <div class="url-share-row">
        <span id="settings-url" class="settings-url-text"></span>
      </div>
      <div class="btn-group url-share-btn-group">
        <button id="btn-copy-url" class="btn-secondary">📋 Kopiera länk</button>
        <button id="btn-share-url" class="btn-secondary">🔗 Dela länk</button>
      </div>
    </div>

    <!-- Farlig zon -->
    <div class="setting-card">
      <label>⚠️ Farlig zon</label>
      <div class="btn-group">
        <button id="btn-reset-paysexclude" class="btn-secondary btn-sm">🔄 Återställ betalning</button>
        <button id="btn-factory-reset" class="btn-danger btn-sm">💥 Fabriksåterställning</button>
      </div>
    </div>
  `;

  // Players list
  renderSettingsPlayersList();

  document.getElementById('btn-add-player').addEventListener('click', () => {
    const input = document.getElementById('settings-new-player');
    const name = input.value.trim();
    if (!name) { toast('✏️ Ange ett namn!'); return; }
    state.players.push(name);
    saveState();
    input.value = '';
    renderSettingsPlayersList();
    updateRigPanel();
    toast('👤 Lade till ' + name);
  });

  document.getElementById('settings-bachelor').addEventListener('change', e => {
    const old = state.bachelorName;
    const nw  = e.target.value.trim() || 'Bachelor';
    // Rename in players list & weights
    const idx = state.players.indexOf(old);
    if (idx !== -1) state.players[idx] = nw;
    if (state.weights[old] !== undefined) { state.weights[nw] = state.weights[old]; delete state.weights[old]; }
    state.bachelorName = nw;
    saveState(); toast('✅ Sparat');
  });

  const saveTextarea = (id, key, splitFn) => {
    document.getElementById(id).addEventListener('change', e => {
      state[key] = splitFn(e.target.value);
      saveState(); toast('✅ Sparat');
    });
  };

  saveTextarea('settings-wheel-items',  'wheelItems',      v => v.split('\n').map(s=>s.trim()).filter(Boolean));

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

  // URL sharing
  const urlEl = document.getElementById('settings-url');
  urlEl.textContent = window.location.href;

  document.getElementById('btn-copy-url').addEventListener('click', () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
        .then(() => toast('📋 Länk kopierad!'))
        .catch(() => toast('❌ Kunde inte kopiera'));
    } else {
      toast('❌ Kunde inte kopiera');
    }
  });

  const shareBtn = document.getElementById('btn-share-url');
  if (navigator.share) {
    shareBtn.addEventListener('click', () => {
      navigator.share({ title: 'Svensexaappen', url: window.location.href })
        .catch(() => {});
    });
  } else {
    shareBtn.hidden = true;
  }

  document.getElementById('btn-reset-paysexclude').addEventListener('click', () => {
    state.paysExcluded = [];
    state.recentPays = [];
    lastPaysPick = null;
    saveState();
    renderPaysExcluded();
    document.getElementById('btn-pays-reroll').disabled = true;
    document.getElementById('btn-pays-exclude').disabled = true;
    toast('🔁 Återställt – alla är med igen!');
  });
  document.getElementById('btn-factory-reset').addEventListener('click', () => {
    if (!confirm('FABRIKSÅTERSTÄLLNING? Detta raderar ALLT.')) return;
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
      saveState(); toast('✅ Sparat'); updateRigPanel();
    });
  });

  list.querySelectorAll('.remove-player-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.dataset.index, 10);
      if (state.players.length <= 2) { toast('❌ Minst 2 spelare krävs'); return; }
      const removed = state.players.splice(idx, 1)[0];
      delete state.weights[removed];
      saveState(); renderSettingsPlayersList(); updateRigPanel();
      toast('🗑️ Tog bort ' + removed);
    });
  });
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
      toast('🎛️ Riggning upplåst');
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
    toast(state.riggedMode ? '🎛️ Riggning aktiverad' : '✅ Riggning av');
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
  document.getElementById('btn-settings').addEventListener('click', () => {
    playSoundClick();
    haptic([10]);
    switchTab('settings');
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
  initWheel();
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
