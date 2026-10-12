// Gra „Detektyw Fejków”: gracz czyta nagłówek i decyduje — PRAWDA czy FAŁSZ.
// Za dobrą odpowiedź dostaje punkty, za złą traci życie. Po każdej odpowiedzi widzi wyjaśnienie,
// a przy fejkach — sygnały ostrzegawcze znalezione w tytule (wykrzykniki, wielkie litery, emocje…).
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…).
let fakeNewsState = null;

// Sygnały fejka szukane w nagłówku; pokazujemy je po odpowiedzi, żeby uczeń nauczył się je zauważać.
const fakeNewsSignals = [
  { label: 'Dużo wykrzykników!!!', test: (text) => /!{2,}/.test(text) },
  { label: 'KRZYCZĄCE wielkie litery', test: (text) => text.split(/\s+/).some((word) => {
    const letters = word.replace(/[^\p{L}]/gu, '');
    return letters.length >= 3 && letters === letters.toUpperCase();
  }) },
  { label: 'Słowa, które budzą emocje', test: (text) => /szok|niesamowit|pilne|panicznie|biedne|uważaj/i.test(text) },
  { label: 'Każe kliknąć albo udostępnić', test: (text) => /udostępnij|kliknij|wyślij|obejrzyj|sprawdź|zobacz|odblokuj/i.test(text) },
  { label: 'Straszy albo obiecuje sekret', test: (text) => /ostrzegają|ukrywali|dowód|zanim|zniknie|nigdy|w szoku/i.test(text) }
];

