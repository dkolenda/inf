// Gra „Baloniki”: baloniki lecą od dołu do góry, gracz klika je myszą, zanim uciekną.
// Ćwiczy szybkość i precyzję. Baloniki z czasem przyspieszają, a od progu bombsAt pojawiają się bomby.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…)
// oraz z burstFileGameConfetti z file-game.js.
let balloonGame = null;

function renderBalloonGame(topic, index, game) {
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    `Klikaj myszą baloniki, zanim uciekną do góry. Zdobądź ${game.goal} pkt — baloniki będą lecieć coraz szybciej! ` +
    `Masz ${game.lives} życia: tracisz je za każdy balonik, który ucieknie. ` +
    `Od ${game.bombsAt} pkt pojawią się bomby — nie klikaj ich!`;
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro';
  body.innerHTML = `
    <div class="bg-legend">
      ${game.balloons.map((kind) => `
        <span class="bg-legend-item">
          <span class="bg-balloon bg-${kind.id}" aria-hidden="true"></span>
          <span><b>${kind.points} pkt</b>${kind.label}</span>
        </span>`).join('')}
      <span class="bg-legend-item is-bomb">
        <span class="bg-bomb" aria-hidden="true">💣</span>
        <span><b>−1 życie</b>nie klikaj!</span>
      </span>
    </div>
    <button class="primary-button fg-start" type="button">Start <span aria-hidden="true">▶</span></button>
  `;
  body.querySelector('.fg-start').addEventListener('click', () => startBalloonGame(topic, index, game));
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startBalloonGame(topic, index, game) {
  stopBalloonGame();
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent = 'Klikaj baloniki myszą. Omijaj bomby!';
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg bg';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-lives" aria-label="Życia: ${game.lives}">${'<span class="fg-heart" aria-hidden="true">♥</span>'.repeat(game.lives)}</span>
      <span class="fg-score">Wynik: <b>0</b> / ${game.goal}</span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end" type="button" hidden>Zakończ grę</button>
    </div>
    <p class="fg-banner" role="status" hidden>Uwaga! Teraz pojawią się bomby — nie klikaj ich!</p>
    <div class="bg-sky"></div>
    <div class="fg-overlay" hidden><div class="fg-overlay-card"></div></div>
  `;

  balloonGame = {
    topic,
    index,
    game,
    body,
    sky: body.querySelector('.bg-sky'),
    items: [],
    score: 0,
    lives: game.lives,
    popped: 0,
    escaped: 0,
    bombsHit: 0,
    elapsed: 0,
    nextSpawn: 0,
    paused: false,
    goalReached: false,
    lastTime: performance.now(),
    frameId: 0,
    messageTimer: 0,
    bannerTimer: 0
  };

  body.querySelector('.fg-end').addEventListener('click', finishBalloonGame);
  balloonGame.frameId = requestAnimationFrame(balloonGameTick);
}

function stopBalloonGame() {
  if (!balloonGame) return;
  cancelAnimationFrame(balloonGame.frameId);
  clearTimeout(balloonGame.messageTimer);
  clearTimeout(balloonGame.bannerTimer);
  balloonGame = null;
}

// Tempo rośnie razem z wynikiem: baloniki lecą szybciej i pojawiają się częściej.
function balloonGameSpeedFactor() {
  const { speedUp } = balloonGame.game;
  return Math.min(speedUp.max, 1 + balloonGame.score * speedUp.perPoint);
}

// Niektóre kolory (ramp) dodatkowo przyspieszają z każdą sekundą gry, do maxSpeed.
function balloonBaseSpeed(kind) {
  if (!kind) return balloonGame.game.bombSpeed;
  if (!kind.ramp) return kind.speed;
  return Math.min(kind.maxSpeed, kind.speed + kind.ramp * balloonGame.elapsed);
}

function drawBalloonKind() {
  const { game, score } = balloonGame;
  if (score >= game.bombsAt && Math.random() < game.bombChance) return null;
  let roll = Math.random() * game.balloons.reduce((sum, kind) => sum + kind.weight, 0);
  return game.balloons.find((kind) => (roll -= kind.weight) < 0) || game.balloons[0];
}

function spawnBalloon() {
  const state = balloonGame;
  const kind = drawBalloonKind();
  const element = document.createElement('button');
  element.type = 'button';
  if (kind) {
    element.className = `bg-balloon bg-${kind.id}`;
    element.setAttribute('aria-label', `Balonik za ${kind.points} pkt`);
  } else {
    element.className = 'bg-bomb';
    element.textContent = '💣';
    element.setAttribute('aria-label', 'Bomba — nie klikaj');
  }
  state.sky.append(element);

  const width = element.offsetWidth;
  const skyWidth = state.sky.clientWidth;
  const zigzag = kind?.zigzag || 0;
  const margin = Math.min(zigzag, Math.max(0, (skyWidth - width) / 2 - 10));
  const item = {
    element,
    kind,
    width,
    baseX: margin + Math.random() * Math.max(0, skyWidth - width - margin * 2),
    x: 0,
    y: state.sky.clientHeight,
    height: element.offsetHeight,
    speed: balloonBaseSpeed(kind) * (0.9 + Math.random() * 0.2),
    zigzag: margin,
    phase: Math.random() * Math.PI * 2,
    age: 0,
    done: false
  };
  item.x = item.baseX;
  placeBalloon(item);
  element.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    hitBalloon(item);
  });
  state.items.push(item);
}

function placeBalloon(item) {
  item.element.style.transform = `translate(${item.x}px, ${item.y}px)`;
}

function balloonGameTick(now) {
  const state = balloonGame;
  if (!state) return;
  const dt = Math.max(0, Math.min(0.05, (now - state.lastTime) / 1000));
  state.lastTime = now;

  if (!state.paused) {
    const factor = balloonGameSpeedFactor();
    state.elapsed += dt;
    state.nextSpawn -= dt;
    if (state.nextSpawn <= 0) {
      spawnBalloon();
      state.nextSpawn = state.game.spawnEvery / factor * (0.75 + Math.random() * 0.5);
    }

    state.items.forEach((item) => {
      if (item.done || balloonGame !== state) return;
      item.age += dt;
      item.y -= item.speed * factor * dt;
      if (item.zigzag) item.x = item.baseX + Math.sin(item.age * 4 + item.phase) * item.zigzag;
      placeBalloon(item);

      // Balonik (nie bomba) wyleciał za górną krawędź — ucieka i zabiera życie.
      if (item.y < -item.height) {
        item.done = true;
        item.element.remove();
        if (item.kind) {
          state.escaped += 1;
          showBalloonGameMessage('Balonik uciekł!', 'bad');
          loseBalloonGameLife();
        }
      }
    });
    if (balloonGame === state) state.items = state.items.filter((item) => !item.done);
  }

  // Po końcu gry (albo starcie od nowa) stara pętla się zatrzymuje.
  if (balloonGame === state) state.frameId = requestAnimationFrame(balloonGameTick);
}

function hitBalloon(item) {
  const state = balloonGame;
  if (!state || state.paused || item.done) return;
  item.done = true;
  const rect = item.element.getBoundingClientRect();
  item.element.classList.add('is-popped');
  item.element.disabled = true;
  item.element.addEventListener('animationend', () => item.element.remove(), { once: true });

  if (!item.kind) {
    state.bombsHit += 1;
    showBalloonGameMessage('Bum! To była bomba!', 'bad');
    loseBalloonGameLife();
    return;
  }

  state.popped += 1;
  showBalloonFloat(rect, `+${item.kind.points}`);
  burstFileGameConfetti(rect, item.kind.color);
  addBalloonGameScore(item.kind.points);
}

function showBalloonFloat(rect, text) {
  const skyRect = balloonGame.sky.getBoundingClientRect();
  const label = document.createElement('span');
  label.className = 'bg-float';
  label.textContent = text;
  label.style.left = `${rect.left - skyRect.left + rect.width / 2}px`;
  label.style.top = `${rect.top - skyRect.top + rect.height / 3}px`;
  balloonGame.sky.append(label);
  label.addEventListener('animationend', () => label.remove(), { once: true });
}

function addBalloonGameScore(points) {
  const state = balloonGame;
  const { game } = state;
  const before = state.score;
  state.score += points;
  state.body.querySelector('.fg-score b').textContent = state.score;
  setQuizProgress(Math.min(1, state.score / game.goal));

  if (before < game.bombsAt && state.score >= game.bombsAt) {
    const banner = state.body.querySelector('.fg-banner');
    banner.hidden = false;
    clearTimeout(state.bannerTimer);
    state.bannerTimer = setTimeout(() => { banner.hidden = true; }, 3000);
  }

  if (!state.goalReached && state.score >= game.goal) {
    state.goalReached = true;
    showBalloonGameOverlay({
      icon: '🏆',
      title: `Masz ${game.goal} punktów!`,
      text: `Możesz grać dalej i bić rekord albo zakończyć grę i odebrać ${game.reward} punktów.`,
      secondary: {
        label: 'Graj dalej',
        action: () => {
          hideBalloonGameOverlay();
          state.body.querySelector('.fg-end').hidden = false;
        }
      },
      primary: { label: `Zakończ i odbierz ${game.reward} pkt`, action: finishBalloonGame }
    });
  }
}

function loseBalloonGameLife() {
  const state = balloonGame;
  state.lives -= 1;
  const hearts = state.body.querySelector('.fg-lives');
  hearts.setAttribute('aria-label', `Życia: ${state.lives}`);
  hearts.querySelectorAll('.fg-heart').forEach((heart, heartIndex) => {
    heart.classList.toggle('is-lost', heartIndex >= state.lives);
  });
  hearts.classList.remove('is-hit');
  void hearts.offsetWidth;
  hearts.classList.add('is-hit');
  if (state.lives > 0) return;

  // Po zdobyciu celu utrata żyć po prostu kończy grę z nagrodą.
  if (state.goalReached) {
    finishBalloonGame();
    return;
  }

  const { topic, index, game, score } = state;
  showBalloonGameOverlay({
    icon: '💔',
    title: 'Koniec żyć!',
    text: `Wynik: ${score} z ${game.goal} pkt. Zacznij od nowa — tym razem się uda!`,
    link: { label: 'Wróć do ścieżki', href: `#/sciezka/${topic.slug}` },
    primary: { label: 'Zacznij od nowa', action: () => startBalloonGame(topic, index, game) }
  });
}

function showBalloonGameOverlay({ icon, title, text, secondary, primary, link }) {
  const state = balloonGame;
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

function hideBalloonGameOverlay() {
  balloonGame.body.querySelector('.fg-overlay').hidden = true;
  balloonGame.lastTime = performance.now();
  balloonGame.paused = false;
}

function showBalloonGameMessage(text, tone) {
  const message = balloonGame.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(balloonGame.messageTimer);
  balloonGame.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, 1500);
}

function finishBalloonGame() {
  const { topic, index, game, score, popped, escaped, bombsHit } = balloonGame;
  stopBalloonGame();

  const earned = Math.max(0, game.reward - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, game.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, gra ukończona!';
  app.querySelector('#quiz-hint').textContent = `Przebite baloniki: ${popped}, uciekło: ${escaped}, kliknięte bomby: ${bombsHit}.`;

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      <div><strong>${score}</strong><span>wynik w grze</span></div>
      <div><strong>${popped}</strong><span>przebitych baloników</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Zagraj ponownie</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => startBalloonGame(topic, index, game));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
