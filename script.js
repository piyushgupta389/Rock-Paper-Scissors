/* ============================================================
   NEON ARENA — Rock Paper Scissors  |  Clean v3
   ============================================================ */
'use strict';

// ---- State ----
const state = {
  mode: 'ai',
  difficulty: 'easy',
  scores: { player: 0, opponent: 0 },
  timer: 30,
  timerInterval: null,
  gameActive: true,
  playerHistory: [],
  lastPlayerMove: null,
  pvpTurn: 1,
  pvpP1Move: null,
  pvpP2Move: null,
  waiting: false,
};

// ---- Constants ----
const EMOJI    = { rock: '🪨', paper: '📄', scissors: '✂️' };
const MOVES    = ['rock', 'paper', 'scissors'];
const BEATS    = { rock: 'scissors', scissors: 'paper', paper: 'rock' };
const LOSES_TO = { rock: 'paper', paper: 'scissors', scissors: 'rock' };

// ---- Audio ----
const AudioCtx = window.AudioContext || window.webkitAudioContext;
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new AudioCtx();
  return audioCtx;
}
function playTone(type) {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    switch (type) {
      case 'click':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, now);
        osc.frequency.exponentialRampToValueAtTime(440, now + 0.08);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
        osc.start(now); osc.stop(now + 0.1);
        break;
      case 'reveal':
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(330, now);
        osc.frequency.exponentialRampToValueAtTime(660, now + 0.18);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
        osc.start(now); osc.stop(now + 0.2);
        break;
      case 'win': {
        const osc2  = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.connect(gain2); gain2.connect(ctx.destination);
        osc.type  = 'sine'; osc.frequency.setValueAtTime(523, now);
        osc2.type = 'sine'; osc2.frequency.setValueAtTime(784, now + 0.1);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
        gain2.gain.setValueAtTime(0.18, now + 0.1);
        gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
        osc.start(now);        osc.stop(now + 0.28);
        osc2.start(now + 0.1); osc2.stop(now + 0.4);
        break;
      }
      case 'lose':
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
        gain.gain.setValueAtTime(0.12, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
        osc.start(now); osc.stop(now + 0.3);
        break;
      case 'draw':
        osc.type = 'sine';
        osc.frequency.setValueAtTime(440, now);
        gain.gain.setValueAtTime(0.1, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        osc.start(now); osc.stop(now + 0.22);
        break;
    }
  } catch (e) {}
}

// ---- DOM Helpers ----
const $ = id => document.getElementById(id);
function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function setResult(text, emoji, cls) {
  const rt = $('resultText');
  const re = $('resultEmoji');
  rt.className = '';
  rt.textContent = text;
  if (cls) rt.classList.add(cls, 'pop');
  re.textContent = emoji;
  setTimeout(() => rt.classList.remove('pop'), 400);
}

function setMoveDisplay(side, move, animate = false) {
  const display = $('move' + side);
  const emojiEl = display.querySelector('.move-emoji');
  const nameEl  = $('moveName' + side);
  emojiEl.classList.remove('idle', 'reveal');
  emojiEl.textContent = EMOJI[move] || '❓';
  if (animate) {
    void emojiEl.offsetWidth;
    emojiEl.classList.add('reveal');
  }
  if (nameEl) nameEl.textContent = move ? move.toUpperCase() : '—';
}

function resetMoveDisplay(side) {
  const display = $('move' + side);
  const emojiEl = display.querySelector('.move-emoji');
  emojiEl.classList.remove('reveal');
  emojiEl.classList.add('idle');
  emojiEl.textContent = '❓';
  const nameEl = $('moveName' + side);
  if (nameEl) nameEl.textContent = '—';
  display.classList.remove('thinking');
}

function bumpScore(side) {
  const el = $('score' + side);
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
  setTimeout(() => el.classList.remove('bump'), 350);
}

function applyCardState(card, cls) {
  card.classList.remove('win-glow', 'lose-shake', 'draw-glow');
  void card.offsetWidth;
  card.classList.add(cls);
}

function disableButtons(disabled) {
  MOVES.forEach(m => { $('btn' + capitalize(m)).disabled = disabled; });
}

