/* ================================================================
   Bachelor Control Panel — app.js
   All state lives in localStorage['bcp_state']
   ================================================================ */

'use strict';

// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════

const STATE_KEY = 'bcp_state';
const STATE_VERSION = 5;  // bump when defaults that override saved state change

const DEFAULTS = {
  stateVersion: STATE_VERSION,
  players: [
    'Alexander Sterner', 'André Sund Nellerup', 'Andreas Lelli', 'Axel Söderlund Carlberg',
    'Daniel Adersteg', 'Felix Ihd', 'Filip Düsing', 'Fredrik Hain', 'Hampus Ihd',
    'Jacob Blomgren', 'Jacob Norrny', 'Jim Cargill', 'Johan Julin', 'Jona Dahl',
    'Karl Lund', 'Karsten Ihd', 'Ludvig Flyckt', 'Ludwig Svennerstål', 'Marcus Alm',
    'Oscar Kappel', 'Oscar Krook', 'Oskar Stenström', 'Peter Arneryd',
    'Philip Rosander', 'Willam Kåge Segerros',
  ],
  bachelorName: 'Pontus Ihd',
  riggedMode: false,
  weights: {},                          // keyed by player name; missing = 1.0
  partyModeLevel: 0,                   // 0–5
  soundsOn: false,
  hapticsOn: true,
  wheelItems: [],  // user-added custom items; built-in items come from WHEEL_ITEM_POOLS
  recentPays: [],      // last 3 names picked for "pays"
  paysExcluded: [],    // temp excludes for this round
};

// ════════════════════════════════════════════════════════════════
// WHEEL ITEM POOLS  (unlocked progressively by partyModeLevel)
// ════════════════════════════════════════════════════════════════

const WHEEL_ITEM_POOLS = [
  // Level 0 — Finurlig
  [
    '🗺️ Du har 60 sekunder på dig att rabbla 20 av Sveriges 25 landskap. Missar du — svepa en öl.',
    '🎙️ Gruppen ger dig tre helt orelaterade ord. Du har 90 sekunder på dig att hålla ett sammanhängande tal där alla tre ingår naturligt.',
    '🍝 Förklara internets uppkomst med enbart matmetaforer. Gruppen bedömer på skala 1–10.',
    '🔧 Du har 2 minuter på dig att övertyga gruppen om att en helt vardaglig sak är historiens viktigaste uppfinning. Gruppen väljer föremålet.',
    '🌍 Nämn 10 länder som slutar på vokal på 30 sekunder. Missar du — börja om från ett.',
  ],
  // Level 1 — Social
  [
    '🗳️ Gruppen väljer en åsikt du måste försvara i 2 minuter — oavsett vad du egentligen tycker. Gruppen får ställa motfrågor.',
    '❤️ Gruppen ger dig tre adjektiv. Du håller ett 60-sekunders tal om kärleken där alla tre måste användas på ett trovärdigt sätt.',
    '💼 Du ska på 90 sekunder sälja in en tjänst som inte borde existera. Gruppen väljer tjänsten.',
    '🎭 Gruppen ger dig ett yrke och en känsla. Du håller en 60-sekunders monolog i karaktär — utan att nämna varken yrket eller känslan. Gruppen gissar.',
    '🤥 Du har 60 sekunder på dig att hitta på tre rimliga lögner och en sanning om dig själv. Gruppen röstar på sanningen.',
  ],
  // Level 2 — Avslöjande
  [
    '😬 Berätta om det mest desperate du gjort för att imponera på någon. Gruppen röstar om det funkade.',
    '🔥 Du har 90 sekunder på dig att försvara din mest kontroversiella åsikt. Gruppen får ställa motfrågor utan nåd.',
    '😔 Berätta om ett beslut du ångrar. Gruppen dömer om ångern var befogad.',
    '🎭 Gruppen ger dig en känsla. Du beskriver din jobbigaste dag någonsin — men bara med den känslan som filter.',
    '🤦 Vad är det värsta rådet du fått i livet? Förklara varför du ändå följde det.',
  ],
  // Level 3 — Festlig
  [
    '👑 Du är gruppens personlige butler i 15 minuter. Vad det innebär beslutar gruppen gemensamt — men inget olagligt.',
    '❓ Du kommunicerar bara via frågor resten av drinken. Fäller du ett påstående börjar du om — och tar en klunk.',
    '⚔️ Gruppen väljer ett historiskt event. Du håller ett passionerat 60-sekunders försvarstal för den förlorande sidan.',
    '🏷️ Du byter namn för resten av kvällen. Gruppen döper om dig nu — alla som använder det gamla namnet tar en klunk.',
    '🕵️ Gruppen ger dig en konspiration. Du har 90 sekunder på dig att göra den trovärdig med tre bevis.',
  ],
  // Level 4 — Gränsland
  [
    '🧾 Gruppen skriver Pontus bröllopstal på 3 minuter. Han framför det högt direkt — utan att ha läst det först.',
    '🔄 Du och personen till höger byter identitet i 15 minuter. Ni svarar på varandras frågor och beställer varandras nästa drink.',
    '🎯 Gruppen väljer tre påståenden om dig — ett sant och två falska. Du måste försvara alla tre som om de vore sanna. Gruppen gissar vilket som faktiskt stämmer.',
    '🎤 Gruppen väljer en person i sällskapet. Du håller ett 2-minuters roast om den personen — de får inte avbryta. Efteråt får de 30 sekunder att svara.',
    '📺 Du har 60 sekunder på dig att improvisera en reklamsnutt för Pontus — som produkt. Gruppen väljer målgrupp.',
  ],
  // Level 5 — Kaos
  [
    '🩲 Du klär av dig till bara underkläder. Klär sedan på dig igen.',
    '😱 Gruppen röstar fram det pinsammaste du kan göra på 60 sekunder. Vägrar du — svepa en öl.',
    '📞 Du ringer ett valfritt familjemedlem och förklarar att du kommit på något viktigt. Gruppen väljer vad det viktiga är. Lägger du på inom 30 sekunder — svepa en öl.',
    '🎲 Du väljer själv ett straff — gruppen röstar om det är tillräckligt hårt. Håller de inte med — de väljer ett eget.',
    '💔 Gruppen väljer ett föremål. Du håller ett genuint känsloladdat avskedstal till det i 60 sekunder — skrattar du börjar du om.',
  ],
];

