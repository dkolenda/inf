// Gra „Obrona zamku” (w stylu Epistory): potwory idą z góry na zamek stojący na dole.
// Gracz pokonuje je, wpisując z klawiatury słowa nad nimi (także z polskimi literami).
// Zaczęte słowo trzeba dokończyć, zanim można wybrać inny cel.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…)
// oraz z burstFileGameConfetti z file-game.js.
let typingGame = null;

// Zamek. Elementy tg-d1…tg-d3 pokazują się razem z kolejnymi uszkodzeniami (klasy dmg-1…dmg-3).
const typingCastleSvg = `
  <svg viewBox="0 0 240 170" aria-hidden="true">
    <ellipse cx="120" cy="166" rx="118" ry="6" fill="#9fd36a" />
    <g fill="#d8c7a8" stroke="#7d6a52" stroke-width="3" stroke-linejoin="round">
      <rect x="60" y="92" width="120" height="74" />
      <rect x="62" y="82" width="12" height="12" /><rect x="78" y="82" width="12" height="12" />
      <rect x="150" y="82" width="12" height="12" /><rect x="166" y="82" width="12" height="12" />
      <rect x="14" y="66" width="48" height="100" />
      <path class="tg-top-left" d="M10 70V44h12v10h10V44h12v10h10V44h12v26z" />
      <rect x="178" y="66" width="48" height="100" />
      <path class="tg-top-right" d="M174 70V44h12v10h10V44h12v10h10V44h12v26z" />
      <rect x="92" y="54" width="56" height="112" />
    </g>
    <path class="tg-roof" d="M86 56 120 22l34 34z" fill="#9069cd" stroke="#5e3f91" stroke-width="3" stroke-linejoin="round" />
    <g class="tg-flag">
      <path d="M120 22V3" stroke="#5d4a35" stroke-width="3" />
      <path d="M121 4l18 5-18 5z" fill="#ff4b4b" />
    </g>
    <g fill="#4b3a2a">
      <rect x="32" y="88" width="12" height="18" rx="6" />
      <rect x="196" y="88" width="12" height="18" rx="6" />
      <rect x="113" y="72" width="14" height="20" rx="7" />
      <path d="M104 166v-26a16 16 0 0 1 32 0v26z" />
    </g>
    <g class="tg-d1" fill="none" stroke="#4b3a2a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M40 112l6 10-6 9 7 12" />
      <path d="M164 100l-7 10 6 8-4 9" />
      <path d="M134 104l-6 10 7 10" />
    </g>
    <g class="tg-d2">
      <path d="M14 70l6-8 8 6 8-10 10 8 8-6 8 8v4H14z" fill="#d8c7a8" stroke="#7d6a52" stroke-width="3" stroke-linejoin="round" />
      <g fill="none" stroke="#4b3a2a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M206 120l-6 9 5 8-6 12" />
        <path d="M74 110l8 8-5 9 6 10" />
      </g>
      <g class="tg-fire">
        <path d="M190 46c0-10 6-14 8-22 4 6 4 10 8 4 6 8 10 12 8 18z" fill="#ff9600" />
        <path d="M196 46c0-6 3-8 4-12 3 4 3 6 5 3 3 4 4 6 3 9z" fill="#ffc800" />
      </g>
      <circle class="tg-smoke" cx="202" cy="20" r="7" fill="#9aa5ad" />
      <circle class="tg-smoke tg-smoke-late" cx="196" cy="14" r="5" fill="#9aa5ad" />
    </g>
    <g class="tg-d3">
      <path d="M92 58l8-6 7 6 9-8 8 7 10-6 6 5 8-4v8H92z" fill="#d8c7a8" stroke="#7d6a52" stroke-width="3" stroke-linejoin="round" />
      <path d="M178 70l8-10 9 6 10-8 8 8 13-4v8h-48z" fill="#d8c7a8" stroke="#7d6a52" stroke-width="3" stroke-linejoin="round" />
      <g class="tg-fire">
        <path d="M100 58c0-12 8-16 10-26 5 8 5 12 10 5 7 10 12 14 10 21z" fill="#ff4b4b" />
        <path d="M108 58c0-7 4-9 5-14 4 5 4 7 6 4 4 5 5 7 4 10z" fill="#ffc800" />
      </g>
      <g fill="#a8957a" stroke="#7d6a52" stroke-width="2">
        <path d="M66 166l6-10 10 2 4 8z" /><path d="M150 166l4-8 10-1 6 9z" /><path d="M24 166l5-7 8 1 3 6z" />
      </g>
    </g>
  </svg>
`;