// ---- Particles ----
function initParticles() {
  const container = $('particles');
  container.innerHTML = '';
  for (let i = 0; i < 18; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 4 + 1;
    p.style.cssText = 'width:' + size + 'px;height:' + size + 'px;left:' + (Math.random()*100) + '%;animation-duration:' + (Math.random()*12+8) + 's;animation-delay:' + (Math.random()*10) + 's;opacity:0;';
    container.appendChild(p);
  }
}

// ---- Timer ----
function startTimer() {
  if (state.timerInterval) return;
  state.timerInterval = setInterval(function() {
    if (!state.gameActive) return;
    state.timer--;
    updateTimerUI();
    if (state.timer <= 0) {
      stopTimer();
      endGame();
    }
  }, 1000);
}

function startTimerUI() {
  if (state.timerInterval || !state.gameActive) return;
  setTimerButton(true);
  state.timer = 30;
  updateTimerUI();
  startTimer();
}

function updateTimerUI() {
  var num  = $('timerNum');
  var ring = $('timerRing');
  var wrap = num.closest('.timer-ring').parentElement;
  var circumference = 213.6;
  num.textContent = state.timer;
  ring.style.strokeDashoffset = circumference - (state.timer / 30) * circumference;
  wrap.classList.remove('timer-yellow', 'timer-red');
  if      (state.timer <= 5)  wrap.classList.add('timer-red');
  else if (state.timer <= 10) wrap.classList.add('timer-yellow');
}

function setTimerButton(running) {
  var btn = $('startTimerBtn');
  btn.disabled = running;
  btn.textContent = running ? 'TIMER RUNNING' : 'START TIMER';
  $('timerHelp').textContent = running ? 'Timer is counting down.' : 'Press to start the clock when ready.';
}

function stopTimer() {
  clearInterval(state.timerInterval);
  state.timerInterval = null;
  setTimerButton(false);
}

// ---- Game Over ----
function endGame() {
  state.gameActive = false;
  disableButtons(true);
  var p = state.scores.player;
  var o = state.scores.opponent;
  var icon  = $('gameoverIcon');
  var title = $('gameoverTitle');
  if (p > o) {
    icon.textContent  = '🏆';
    title.textContent = 'YOU WIN!';
    title.style.color = 'var(--win)';
  } else if (o > p) {
    icon.textContent  = '💀';
    title.textContent = 'YOU LOSE!';
    title.style.color = 'var(--lose)';
  } else {
    icon.textContent  = '🤝';
    title.textContent = "IT'S A TIE!";
    title.style.color = 'var(--draw)';
  }
  $('gameoverScore').textContent = p + ' – ' + o;
  $('gameoverSub').textContent   = 'You vs ' + (state.mode === 'pvp' ? 'P2' : 'AI');
  $('gameoverOverlay').style.display = 'flex';
}

// ---- AI Logic ----
function getAIMove() {
  var diff    = state.difficulty;
  var history = state.playerHistory;

  if (diff === 'easy') {
    return MOVES[Math.floor(Math.random() * 3)];
  }
  if (diff === 'medium') {
    if (state.lastPlayerMove && Math.random() < 0.5) {
      return LOSES_TO[state.lastPlayerMove];
    }
    return MOVES[Math.floor(Math.random() * 3)];
  }
  if (diff === 'hard') {
    var recent = history.slice(-6);
    if (recent.length >= 3 && Math.random() < 0.72) {
      var freq = { rock: 0, paper: 0, scissors: 0 };
      recent.forEach(function(m) { freq[m]++; });
      var likelyMove = Object.keys(freq).reduce(function(a, b) { return freq[a] > freq[b] ? a : b; });
      return LOSES_TO[likelyMove];
    }
    if (state.lastPlayerMove && Math.random() < 0.45) {
      return LOSES_TO[state.lastPlayerMove];
    }
    return MOVES[Math.floor(Math.random() * 3)];
  }
  return MOVES[Math.floor(Math.random() * 3)];
}

// ---- Resolve Round ----
function resolveRound(playerMove, opponentMove) {
  if (playerMove === opponentMove)         return 'draw';
  if (BEATS[playerMove] === opponentMove)  return 'win';
  return 'lose';
}