function getWheelItems() {
  const level = Math.min(state.partyModeLevel || 0, WHEEL_ITEM_POOLS.length - 1);
  let items = [];
  for (let i = 0; i <= level; i++) items = items.concat(WHEEL_ITEM_POOLS[i]);
  if (state.wheelItems && state.wheelItems.length) items = items.concat(state.wheelItems);
  return items;
}

// ════════════════════════════════════════════════════════════════
// DECISION ANSWER POOLS  (unlocked progressively by partyModeLevel)
// ════════════════════════════════════════════════════════════════

const DECISION_ANSWER_POOLS = [
  // Level 0
  [
    'Absolut inte. 🚫',
    'Ditt framtida jag tackar dig för att du låter bli.',
    'Tre ord: Gör. Det. Inte.',
    'Andarna har talat… NEJ.',
    'Kanske om tio år. Inte idag.',
    'JA — men du kommer ångra dig. 😬',
    'Lyckan gynnar de modiga. Du är inte modig nog. NEJ.',
  ],
  // Level 1
  [
    '{{NAME}} skulle aldrig. Följ deras exempel.',
    'Magkänslan säger nej. Lyssna på den.',
    'Bra idé på pappret. Hemsk idé i verkligheten. NEJ.',
    'Kanske efter en drink till. 🍺',
    'Gruppen är splittrad. Det säger allt. NEJ.',
    'Dålig idé — men inte omöjlig. Kanske.',
    '{{NAME}} nickar tveksamt. Det räcker inte. NEJ.',
  ],
  // Level 2
  [
    'Myntet föll på… gör det.',
    'Alla bra historier börjar såhär. Alla dåliga också.',
    '{{NAME}} vill inte veta om det. Gör det ändå.',
    'Svaret beror på vad du menar med ska vi. NEJ.',
    'Garanterat dålig idé. Garanterat kul. Du väljer.',
    'Dina instinkter säger nej. Dina instinkter har haft fel förut.',
    'Fråga inte igen. Svaret är fortfarande oklart.',
  ],
  // Level 3
  [
    'Svaret är ja. Frågan var fel från början.',
    '{{NAME}} sätter sin heder på det. KÖR.',
    'Ångrar du dig sen? Definitivt. Värt det? Absolut.',
    'Gruppen är inne på det. En röst saknas — din.',
    'Livet är kort. Svaret borde vara ja. Men nej.',
    'Det finns en tid och plats för allt. Den är nu. JA.',
    '{{NAME}} hade aldrig frågat. De hade bara gjort det.',
  ],
  // Level 4
  [
    'Alla vill se det. Framförallt {{NAME}}. GÖR DET. 👀',
    'På en svensexa finns bara ett svar. JA. 🔥',
    '{{NAME}} förlåter dig aldrig om du inte gör det.',
    'Svaret är ja — gruppen filmar. Du vet om det.',
    'Pontus hade gjort det utan att tveka. KÖR.',
    'Dålig idé. Fantastisk historia. JA.',
    'Gruppen har röstat. Resultatet är hemligt. Men ja.',
  ],
  // Level 5
  [
    'JA. Nästa fråga.',
    'Självklart ja. Varför frågade du ens.',
    'Pontus kräver det. Gruppen kräver det. KÖR. 👑',
    'Det finns inget annat svar ikväll. JA. 🔥',
    '{{NAME}} går först. Sedan du. JA.',
  ],
];