const typingEnemyIcons = { fast: '👾', slow: '🛡️', boss: '👹' };

function renderTypingGame(topic, index, game) {
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    `Potwory idą na Twój zamek! Wpisz słowo nad potworem, aby go trafić — każde słowo to ${game.wordPoints} pkt. ` +
    'Gdy zaczniesz pisać słowo, musisz je dokończyć. ' +
    `Masz ${game.lives} życia — każdy potwór, który dojdzie do zamku, uszkadza go. Zdobądź ${game.goal} pkt!`;
  setQuizProgress(0);

  const { fast, slow, boss } = game.enemies;
  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro';
  body.innerHTML = `
    <div class="bg-legend">
      ${[[fast, '1 słowo'], [slow, '3 słowa'], [boss, `6 słów, od ${game.bossAt} pkt`]].map(([kind, text]) => `
        <span class="bg-legend-item">
          <span class="tg-legend-icon tg-${kind.id}" aria-hidden="true">${typingEnemyIcons[kind.id]}</span>
          <span><b>${kind.label}</b>${text}</span>
        </span>`).join('')}
      ${game.powers.map((power) => `
        <span class="bg-legend-item is-power">
          <span class="tg-legend-icon" aria-hidden="true">${power.icon}</span>
          <span><b>${power.label}</b>${power.text}</span>
        </span>`).join('')}
    </div>
    <p class="tg-intro-tip">Polskie litery piszesz z prawym <kbd>Alt</kbd>, np. <kbd>Alt</kbd> + <kbd>a</kbd> = <b>ą</b>, <kbd>Alt</kbd> + <kbd>x</kbd> = <b>ź</b>.</p>
    <p class="tg-levels-title">Wybierz poziom trudności:</p>
    <div class="tg-levels" role="radiogroup" aria-label="Poziom trudności">
      ${game.difficulties.map((level) => `
        <button class="tg-level" type="button" role="radio" data-level="${level.id}" aria-checked="${level.id === game.defaultDifficulty}">
          <span class="tg-level-icon" aria-hidden="true">${level.icon}</span>
          <b>${level.label}</b>
          <span class="tg-level-reward">+${level.reward} pkt</span>
          <small>${level.text}</small>
        </button>`).join('')}
    </div>
    <button class="primary-button fg-start" type="button">Start <span aria-hidden="true">▶</span></button>
  `;
  let difficulty = game.difficulties.find((level) => level.id === game.defaultDifficulty);
  body.querySelectorAll('.tg-level').forEach((button) => {
    button.addEventListener('click', () => {
      difficulty = game.difficulties.find((level) => level.id === button.dataset.level);
      body.querySelectorAll('.tg-level').forEach((other) => other.setAttribute('aria-checked', String(other === button)));
    });
  });
  body.querySelector('.fg-start').addEventListener('click', () => startTypingGame(topic, index, game, difficulty));
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startTypingGame(topic, index, game, difficulty) {
  stopTypingGame();
  document.activeElement?.blur();
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent = 'Pisz słowa nad potworami. Zaczęte słowo trzeba dokończyć!';
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg tg';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-lives" aria-label="Życia: ${game.lives}">${'<span class="fg-heart" aria-hidden="true">♥</span>'.repeat(game.lives)}</span>
      <span class="fg-score">Wynik: <b>0</b> / ${game.goal}</span>
      <span class="tg-wave">${difficulty.icon} ${difficulty.label} · Fala <b>1</b></span>
      ${game.powers.map((power) => `
        <span class="tg-power-badge" data-power="${power.id}" hidden>${power.icon} ${power.label}<i></i></span>`).join('')}
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end" type="button" hidden>Zakończ grę</button>
    </div>
    <p class="fg-banner" role="status" hidden></p>
    <div class="tg-field">
      <div class="tg-castle">${typingCastleSvg}</div>
    </div>
    <div class="fg-overlay" hidden><div class="fg-overlay-card"></div></div>
  `;

  typingGame = {
    topic,
    index,
    game,
    difficulty,
    body,
    field: body.querySelector('.tg-field'),
    castle: body.querySelector('.tg-castle'),
    entities: [],
    target: null,
    recentWords: [],
    score: 0,
    lives: game.lives,
    words: 0,
    kills: 0,
    keys: 0,
    mistakes: 0,
    wave: 0,
    waveLeft: 0,
    spawnTimer: 0,
    waveCooldown: 1,
    bossSpawned: false,
    powerTimer: game.powerEvery[0] * difficulty.powerEvery / 2,
    powers: { line: 0, radius: 0 },
    paused: false,
    goalReached: false,
    lastTime: performance.now(),
    frameId: 0,
    messageTimer: 0,
    bannerTimer: 0
  };

  body.querySelector('.fg-end').addEventListener('click', finishTypingGame);
  document.addEventListener('keydown', handleTypingKey);
  typingGame.frameId = requestAnimationFrame(typingGameTick);
}

function stopTypingGame() {
  if (!typingGame) return;
  cancelAnimationFrame(typingGame.frameId);
  clearTimeout(typingGame.messageTimer);
  clearTimeout(typingGame.bannerTimer);
  document.removeEventListener('keydown', handleTypingKey);
  typingGame = null;
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function aliveTypingEntities(type) {
  return typingGame.entities.filter((entity) => !entity.done && (!type || entity.type === type));
}

// Słowo dla nowego celu: najlepiej na literę, na którą nie zaczyna się żaden inny cel na planszy,
// żeby pierwsza wpisana litera jednoznacznie wybierała potwora.
function pickTypingWord(pool, self) {
  const state = typingGame;
  const usedLetters = new Set(aliveTypingEntities().filter((entity) => entity !== self).map((entity) => entity.word[0]));
  const freeLetter = pool.filter((word) => !usedLetters.has(word[0]));
  const fresh = freeLetter.filter((word) => !state.recentWords.includes(word));
  let list = fresh.length ? fresh : freeLetter.length ? freeLetter : pool;
  // Na łatwym poziomie częściej losujemy z krótszej połowy dostępnych słów.
  if (Math.random() < state.difficulty.shortWords) {
    const lengths = list.map((word) => word.length).sort((a, b) => a - b);
    const median = lengths[Math.floor((lengths.length - 1) / 2)];
    list = list.filter((word) => word.length <= median);
  }
  const word = list[Math.floor(Math.random() * list.length)];
  state.recentWords.push(word);
  if (state.recentWords.length > 15) state.recentWords.shift();
  return word;
}

function createTypingEntity({ type, kind, x, y }) {
  const state = typingGame;
  const element = document.createElement('div');
  element.className = type === 'power' ? `tg-entity tg-power tg-power-${kind.id}` : `tg-entity tg-enemy tg-${kind.id}`;
  element.innerHTML = `
    <span class="tg-word"></span>
    <span class="tg-body" aria-hidden="true">${type === 'power' ? kind.icon : typingEnemyIcons[kind.id]}</span>
  `;
  state.field.append(element);
  const entity = {
    type,
    kind,
    element,
    wordElement: element.querySelector('.tg-word'),
    word: '',
    progress: 0,
    hp: kind.words || 1,
    x,
    y,
    done: false
  };
  entity.word = pickTypingWord(kind.pool, entity);
  renderTypingWord(entity);
  placeTypingEntity(entity);
  state.entities.push(entity);
  return entity;
}

function spawnTypingEnemy(kind) {
  const { field } = typingGame;
  const width = field.clientWidth;
  const height = field.clientHeight;
  const castleWidth = typingGame.castle.offsetWidth;
  const margin = Math.min(70, width / 4);
  const entity = createTypingEntity({ type: 'enemy', kind, x: randomBetween(margin, width - margin), y: kind.id === 'boss' ? 40 : 30 });
  entity.tx = width / 2 + randomBetween(-0.32, 0.32) * castleWidth;
  entity.ty = height - typingGame.castle.offsetHeight * 0.55;
  entity.speed = kind.speed * randomBetween(0.9, 1.1);
}

function spawnTypingPower() {
  const { field, game } = typingGame;
  const power = game.powers[Math.floor(Math.random() * game.powers.length)];
  const width = field.clientWidth;
  const height = field.clientHeight;
  const entity = createTypingEntity({
    type: 'power',
    kind: power,
    x: randomBetween(Math.min(80, width / 4), width - Math.min(80, width / 4)),
    y: randomBetween(height * 0.2, height * 0.5)
  });
  entity.life = game.powerLife * typingGame.difficulty.powerLife;
  entity.baseY = entity.y;
  entity.age = 0;
}

function renderTypingWord(entity) {
  const typed = entity.word.slice(0, entity.progress);
  const rest = entity.word.slice(entity.progress);
  const pips = entity.kind.words > 1
    ? `<span class="tg-pips">${Array.from({ length: entity.kind.words }, (_, pip) => `<i class="${pip < entity.hp ? 'is-on' : ''}"></i>`).join('')}</span>`
    : '';
  entity.wordElement.innerHTML = `<span class="tg-letters"><b>${typed}</b>${rest}</span>${pips}`;
}

function placeTypingEntity(entity) {
  entity.element.style.transform = `translate(${entity.x}px, ${entity.y}px) translate(-50%, -50%)`;
}

function startTypingWave() {
  const state = typingGame;
  const { waves } = state.game;
  state.wave += 1;
  state.waveLeft = Math.min(waves.max, waves.first + state.wave);
  state.spawnTimer = 0.4;
  state.waveCooldown = state.game.waveBreak;
  state.body.querySelector('.tg-wave b').textContent = state.wave;
  showTypingBanner(`Fala ${state.wave}! Nadchodzi ${state.waveLeft} potworów.`);
}

function drawTypingEnemyKind() {
  const { game, wave } = typingGame;
  const { waves } = game;
  const slowChance = Math.min(waves.slowChanceMax, waves.slowChance + waves.slowChancePerWave * wave);
  return Math.random() < slowChance ? game.enemies.slow : game.enemies.fast;
}

function typingGameTick(now) {
  const state = typingGame;
  if (!state) return;
  const dt = Math.max(0, Math.min(0.05, (now - state.lastTime) / 1000));
  state.lastTime = now;

  if (!state.paused) {
    updateTypingPowers(dt);
    updateTypingSpawns(dt);
    if (typingGame === state) updateTypingEntities(dt);
  }

  // Po końcu gry (albo starcie od nowa) stara pętla się zatrzymuje.
  if (typingGame === state) state.frameId = requestAnimationFrame(typingGameTick);
}

function updateTypingPowers(dt) {
  const state = typingGame;
  state.game.powers.forEach((power) => {
    const badge = state.body.querySelector(`.tg-power-badge[data-power="${power.id}"]`);
    if (state.powers[power.id] > 0) {
      state.powers[power.id] = Math.max(0, state.powers[power.id] - dt);
      badge.style.setProperty('--left', state.powers[power.id] / typingPowerDuration());
      if (!state.powers[power.id]) showTypingMessage(`${power.label} przestał działać`, 'bad');
    }
    badge.hidden = !state.powers[power.id];
  });
  state.field.classList.toggle('is-line', state.powers.line > 0);
  state.field.classList.toggle('is-radius', state.powers.radius > 0);
}

function updateTypingSpawns(dt) {
  const state = typingGame;
  const { game } = state;

  if (!state.bossSpawned && state.score > game.bossAt) {
    state.bossSpawned = true;
    spawnTypingEnemy(game.enemies.boss);
    showTypingBanner('Uwaga! Nadchodzi boss — potrzebuje aż 6 słów!');
  }

  const enemies = aliveTypingEntities('enemy');
  if (state.waveLeft > 0) {
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0 && enemies.length < game.maxAlive) {
      spawnTypingEnemy(drawTypingEnemyKind());
      state.waveLeft -= 1;
      state.spawnTimer = Math.max(game.waves.gapMin, game.waves.gap - game.waves.gapPerWave * state.wave) * randomBetween(0.8, 1.2);
    }
  } else if (!enemies.some((enemy) => enemy.kind.id !== 'boss')) {
    // Fala pokonana — chwila przerwy i kolejna fala.
    state.waveCooldown -= dt;
    if (state.waveCooldown <= 0) startTypingWave();
  }

  if (state.score >= game.powerFrom && !aliveTypingEntities('power').length) {
    state.powerTimer -= dt;
    if (state.powerTimer <= 0) {
      spawnTypingPower();
      state.powerTimer = randomBetween(...game.powerEvery) * state.difficulty.powerEvery;
    }
  }
}

function updateTypingEntities(dt) {
  const state = typingGame;
  const factor = (state.score < state.game.slowUntil ? state.game.slowFactor : 1) * state.difficulty.speed;

  state.entities.forEach((entity) => {
    if (entity.done || typingGame !== state) return;

    if (entity.type === 'power') {
      entity.age += dt;
      entity.life -= dt;
      entity.y = entity.baseY + Math.sin(entity.age * 3) * 6;
      entity.element.classList.toggle('is-fading', entity.life < 1.5);
      placeTypingEntity(entity);
      if (entity.life <= 0) removeTypingEntity(entity, 'is-gone');
      return;
    }

    const dx = entity.tx - entity.x;
    const dy = entity.ty - entity.y;
    const distance = Math.hypot(dx, dy);
    const step = entity.speed * factor * dt;
    if (distance <= step) {
      removeTypingEntity(entity, 'is-exploded');
      showTypingMessage(entity.kind.id === 'boss' ? 'Boss uderzył w zamek!' : 'Potwór uderzył w zamek!', 'bad');
      loseTypingLife();
      return;
    }
    entity.x += (dx / distance) * step;
    entity.y += (dy / distance) * step;
    placeTypingEntity(entity);
  });

  if (typingGame === state) state.entities = state.entities.filter((entity) => !entity.done);
}

function removeTypingEntity(entity, effect) {
  const state = typingGame;
  entity.done = true;
  if (state.target === entity) state.target = null;
  entity.element.classList.remove('is-target');
  entity.element.classList.add(effect);
  entity.element.addEventListener('animationend', () => entity.element.remove(), { once: true });
}

function handleTypingKey(event) {
  const state = typingGame;
  if (!state || state.paused) return;
  // Prawy Alt w Windows to Ctrl+Alt, więc sam Ctrl (skróty) pomijamy, a Ctrl+Alt (polskie litery) nie.
  if (event.metaKey || (event.ctrlKey && !event.altKey)) return;
  if (event.key === ' ') {
    event.preventDefault();
    return;
  }
  const letter = event.key.length === 1 ? event.key.toLocaleLowerCase('pl') : '';
  if (!/\p{L}/u.test(letter)) return;
  event.preventDefault();
  if (event.repeat) return;
  state.keys += 1;

  if (!state.target) {
    // Nowy cel: spośród słów na tę literę wybieramy potwora najbliżej zamku.
    const candidates = aliveTypingEntities().filter((entity) => entity.word[0] === letter);
    if (!candidates.length) {
      typingMistake(null, letter);
      return;
    }
    state.target = candidates.reduce((best, entity) => (entity.y > best.y ? entity : best));
    state.target.element.classList.add('is-target');
  } else if (state.target.word[state.target.progress] !== letter) {
    typingMistake(state.target, letter);
    return;
  }

  const target = state.target;
  target.progress += 1;
  renderTypingWord(target);
  if (target.progress >= target.word.length) completeTypingWord(target);
}

function typingMistake(target, letter) {
  const state = typingGame;
  state.mistakes += 1;
  if (target) {
    const word = target.wordElement;
    word.classList.remove('is-wrong');
    void word.offsetWidth;
    word.classList.add('is-wrong');
    showTypingMessage(`Dokończ słowo „${target.word}”`, 'bad');
  } else {
    showTypingMessage(`Żadne słowo nie zaczyna się na „${letter}”`, 'bad');
  }
}

function completeTypingWord(target) {
  const state = typingGame;
  state.target = null;
  target.element.classList.remove('is-target');

  if (target.type === 'power') {
    removeTypingEntity(target, 'is-collected');
    state.powers[target.kind.id] = typingPowerDuration();
    showTypingBanner(`${target.kind.icon} ${target.kind.label}! Przez ${typingPowerDuration()} s ${target.kind.text}.`);
    return;
  }

  fireTypingShot(target);
  const hits = new Set([target]);
  const enemies = aliveTypingEntities('enemy');
  if (state.powers.line > 0) {
    showTypingBeam(target.x);
    enemies.filter((enemy) => Math.abs(enemy.x - target.x) <= typingLineWidth() / 2).forEach((enemy) => hits.add(enemy));
  }
  if (state.powers.radius > 0) {
    showTypingRing(target.x, target.y);
    enemies.filter((enemy) => Math.hypot(enemy.x - target.x, enemy.y - target.y) <= typingRadius()).forEach((enemy) => hits.add(enemy));
  }
  hits.forEach((enemy) => {
    if (typingGame === state && !enemy.done) damageTypingEnemy(enemy);
  });
}

function damageTypingEnemy(enemy) {
  const state = typingGame;
  enemy.hp -= 1;
  state.words += 1;
  const rect = enemy.element.getBoundingClientRect();
  showTypingFloat(enemy, `+${state.game.wordPoints}`);

  if (enemy.hp <= 0) {
    state.kills += 1;
    burstFileGameConfetti(rect, enemy.kind.id === 'boss' ? '#ff4b4b' : '#9069cd');
    removeTypingEntity(enemy, 'is-defeated');
    if (enemy.kind.id === 'boss') showTypingBanner('Boss pokonany! Brawo!');
  } else {
    // Potwór przeżył — dostaje nowe słowo do wpisania.
    enemy.progress = 0;
    enemy.word = pickTypingWord(enemy.kind.pool, enemy);
    renderTypingWord(enemy);
    enemy.element.classList.remove('is-hit');
    void enemy.element.offsetWidth;
    enemy.element.classList.add('is-hit');
  }
  addTypingScore(state.game.wordPoints);
}

function typingCastleTop() {
  const { field, castle } = typingGame;
  return { x: field.clientWidth / 2, y: field.clientHeight - castle.offsetHeight + 10 };
}

function fireTypingShot(target) {
  const from = typingCastleTop();
  const shot = document.createElement('span');
  shot.className = 'tg-shot';
  typingGame.field.append(shot);
  const animation = shot.animate([
    { transform: `translate(${from.x}px, ${from.y}px)` },
    { transform: `translate(${target.x}px, ${target.y}px)` }
  ], { duration: 160, easing: 'ease-in' });
  animation.onfinish = () => shot.remove();
}

function showTypingBeam(x) {
  const beam = document.createElement('span');
  beam.className = 'tg-beam';
  beam.style.left = `${x}px`;
  beam.style.width = `${typingLineWidth()}px`;
  typingGame.field.append(beam);
  beam.addEventListener('animationend', () => beam.remove(), { once: true });
}

function showTypingRing(x, y) {
  const ring = document.createElement('span');
  ring.className = 'tg-ring';
  const size = typingRadius() * 2;
  Object.assign(ring.style, { left: `${x}px`, top: `${y}px`, width: `${size}px`, height: `${size}px` });
  typingGame.field.append(ring);
  ring.addEventListener('animationend', () => ring.remove(), { once: true });
}

function showTypingFloat(entity, text) {
  const label = document.createElement('span');
  label.className = 'bg-float';
  label.textContent = text;
  label.style.left = `${entity.x}px`;
  label.style.top = `${entity.y}px`;
  typingGame.field.append(label);
  label.addEventListener('animationend', () => label.remove(), { once: true });
}

function addTypingScore(points) {
  const state = typingGame;
  const { game } = state;
  const before = state.score;
  state.score += points;
  state.body.querySelector('.fg-score b').textContent = state.score;
  setQuizProgress(Math.min(1, state.score / game.goal));

  if (before < game.slowUntil && state.score >= game.slowUntil) {
    showTypingBanner('Rozgrzewka skończona — potwory idą teraz szybciej!');
  }

  if (!state.goalReached && state.score >= game.goal) {
    state.goalReached = true;
    showTypingOverlay({
      icon: '🏆',
      title: `Masz ${game.goal} punktów!`,
      text: `Zamek obroniony! Możesz grać dalej i bić rekord albo zakończyć grę i odebrać ${state.difficulty.reward} punktów.`,
      secondary: {
        label: 'Graj dalej',
        action: () => {
          hideTypingOverlay();
          state.body.querySelector('.fg-end').hidden = false;
        }
      },
      primary: { label: `Zakończ i odbierz ${state.difficulty.reward} pkt`, action: finishTypingGame }
    });
  }
}

function loseTypingLife() {
  const state = typingGame;
  state.lives -= 1;
  const hearts = state.body.querySelector('.fg-lives');
  hearts.setAttribute('aria-label', `Życia: ${state.lives}`);
  hearts.querySelectorAll('.fg-heart').forEach((heart, heartIndex) => {
    heart.classList.toggle('is-lost', heartIndex >= state.lives);
  });
  hearts.classList.remove('is-hit');
  void hearts.offsetWidth;
  hearts.classList.add('is-hit');

  // Każde stracone życie to kolejne uszkodzenie zamku.
  const damage = state.game.lives - state.lives;
  [1, 2, 3].forEach((level) => state.castle.classList.toggle(`dmg-${level}`, damage >= level));
  state.castle.classList.remove('is-hit');
  void state.castle.offsetWidth;
  state.castle.classList.add('is-hit');
  if (state.lives > 0) return;

  // Po zdobyciu celu utrata żyć po prostu kończy grę z nagrodą.
  if (state.goalReached) {
    finishTypingGame();
    return;
  }

  const { topic, index, game, score } = state;
  showTypingOverlay({
    icon: '🏚️',
    title: 'Zamek zburzony!',
    text: `Wynik: ${score} z ${game.goal} pkt. Spróbuj jeszcze raz — tym razem go obronisz!`,
    link: { label: 'Wróć do ścieżki', href: `#/sciezka/${topic.slug}` },
    primary: { label: 'Zacznij od nowa', action: () => startTypingGame(topic, index, game, state.difficulty) }
  });
}