function renderFakeNewsGame(topic, index, game) {
  document.title = `${game.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = game.title;
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent =
    `Przeczytaj nagłówek i zdecyduj: to PRAWDA czy FAŁSZ? Za dobrą odpowiedź dostajesz ${game.points} pkt. ` +
    `Masz ${game.lives} życia. Zdobądź ${game.goal} pkt, aby przejść dalej!`;
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg-intro';
  body.innerHTML = `
    <div class="fn-clues">
      <p class="fn-clues-title">🔎 Fejki często mają:</p>
      <ul>
        <li><b>!!!</b> dużo wykrzykników</li>
        <li><b>ABC</b> KRZYCZĄCE wielkie litery</li>
        <li><b>😱</b> słowa jak „SZOK”, „PILNE”, „Niesamowite”</li>
        <li><b>👆</b> „Kliknij”, „Udostępnij, zanim usuną”</li>
      </ul>
    </div>
    <div class="fg-intro-keys">
      <span class="fg-intro-key fn-key-true"><kbd>P</kbd> 🟩 PRAWDA</span>
      <span class="fg-intro-key fn-key-fake"><kbd>F</kbd> 🟥 FAŁSZ</span>
    </div>
    <button class="primary-button fg-start" type="button">Start <span aria-hidden="true">▶</span></button>
  `;
  body.querySelector('.fg-start').addEventListener('click', () => startFakeNewsGame(topic, index, game));
  body.querySelector('.fg-start').focus();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function startFakeNewsGame(topic, index, game) {
  stopFakeNewsGame();
  app.querySelector('#quiz-prompt').textContent = game.prompt;
  app.querySelector('#quiz-hint').textContent = 'Klawisz P — prawda, F — fałsz, Enter — następny nagłówek.';
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body fg fn';
  body.innerHTML = `
    <div class="fg-hud">
      <span class="fg-lives" aria-label="Życia: ${game.lives}">${'<span class="fg-heart" aria-hidden="true">♥</span>'.repeat(game.lives)}</span>
      <span class="fg-score">Wynik: <b>0</b> / ${game.goal}</span>
      <span class="fg-message" aria-live="polite"></span>
      <button class="secondary-button fg-end" type="button" hidden>Zakończ grę</button>
    </div>
    <article class="fn-card">
      <p class="fn-card-kicker"><span aria-hidden="true">📰</span> Nagłówek nr <b class="fn-number">1</b></p>
      <h2 class="fn-headline"></h2>
      <div class="fn-stamp" aria-hidden="true"></div>
    </article>
    <div class="fn-answers">
      <button class="fn-answer fn-answer-true" type="button" data-fake="false"><span aria-hidden="true">🟩</span> PRAWDA <kbd>P</kbd></button>
      <button class="fn-answer fn-answer-fake" type="button" data-fake="true"><span aria-hidden="true">🟥</span> FAŁSZ <kbd>F</kbd></button>
    </div>
    <div class="fn-explain" aria-live="polite" hidden>
      <p class="fn-verdict"></p>
      <p class="fn-why"></p>
      <ul class="fn-signals"></ul>
      <button class="primary-button fn-next" type="button">Dalej <span aria-hidden="true">→</span></button>
    </div>
    <div class="fg-overlay" hidden><div class="fg-overlay-card"></div></div>
  `;

  fakeNewsState = {
    topic,
    index,
    game,
    body,
    queue: shuffle(game.headlines),
    current: null,
    count: 0,
    score: 0,
    lives: game.lives,
    correct: 0,
    wrong: 0,
    answered: false,
    over: false,
    paused: false,
    goalReached: false,
    messageTimer: 0,
    onKey: handleFakeNewsKey
  };

  body.querySelectorAll('.fn-answer').forEach((button) => {
    button.addEventListener('click', () => answerFakeNews(button.dataset.fake === 'true'));
  });
  body.querySelector('.fn-next').addEventListener('click', nextFakeNewsHeadline);
  body.querySelector('.fg-end').addEventListener('click', finishFakeNewsGame);
  document.addEventListener('keydown', fakeNewsState.onKey);
  nextFakeNewsHeadline();
}

function stopFakeNewsGame() {
  if (!fakeNewsState) return;
  document.removeEventListener('keydown', fakeNewsState.onKey);
  clearTimeout(fakeNewsState.messageTimer);
  fakeNewsState = null;
}

function handleFakeNewsKey(event) {
  const state = fakeNewsState;
  if (!state || state.paused || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  if (!state.answered && (key === 'p' || key === 'f')) {
    event.preventDefault();
    answerFakeNews(key === 'f');
  } else if (state.answered && (key === 'enter' || key === ' ') && event.target.tagName !== 'BUTTON') {
    event.preventDefault();
    nextFakeNewsHeadline();
  }
}

function nextFakeNewsHeadline() {
  const state = fakeNewsState;
  if (!state || state.paused) return;
  if (state.over) {
    endFakeNewsLives();
    return;
  }
  if (!state.queue.length) state.queue = shuffle(state.game.headlines);
  state.current = state.queue.pop();
  state.count += 1;
  state.answered = false;

  const { body } = state;
  const card = body.querySelector('.fn-card');
  card.className = 'fn-card';
  void card.offsetWidth;
  card.classList.add('is-new');
  body.querySelector('.fn-number').textContent = state.count;
  body.querySelector('.fn-headline').textContent = state.current.text;
  body.querySelector('.fn-stamp').textContent = '';
  body.querySelectorAll('.fn-answer').forEach((button) => {
    button.disabled = false;
    button.classList.remove('is-picked');
  });
  body.querySelector('.fn-explain').hidden = true;
  body.querySelector('.fn-answer-true').focus();
}

function answerFakeNews(saysFake) {
  const state = fakeNewsState;
  if (!state || state.paused || state.answered) return;
  state.answered = true;
  const { body, current, game } = state;
  const isRight = saysFake === current.fake;

  body.querySelectorAll('.fn-answer').forEach((button) => {
    button.disabled = true;
    button.classList.toggle('is-picked', (button.dataset.fake === 'true') === saysFake);
  });
  const card = body.querySelector('.fn-card');
  card.classList.remove('is-new');
  card.classList.add(current.fake ? 'is-fake' : 'is-true', isRight ? 'is-right' : 'is-wrong');
  body.querySelector('.fn-stamp').textContent = current.fake ? 'FEJK' : 'PRAWDA';

  const explain = body.querySelector('.fn-explain');
  explain.className = `fn-explain ${isRight ? 'is-right' : 'is-wrong'}`;
  explain.querySelector('.fn-verdict').textContent = isRight
    ? `✓ Dobrze! To ${current.fake ? 'fejk' : 'prawda'}. +${game.points} pkt`
    : `✗ Niestety! To ${current.fake ? 'fejk' : 'prawda'}.`;
  explain.querySelector('.fn-why').textContent = current.why;
  const signals = current.fake ? fakeNewsSignals.filter((signal) => signal.test(current.text)) : [];
  const list = explain.querySelector('.fn-signals');
  list.innerHTML = '';
  signals.forEach((signal) => {
    const item = document.createElement('li');
    item.textContent = `🚩 ${signal.label}`;
    list.append(item);
  });
  list.hidden = !signals.length;
  explain.hidden = false;
  explain.querySelector('.fn-next').focus();

  if (isRight) {
    state.correct += 1;
    showFakeNewsMessage(`+${game.points}`, 'good');
    burstFileGameConfetti(card.getBoundingClientRect(), current.fake ? '#ff4b4b' : '#58cc02');
    addFakeNewsScore(game.points);
  } else {
    state.wrong += 1;
    showFakeNewsMessage('−1 życie', 'bad');
    loseFakeNewsLife();
  }
}

function addFakeNewsScore(points) {
  const state = fakeNewsState;
  const { game } = state;
  state.score += points;
  state.body.querySelector('.fg-score b').textContent = state.score;
  setQuizProgress(Math.min(1, state.score / game.goal));

  if (!state.goalReached && state.score >= game.goal) {
    state.goalReached = true;
    showFakeNewsOverlay({
      icon: '🕵️',
      title: `Masz ${game.goal} punktów!`,
      text: `Jesteś prawdziwym Detektywem Fejków! Możesz grać dalej albo zakończyć grę i odebrać ${game.reward} punktów.`,
      secondary: {
        label: 'Graj dalej',
        action: () => {
          hideFakeNewsOverlay();
          state.body.querySelector('.fg-end').hidden = false;
          state.body.querySelector('.fn-next').focus();
        }
      },
      primary: { label: `Zakończ i odbierz ${game.reward} pkt`, action: finishFakeNewsGame }
    });
  }
}

function loseFakeNewsLife() {
  const state = fakeNewsState;
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

  // Uczeń najpierw czyta wyjaśnienie ostatniego nagłówka, a dopiero „Dalej” kończy grę.
  state.over = true;
  state.body.querySelector('.fn-next').innerHTML = 'Zobacz wynik <span aria-hidden="true">→</span>';
}

function endFakeNewsLives() {
  const state = fakeNewsState;
  if (!state) return;
  // Po zdobyciu celu utrata żyć po prostu kończy grę z nagrodą.
  if (state.goalReached) {
    finishFakeNewsGame();
    return;
  }
  const { topic, index, game, score } = state;
  showFakeNewsOverlay({
    icon: '💔',
    title: 'Koniec żyć!',
    text: `Wynik: ${score} z ${game.goal} pkt. Pamiętaj: krzyczące tytuły i „!!!” to często fejki. Spróbuj jeszcze raz!`,
    link: { label: 'Wróć do ścieżki', href: `#/sciezka/${topic.slug}` },
    primary: { label: 'Zacznij od nowa', action: () => startFakeNewsGame(topic, index, game) }
  });
}