function getDecisionAnswers() {
  const level = Math.min(state.partyModeLevel || 0, DECISION_ANSWER_POOLS.length - 1);
  let answers = [];
  for (let i = 0; i <= level; i++) answers = answers.concat(DECISION_ANSWER_POOLS[i]);
  return answers;
}

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
  if (tab === 'bomb' && bombExploded) {
    document.getElementById('bomb-game-panel').hidden    = true;
    document.getElementById('bomb-explode-panel').hidden = false;
  }
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
// KAOSLÄGE PICKER  (inline control shown on Bandit, Bomben, Ska vi?)
// ════════════════════════════════════════════════════════════════

const CHAOS_EMOJIS = ['😇', '🎉', '😬', '🎭', '🔥', '💥'];

function renderChaosPicker() {
  ['chaos-ctrl-wheel', 'chaos-ctrl-bomb', 'chaos-ctrl-decision'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const lvl = state.partyModeLevel || 0;
    el.innerHTML = `
      <div class="chaos-picker">
        <span class="chaos-picker-label">🔥 Kaosläge</span>
        <div class="chaos-picker-btns">
          ${CHAOS_EMOJIS.map((e, i) => `<button class="chaos-lvl-btn${lvl === i ? ' active' : ''}" data-level="${i}" aria-label="Kaosläge ${i}">${e}</button>`).join('')}
        </div>
      </div>`;
    el.querySelectorAll('.chaos-lvl-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        playSoundClick();
        haptic([10]);
        state.partyModeLevel = parseInt(btn.dataset.level, 10);
        saveState();
        renderChaosPicker();
        buildSlotTrack();
      });
    });
  });
}

// ════════════════════════════════════════════════════════════════
// SHOULD WE DO THIS?
// ════════════════════════════════════════════════════════════════