function showTypingOverlay({ icon, title, text, secondary, primary, link }) {
  const state = typingGame;
  state.paused = true;
  const overlay = state.body.querySelector('.fg-overlay');
  const card = overlay.querySelector('.fg-overlay-card');
  card.innerHTML = `
    <div class="summary-icon" aria-hidden="true">${icon}</div>
    <h2></h2>
    <p></p>
    <div class="summary-actions"></div>
  `;
  card.querySelector('h2').textContent = title;
  card.querySelector('p').textContent = text;
  const actions = card.querySelector('.summary-actions');

  if (link) {
    const anchor = document.createElement('a');
    anchor.className = 'secondary-button quiz-retry';
    anchor.href = link.href;
    anchor.textContent = link.label;
    actions.append(anchor);
  }
  [secondary, primary].forEach((config, buttonIndex) => {
    if (!config) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = buttonIndex ? 'primary-button quiz-finish' : 'secondary-button quiz-retry';
    button.textContent = config.label;
    button.addEventListener('click', config.action);
    actions.append(button);
  });

  overlay.hidden = false;
  actions.lastElementChild.focus();
}

function hideTypingOverlay() {
  typingGame.body.querySelector('.fg-overlay').hidden = true;
  document.activeElement?.blur();
  typingGame.lastTime = performance.now();
  typingGame.paused = false;
}