// ---- Apply Outcome (AI) ----
function applyOutcome(outcome, playerMove, aiMove) {
  var cardPlayer   = $('cardPlayer');
  var cardOpponent = $('cardOpponent');
  if (outcome === 'win') {
    state.scores.player++;
    $('scorePlayer').textContent = state.scores.player;
    bumpScore('Player');
    setResult('YOU WIN!', '🎉', 'win');
    applyCardState(cardPlayer,   'win-glow');
    applyCardState(cardOpponent, 'lose-shake');
    playTone('win');
  } else if (outcome === 'lose') {
    state.scores.opponent++;
    $('scoreOpponent').textContent = state.scores.opponent;
    bumpScore('Opponent');
    setResult('YOU LOSE!', '😈', 'lose');
    applyCardState(cardPlayer,   'lose-shake');
    applyCardState(cardOpponent, 'win-glow');
    playTone('lose');
  } else {
    setResult("DRAW!", '😐', 'draw');
    applyCardState(cardPlayer,   'draw-glow');
    applyCardState(cardOpponent, 'draw-glow');
    playTone('draw');
  }
  $('roundInfo').textContent = capitalize(playerMove) + ' vs ' + capitalize(aiMove);
}

// ---- Apply Outcome (PVP) ----
function applyOutcomePVP(outcome, p1Move, p2Move) {
  var cardPlayer   = $('cardPlayer');
  var cardOpponent = $('cardOpponent');
  if (outcome === 'win') {
    state.scores.player++;
    $('scorePlayer').textContent = state.scores.player;
    bumpScore('Player');
    setResult('P1 WINS!', '🎉', 'win');
    applyCardState(cardPlayer,   'win-glow');
    applyCardState(cardOpponent, 'lose-shake');
    playTone('win');
  } else if (outcome === 'lose') {
    state.scores.opponent++;
    $('scoreOpponent').textContent = state.scores.opponent;
    bumpScore('Opponent');
    setResult('P2 WINS!', '🏆', 'lose');
    applyCardState(cardPlayer,   'lose-shake');
    applyCardState(cardOpponent, 'win-glow');
    playTone('lose');
  } else {
    setResult("DRAW!", '😐', 'draw');
    applyCardState(cardPlayer,   'draw-glow');
    applyCardState(cardOpponent, 'draw-glow');
    playTone('draw');
  }
  $('roundInfo').textContent = capitalize(p1Move) + ' vs ' + capitalize(p2Move);
}

// ---- Handle AI Mode (SINGLE definition, fast delay) ----
function handleAIMode(move) {
  if (state.waiting || !state.gameActive) return;
  state.waiting = true;
  disableButtons(true);
  playTone('click');

  // Show player move instantly
  setMoveDisplay('Player', move, true);

  // AI thinking indicator
  var oppDisplay = $('moveOpponent');
  var oppEmoji   = oppDisplay.querySelector('.move-emoji');
  oppEmoji.classList.remove('reveal');
  oppEmoji.classList.add('idle');
  oppEmoji.textContent = '🤔';
  oppDisplay.classList.add('thinking');
  setResult('AI thinking', '', '');
  $('resultText').classList.add('thinking-dots');

  // ✅ FAST: 400–600ms total. ~3–4 rounds per 30 seconds comfortably
  setTimeout(function() {
    var aiMove = getAIMove();

    state.lastPlayerMove = move;
    state.playerHistory.push(move);

    oppDisplay.classList.remove('thinking');
    $('resultText').classList.remove('thinking-dots');

    setMoveDisplay('Opponent', aiMove, true);
    playTone('reveal');

    var outcome = resolveRound(move, aiMove);
    applyOutcome(outcome, move, aiMove);

    state.waiting = false;
    disableButtons(false);
  }, 400 + Math.random() * 200); // 400–600ms
}

// ---- Handle PVP Mode ----
function handlePVPMode(move) {
  if (state.waiting || !state.gameActive) return;
  if (state.pvpTurn === 1) {
    playTone('click');
    state.pvpP1Move = move;
    state.pvpTurn   = 2;
    updatePVPIndicator();
    resetMoveDisplay('Player');
    resetMoveDisplay('Opponent');
    var p1Emoji = $('movePlayer').querySelector('.move-emoji');
    p1Emoji.classList.remove('idle');
    p1Emoji.textContent = '🔒';
  } else {
    playTone('click');
    state.pvpP2Move = move;
    setTimeout(function() {
      setMoveDisplay('Player',   state.pvpP1Move, true);
      setMoveDisplay('Opponent', state.pvpP2Move, true);
      playTone('reveal');
      state.lastPlayerMove = state.pvpP1Move;
      state.playerHistory.push(state.pvpP1Move);
      var outcome = resolveRound(state.pvpP1Move, state.pvpP2Move);
      applyOutcomePVP(outcome, state.pvpP1Move, state.pvpP2Move);
      state.pvpTurn   = 1;
      state.pvpP1Move = null;
      state.pvpP2Move = null;
      updatePVPIndicator();
    }, 200);
  }
}

