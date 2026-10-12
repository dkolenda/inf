// Gra „Format pliku”: pliki jadą po taśmie z lewej na prawą. Gdy plik jest w ramce,
// gracz wciska W/A/S/D (albo strzałkę lub klika strefę), aby wysłać go do właściwego typu.
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…), wywoływanych dopiero w trakcie gry.
const fileGameKeys = {
  KeyW: 'W', KeyA: 'A', KeyS: 'S', KeyD: 'D',
  ArrowUp: 'W', ArrowLeft: 'A', ArrowDown: 'S', ArrowRight: 'D'
};
const fileGameSpeed = { start: 100, step: 12, max: 480 };
const fileGamePileSize = 5;
let fileGame = null;

function fileGameZoneStyle(zone) {
  return `--zone: ${zone.color}; --zone-soft: ${zone.soft};`;
}

function renderFileGame(topic, index, game) {
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    `Pliki jadą po taśmie. Gdy plik znajdzie się w ramce, wciśnij literę strefy, do której pasuje. ` +
    `Każde trafienie to ${game.pointsPerFile} pkt. Zdobądź ${game.goal} pkt — taśma będzie przyspieszać, a od ${game.hideIconsAt} pkt pliki stracą ikony! ` +
    `Masz ${game.lives} życia: tracisz je za złą strefę i za plik, który przejedzie przez ramkę. ` +
    `Od ${game.distractorsAt} pkt pojawią się pliki, które nie pasują nigdzie — przepuść je, a dostaniesz punkty.`;
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro';
  body.innerHTML = `
    <div class="fg-intro-keys" aria-hidden="true">
      ${game.zones.map((zone) => `<span class="fg-intro-key" style="${fileGameZoneStyle(zone)}"><kbd>${zone.key}</kbd><span class="fg-zone-icon">${zone.icon}</span>${zone.label}</span>`).join('')}
    </div>
    <button class="primary-button fg-start" type="button">Start <span aria-hidden="true">▶</span></button>
  `;
  body.querySelector('.fg-start').addEventListener('click', () => startFileGame(topic, index, game));
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startFileGame(topic, index, game) {
  stopFileGame();
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  setQuizProgress(0);
  app.querySelector('#quiz-hint').textContent = 'Klawisze W, A, S, D (albo strzałki). Możesz też kliknąć strefę.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-lives" aria-label="Życia: ${game.lives}">${'<span class="fg-heart" aria-hidden="true">♥</span>'.repeat(game.lives)}</span>
      <span class="fg-score">Wynik: <b>0</b> / ${game.goal}</span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end" type="button" hidden>Zakończ grę</button>
    </div>
    <p class="fg-banner" role="status" hidden>Uwaga! Teraz pojawią się pliki, które nie pasują nigdzie — przepuść je, a dostaniesz punkty.</p>
    <div class="fg-belt">
      <div class="fg-frame" aria-hidden="true"></div>
    </div>
    <div class="fg-zones">
      ${game.zones.map((zone) => `
        <button class="fg-zone fg-zone-${zone.key.toLowerCase()}" type="button" data-zone="${zone.id}" style="${fileGameZoneStyle(zone)}">
          <span class="fg-zone-head"><kbd>${zone.key}</kbd><span class="fg-zone-icon" aria-hidden="true">${zone.icon}</span><span class="fg-zone-label">${zone.label}</span></span>
          <span class="fg-pile" aria-hidden="true"></span>
        </button>`).join('')}
    </div>
    <div class="fg-overlay" hidden><div class="fg-overlay-card"></div></div>
  `;

  fileGame = {
    topic,
    index,
    game,
    body,
    belt: body.querySelector('.fg-belt'),
    frame: body.querySelector('.fg-frame'),
    cards: [],
    bags: { types: [] },
    score: 0,
    lives: game.lives,
    correct: 0,
    wrong: 0,
    missed: 0,
    spawned: 0,
    nextGap: 0,
    paused: false,
    goalReached: false,
    lastTime: performance.now(),
    frameId: 0,
    messageTimer: 0
  };

  body.querySelectorAll('.fg-zone').forEach((zone) => {
    zone.addEventListener('click', () => sortFileGameCard(zone.dataset.zone));
  });
  body.querySelector('.fg-end').addEventListener('click', finishFileGame);
  document.addEventListener('keydown', handleFileGameKey);

  spawnFileGameCard();
  fileGame.frameId = requestAnimationFrame(fileGameTick);
}

function stopFileGame() {
  if (!fileGame) return;
  cancelAnimationFrame(fileGame.frameId);
  clearTimeout(fileGame.messageTimer);
  clearTimeout(fileGame.bannerTimer);
  document.removeEventListener('keydown', handleFileGameKey);
  fileGame = null;
}

function fileGameSpeedNow() {
  return Math.min(fileGameSpeed.max, fileGameSpeed.start + fileGame.spawned * fileGameSpeed.step);
}

// Losowanie „z worka”: każdy typ wypada tak samo często (worek ma każdy typ dwa razy),
// a w obrębie typu każdy format pojawi się, zanim któryś się powtórzy.
// Od progu distractorsAt w worku są też pliki 'none', które trzeba przepuścić.
function drawFileGameFile() {
  const { game, bags } = fileGame;
  if (!bags.types.length) {
    const types = game.zones.map((zone) => zone.id);
    if (fileGame.score >= game.distractorsAt) types.push('none');
    bags.types = shuffle(types.flatMap((type) => [type, type]));
  }
  const type = bags.types.pop();
  if (!bags[type]?.length) bags[type] = shuffle(game.files.filter((file) => file.type === type));
  return bags[type].pop();
}

function spawnFileGameCard() {
  const { belt } = fileGame;
  const file = drawFileGameFile();
  const name = file.names[Math.floor(Math.random() * file.names.length)];

  const element = document.createElement('div');
  element.className = 'fg-file';
  element.innerHTML = `<span class="fg-file-icon" aria-hidden="true">${file.icon}</span><span class="fg-file-name">${name}.<b>${file.ext}</b></span>`;
  belt.append(element);

  const card = { element, type: file.type, ext: file.ext, label: `${name}.${file.ext}`, x: -element.offsetWidth, width: element.offsetWidth, done: false };
  element.style.transform = `translateX(${card.x}px)`;
  fileGame.cards.push(card);
  fileGame.spawned += 1;
  // Odstęp liczony w pikselach, więc w ramce jest zawsze najwyżej jeden plik — niezależnie od prędkości.
  fileGame.nextGap = fileGame.frame.offsetWidth + 20 + Math.random() * 120;
}

function fileGameTick(now) {
  const state = fileGame;
  if (!state) return;
  const dt = Math.max(0, Math.min(0.05, (now - state.lastTime) / 1000));
  state.lastTime = now;

  if (!state.paused) {
    const distance = fileGameSpeedNow() * dt;
    const beltWidth = state.belt.clientWidth;
    const frameLeft = state.frame.offsetLeft;
    const frameRight = frameLeft + state.frame.offsetWidth;

    state.cards.forEach((card) => {
      if (card.done || fileGame !== state) return;
      card.x += distance;
      card.element.style.transform = `translateX(${card.x}px)`;
      const center = card.x + card.width / 2;
      card.element.classList.toggle('is-in-frame', !card.missed && center >= frameLeft && center <= frameRight);

      // Plik przejechał przez ramkę bez decyzji: obcy format to punkty, pozostałe — utrata życia.
      if (!card.missed && center > frameRight) {
        card.missed = true;
        if (card.type === 'none') {
          card.element.classList.add('is-skipped');
          burstFileGameConfetti(card.element.getBoundingClientRect());
          state.correct += 1;
          showFileGameMessage(`+${state.game.pointsPerFile} — .${card.ext} nie pasuje nigdzie`, 'good');
          addFileGameScore();
        } else {
          card.element.classList.add('is-missed');
          state.missed += 1;
          showFileGameMessage(`Uciekł plik ${card.label} — to ${fileGameAnswer(card)}`, 'bad');
          loseFileGameLife();
        }
      }

      if (card.x > beltWidth) {
        card.done = true;
        card.element.remove();
      }
    });
    state.cards = state.cards.filter((card) => !card.done || card.flying);

    const last = state.cards.filter((card) => !card.done).at(-1);
    if (fileGame === state && !state.paused && (!last || last.x >= state.nextGap)) spawnFileGameCard();
  }

  // Po końcu gry (albo starcie od nowa) stara pętla się zatrzymuje.
  if (fileGame === state) state.frameId = requestAnimationFrame(fileGameTick);
}

function handleFileGameKey(event) {
  if (!fileGame || event.ctrlKey || event.metaKey || event.altKey) return;
  const key = fileGameKeys[event.code];
  if (!key) return;
  event.preventDefault();
  if (event.repeat) return;
  const zone = fileGame.game.zones.find((item) => item.key === key);
  sortFileGameCard(zone.id);
}

function sortFileGameCard(zoneId) {
  const state = fileGame;
  if (!state || state.paused) return;

  const card = state.cards.find((item) => !item.done && item.element.classList.contains('is-in-frame'));
  const zoneElement = state.body.querySelector(`[data-zone="${zoneId}"]`);

  if (!card) {
    state.frame.classList.remove('is-empty');
    void state.frame.offsetWidth;
    state.frame.classList.add('is-empty');
    return;
  }

  const { game } = state;
  const isCorrect = card.type === zoneId;
  card.done = true;
  card.flying = true;

  if (isCorrect) {
    state.correct += 1;
    showFileGameMessage(`+${game.pointsPerFile}`, 'good');
  } else {
    state.wrong += 1;
    showFileGameMessage(`${card.label} to: ${fileGameAnswer(card)}`, 'bad');
  }

  zoneElement.classList.remove('is-correct', 'is-wrong');
  void zoneElement.offsetWidth;
  zoneElement.classList.add(isCorrect ? 'is-correct' : 'is-wrong');
  zoneElement.addEventListener('animationend', () => zoneElement.classList.remove('is-correct', 'is-wrong'), { once: true });

  // Plik „wpada” na stos pod wybraną strefą.
  const pile = zoneElement.querySelector('.fg-pile');
  const from = card.element.getBoundingClientRect();
  const to = pile.getBoundingClientRect();
  const dx = to.left + to.width / 2 - (from.left + from.width / 2);
  const dy = to.top + 12 - (from.top + from.height / 2);
  const flight = card.element.animate([
    { transform: `translateX(${card.x}px)`, opacity: 1 },
    { transform: `translate(${card.x + dx}px, ${dy}px) scale(0.45)`, opacity: 0.2 }
  ], { duration: 380, easing: 'cubic-bezier(.5,0,.75,0)', fill: 'forwards' });
  flight.onfinish = () => {
    card.element.remove();
    card.flying = false;
    addToFileGamePile(pile, card, isCorrect);
    if (isCorrect) burstFileGameConfetti(pile.getBoundingClientRect(), zoneElement.style.getPropertyValue('--zone'));
  };

  if (isCorrect) addFileGameScore();
  else loseFileGameLife();
}

function fileGameAnswer(card) {
  if (card.type === 'none') return 'żaden z typów — trzeba go przepuścić';
  const answer = fileGame.game.zones.find((zone) => zone.id === card.type);
  return `${answer.label} (${answer.key})`;
}

function addFileGameScore() {
  const state = fileGame;
  const { game } = state;
  const before = state.score;
  state.score += game.pointsPerFile;
  state.body.querySelector('.fg-score b').textContent = state.score;
  state.body.classList.toggle('no-icons', state.score >= game.hideIconsAt);
  setQuizProgress(Math.min(1, state.score / game.goal));

  if (before < game.distractorsAt && state.score >= game.distractorsAt) {
    state.bags.types = [];
    const banner = state.body.querySelector('.fg-banner');
    banner.hidden = false;
    clearTimeout(state.bannerTimer);
    state.bannerTimer = setTimeout(() => { banner.hidden = true; }, 4000);
  }

  if (!state.goalReached && state.score >= game.goal) {
    state.goalReached = true;
    showFileGameOverlay({
      icon: '🏆',
      title: `Masz ${game.goal} punktów!`,
      text: `Możesz grać dalej i bić rekord albo zakończyć grę i odebrać ${game.reward} punktów.`,
      secondary: {
        label: 'Graj dalej',
        action: () => {
          hideFileGameOverlay();
          state.body.querySelector('.fg-end').hidden = false;
        }
      },
      primary: { label: `Zakończ i odbierz ${game.reward} pkt`, action: finishFileGame }
    });
  }
}

// Mały wybuch konfetti przy każdym trafieniu — kilkanaście kawałków, żeby nie spowalniać gry.
function burstFileGameConfetti(rect, color) {
  if (reduceMotion.matches) return;
  const colors = [color || '#58cc02', '#ffc800', '#1cb0f6', '#ff4b4b', '#9069cd'];
  const x = rect.left + rect.width / 2;
  const y = rect.top + Math.min(rect.height / 2, 24);

  for (let i = 0; i < 18; i += 1) {
    const piece = document.createElement('span');
    piece.className = 'fg-confetti';
    piece.style.left = `${x}px`;
    piece.style.top = `${y}px`;
    piece.style.background = colors[i % colors.length];
    if (i % 3 === 0) piece.style.borderRadius = '50%';
    document.body.append(piece);

    const angle = (Math.PI * 2 * i) / 18 + Math.random() * 0.4;
    const distance = 40 + Math.random() * 50;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance - 30;
    piece.animate([
      { transform: 'translate(-50%, -50%) rotate(0deg)', opacity: 1 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) rotate(${Math.random() * 360}deg)`, opacity: 1, offset: 0.6 },
      { transform: `translate(calc(-50% + ${dx * 1.15}px), calc(-50% + ${dy + 40}px)) rotate(${Math.random() * 540}deg)`, opacity: 0 }
    ], { duration: 650 + Math.random() * 250, easing: 'cubic-bezier(.2,.7,.4,1)' }).onfinish = () => piece.remove();
  }
}