function showTypingBanner(text) {
  const banner = typingGame.body.querySelector('.fg-banner');
  banner.textContent = text;
  banner.hidden = false;
  clearTimeout(typingGame.bannerTimer);
  typingGame.bannerTimer = setTimeout(() => { banner.hidden = true; }, 2600);
}

function showTypingMessage(text, tone) {
  const message = typingGame.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(typingGame.messageTimer);
  typingGame.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, 1500);
}

function finishTypingGame() {
  const { topic, index, game, difficulty, score, words, kills, keys, mistakes } = typingGame;
  stopTypingGame();

  const earned = Math.max(0, difficulty.reward - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, difficulty.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  const accuracy = keys ? Math.round(((keys - mistakes) / keys) * 100) : 100;
  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, zamek obroniony!';
  app.querySelector('#quiz-hint').textContent = `Poziom: ${difficulty.label}. Wpisane słowa: ${words}, pokonane potwory: ${kills}, celność pisania: ${accuracy}%.`;

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏰</div>
    <div class="summary-stats">
      <div><strong>${score}</strong><span>wynik w grze</span></div>
      <div><strong>${kills}</strong><span>pokonanych potworów</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Zagraj ponownie</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => startTypingGame(topic, index, game, difficulty));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Ile sekund działa zebrane wzmocnienie — na łatwym poziomie dłużej.
function typingPowerDuration() {
  return typingGame.game.powerDuration * typingGame.difficulty.powerDuration;
}

// Pole rażenia Pioruna i Wybuchu — na łatwym poziomie większe.
function typingLineWidth() {
  return typingGame.game.lineWidth * typingGame.difficulty.powerArea;
}

function typingRadius() {
  return typingGame.game.radius * typingGame.difficulty.powerArea;
}