function showFakeNewsOverlay({ icon, title, text, secondary, primary, link }) {
  const state = fakeNewsState;
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

function hideFakeNewsOverlay() {
  fakeNewsState.body.querySelector('.fg-overlay').hidden = true;
  fakeNewsState.paused = false;
}

function showFakeNewsMessage(text, tone) {
  const message = fakeNewsState.body.querySelector('.fg-message');
  message.textContent = text;
  message.className = `fg-message is-${tone}`;
  clearTimeout(fakeNewsState.messageTimer);
  fakeNewsState.messageTimer = setTimeout(() => {
    message.textContent = '';
  }, 1500);
}

function finishFakeNewsGame() {
  const { topic, index, game, score, correct, wrong } = fakeNewsState;
  stopFakeNewsGame();

  const earned = Math.max(0, game.reward - readQuizBest(game.id));
  if (earned) {
    saveQuizBest(game.id, game.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, Detektywie!';
  app.querySelector('#quiz-hint').textContent = `Dobre odpowiedzi: ${correct}, pomyłki: ${wrong}. Pamiętaj — zanim uwierzysz w krzyczący tytuł, sprawdź go!`;

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🕵️</div>
    <div class="summary-stats">
      <div><strong>${score}</strong><span>wynik w grze</span></div>
      <div><strong>${correct}</strong><span>dobrych odpowiedzi</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Zagraj ponownie</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => startFakeNewsGame(topic, index, game));
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