// Najnowszy plik ląduje na górze stosu; widać najwyżej 5 ostatnich (albo mniej, jeśli się nie mieszczą).
function addToFileGamePile(pile, card, isCorrect) {
  const item = document.createElement('span');
  item.className = `fg-pile-item ${isCorrect ? 'is-good' : 'is-bad'}`;
  item.textContent = `${isCorrect ? '✓' : '✗'} ${card.label}`;
  pile.prepend(item);
  [...pile.children].slice(fileGamePileSize).forEach((old) => old.remove());
}

function loseFileGameLife() {
  const state = fileGame;
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
    finishFileGame();
    return;
  }

  const { topic, index, game, score } = state;
  showFileGameOverlay({
    icon: '💔',
    title: 'Koniec żyć!',
    text: `Wynik: ${score} z ${game.goal} pkt. Zacznij od nowa — tym razem się uda!`,
    link: { label: 'Wróć do ścieżki', href: `#/sciezka/${topic.slug}` },
    primary: { label: 'Zacznij od nowa', action: () => startFileGame(topic, index, game) }
  });
}

function showFileGameOverlay({ icon, title, text, secondary, primary, link }) {
  const state = fileGame;
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

function hideFileGameOverlay() {
  fileGame.body.querySelector('.fg-overlay').hidden = true;
  fileGame.paused = false;
}

function showFileGameMessage(text, tone) {
  const message = fileGame.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(fileGame.messageTimer);
  fileGame.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, tone === 'bad' ? 2200 : 900);
}

function finishFileGame() {
  const { topic, index, game, score, correct, wrong, missed } = fileGame;
  stopFileGame();

  const quizId = game.id;
  const earned = Math.max(0, game.reward - readQuizBest(quizId));
  if (earned) {
    saveQuizBest(quizId, game.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, gra ukończona!';
  app.querySelector('#quiz-hint').textContent = `Trafione pliki: ${correct}, pomyłki: ${wrong}, pominięte: ${missed}.`;

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      <div><strong>${score}</strong><span>wynik w grze</span></div>
      <div><strong>${correct}</strong><span>trafionych plików</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Zagraj ponownie</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => startFileGame(topic, index, game));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