function rollDecision() {
  const answers = getDecisionAnswers();
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
  renderChaosPicker();
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
  const items = getWheelItems();
  renderChaosPicker();

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
  const items = getWheelItems();
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
// BOMBEN
// ════════════════════════════════════════════════════════════════

// Themes unlocked progressively with partyModeLevel
const BOMB_THEME_POOLS = [
  // Level 0 — helt SFW
  ['Bilmärken', 'Länder i Europa', 'Svenska städer', 'Djur', 'Frukter',
   'Sportgrenar', 'Maträtter', 'Musikartister', 'Filmer', 'Yrken',
   'Länder i världen', 'Fotbollsklubbar'],
  // Level 1
  ['Ölsorter', 'Drinkar', 'Saker man gör full',
   'Ursäkter att slippa jobbet', 'Saker som är bättre berusad'],
  // Level 2
  ['Svordomar', 'Saker som luktar illa', 'Cringe-minnen från tonåren',
   'Saker man skämts för', 'Dåliga pickup-lines'],
  // Level 3
  ['Smeknamn för snoppen', 'Smeknamn för fittan',
   'Saker som liknar en snopp', 'Saker man googlar i smyg',
   'Saker man inte erkänner att man tittar på'],
  // Level 4
  ['Sexställningar', 'Porrkategorier',
   'Saker man kan använda som dildo', 'Ovanliga platser att ha sex',
   'Saker som finns i en sexlåda'],
  // Level 5
  ['Saker att knulla om man var ensam på en ö',
   'Märkliga fetischer', 'Saker man kan använda på sig själv',
   'Ovanliga sexleksaker', 'Saker som låter som sexljud'],
];

let bombTickTimer = null;
let bombRunning   = false;
let bombExploded  = false;
let bombEndTime   = 0;
let bombCurrentTheme = '';

function getBombThemes() {
  const level = Math.min(state.partyModeLevel || 0, BOMB_THEME_POOLS.length - 1);
  let pool = [];
  for (let i = 0; i <= level; i++) pool = pool.concat(BOMB_THEME_POOLS[i]);
  return pool;
}

function playTick(fast) {
  playTone(fast ? 1200 : 900, 0.04, 'square', 0.18);
}

function playExplosion() {
  if (!state.soundsOn) return;
  try {
    const ctx = getAudioCtx();
    // Low thump
    const osc = ctx.createOscillator();
    const g1  = ctx.createGain();
    osc.connect(g1); g1.connect(ctx.destination);
    osc.frequency.setValueAtTime(100, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(28, ctx.currentTime + 0.45);
    g1.gain.setValueAtTime(0.7, ctx.currentTime);
    g1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
    osc.start(); osc.stop(ctx.currentTime + 0.45);
    // Noise burst
    const buf  = ctx.createBuffer(1, ctx.sampleRate * 0.55, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const src    = ctx.createBufferSource();
    src.buffer   = buf;
    const filt   = ctx.createBiquadFilter();
    filt.type    = 'lowpass';
    filt.frequency.value = 700;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.45, ctx.currentTime);
    g2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    src.connect(filt); filt.connect(g2); g2.connect(ctx.destination);
    src.start();
  } catch (_) {}
}

function setBombShake(remaining) {
  const el = document.getElementById('bomb-emoji');
  if (!el) return;
  if (remaining < 5000)       el.className = 'bomb-emoji bomb-shake-intense';
  else if (remaining < 10000) el.className = 'bomb-emoji bomb-shake-medium';
  else if (remaining < 20000) el.className = 'bomb-emoji bomb-shake-light';
  else                        el.className = 'bomb-emoji bomb-pulse';
}

function explodeBomb() {
  bombRunning  = false;
  bombExploded = true;
  clearTimeout(bombTickTimer);
  playExplosion();
  haptic([100, 50, 100, 50, 250]);
  confetti(80);
  const gamePanel    = document.getElementById('bomb-game-panel');
  const explodePanel = document.getElementById('bomb-explode-panel');
  if (gamePanel)    gamePanel.hidden    = true;
  if (explodePanel) explodePanel.hidden = false;
}

function bombTick() {
  if (!bombRunning) return;
  const remaining = bombEndTime - Date.now();
  if (remaining <= 0) { explodeBomb(); return; }

  const veryFast = remaining < 5000;
  const fast     = remaining < 10000;
  playTick(fast);
  if (veryFast)    haptic([30, 10, 30]);
  else if (fast)   haptic([15]);
  else             haptic([8]);
  setBombShake(remaining);

  bombTickTimer = setTimeout(bombTick, veryFast ? 350 : fast ? 600 : 1000);
}

function startBomb() {
  if (bombRunning) return;
  const themes = getBombThemes();
  bombCurrentTheme = themes[Math.floor(Math.random() * themes.length)];
  // Random duration 20 – 60 seconds (unknown to players)
  const duration = (20 + Math.floor(Math.random() * 41)) * 1000;
  bombEndTime  = Date.now() + duration;
  bombRunning  = true;
  bombExploded = false;

  const themeEl = document.getElementById('bomb-theme');
  if (themeEl) themeEl.textContent = bombCurrentTheme;
  document.getElementById('btn-bomb-start').hidden = true;
  document.getElementById('btn-bomb-stop').hidden  = false;
  const bombEl = document.getElementById('bomb-emoji');
  if (bombEl) bombEl.className = 'bomb-emoji bomb-pulse';

  haptic([20, 50, 20]);
  bombTickTimer = setTimeout(bombTick, 1000);
}

function stopBomb() {
  bombRunning = false;
  clearTimeout(bombTickTimer);
  document.getElementById('btn-bomb-start').hidden = false;
  document.getElementById('btn-bomb-stop').hidden  = true;
  const bombEl = document.getElementById('bomb-emoji');
  if (bombEl) bombEl.className = 'bomb-emoji';
  const themeEl = document.getElementById('bomb-theme');
  if (themeEl) themeEl.textContent = '–';
}

function initBomb() {
  renderChaosPicker();
  document.getElementById('btn-bomb-start').addEventListener('click', () => {
    playSoundClick();
    startBomb();
  });
  document.getElementById('btn-bomb-stop').addEventListener('click', () => {
    playSoundClick();
    stopBomb();
  });
  document.getElementById('btn-bomb-restart').addEventListener('click', () => {
    playSoundClick();
    bombExploded = false;
    document.getElementById('bomb-game-panel').hidden    = false;
    document.getElementById('bomb-explode-panel').hidden = true;
    stopBomb();
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
      <label>🎰 Bandit-alternativ</label>
      <p class="setting-note">Inbyggda alternativ: ${getWheelItems().length - (state.wheelItems || []).length} st (ändra kaosläget direkt i Bandit-fliken). Lägg till egna nedan:</p>
      <textarea id="settings-wheel-items" placeholder="Egna alternativ, ett per rad…">${(state.wheelItems || []).join('\n')}</textarea>
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
  initBomb();
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