// ---- Player Move Entry ----
function playerMove(move) {
  if (!state.gameActive) return;
  if (state.mode === 'ai') handleAIMode(move);
  else                     handlePVPMode(move);
}

// ---- Mode Switching ----
function setMode(mode) {
  if (state.mode === mode) return;
  state.mode = mode;
  $('modeAI').classList.toggle('active',  mode === 'ai');
  $('modePVP').classList.toggle('active', mode === 'pvp');
  var diffBar = $('difficultyBar');
  if (mode === 'ai') {
    diffBar.classList.remove('hidden');
    $('labelRight').textContent       = 'AI';
    $('cardOpponentLabel').textContent = 'AI';
    $('labelLeft').textContent         = 'YOU';
    $('cardPlayerLabel').textContent   = 'PLAYER';
    $('pvpIndicator').style.display    = 'none';
  } else {
    diffBar.classList.add('hidden');
    $('labelRight').textContent        = 'P2';
    $('cardOpponentLabel').textContent = 'PLAYER 2';
    $('labelLeft').textContent         = 'P1';
    $('cardPlayerLabel').textContent   = 'PLAYER 1';
    $('pvpIndicator').style.display    = 'flex';
  }
  resetGame();
}

// ---- Difficulty Switching ----
function setDifficulty(diff) {
  if (state.difficulty === diff) return;
  state.difficulty = diff;
  ['Easy', 'Medium', 'Hard'].forEach(function(d) {
    $('diff' + d).classList.toggle('active', d.toLowerCase() === diff);
  });
  resetGame();
}

// ---- PVP Indicator ----
function updatePVPIndicator() {
  if (state.mode !== 'pvp') return;
  var badge  = $('turnBadge');
  var notice = $('hiddenNotice');
  if (state.pvpTurn === 1) {
    badge.textContent  = "🟢 Player 1's Turn";
    notice.textContent = 'Your move is hidden from Player 2';
  } else {
    badge.textContent  = "🔵 Player 2's Turn";
    notice.textContent = 'Your move is hidden from Player 1';
  }
}

// ---- Reset ----
function resetGame() {
  stopTimer();
  state.gameActive     = true;
  state.waiting        = false;
  state.scores         = { player: 0, opponent: 0 };
  state.playerHistory  = [];
  state.lastPlayerMove = null;
  state.pvpTurn        = 1;
  state.pvpP1Move      = null;
  state.pvpP2Move      = null;

  $('scorePlayer').textContent   = '0';
  $('scoreOpponent').textContent = '0';
  $('resultText').textContent    = 'Pick your move!';
  $('resultText').className      = '';
  $('resultEmoji').textContent   = '';
  $('roundInfo').textContent     = '';

  resetMoveDisplay('Player');
  resetMoveDisplay('Opponent');
  $('cardPlayer').classList.remove('win-glow', 'lose-shake', 'draw-glow');
  $('cardOpponent').classList.remove('win-glow', 'lose-shake', 'draw-glow');

  disableButtons(false);
  $('gameoverOverlay').style.display = 'none';

  if (state.mode === 'pvp') {
    updatePVPIndicator();
    $('pvpIndicator').style.display = 'flex';
  } else {
    $('pvpIndicator').style.display = 'none';
  }

  state.timer = 30;
  updateTimerUI();
  setTimerButton(false);
}

// ---- Button bounce ----
MOVES.forEach(function(m) {
  var btn = $('btn' + capitalize(m));
  btn.addEventListener('mousedown', function() {
    btn.classList.remove('clicked');
    void btn.offsetWidth;
    btn.classList.add('clicked');
  });
  btn.addEventListener('animationend', function() { btn.classList.remove('clicked'); });
});

// ---- Wake AudioContext ----
document.addEventListener('click', function() { try { getAudioCtx(); } catch(e) {} }, { once: true });

// ---- Init ----
initParticles();
resetGame();