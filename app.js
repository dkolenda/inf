const topics = [
  {
    slug: 'praca-na-komputerze',
    title: 'Praca na komputerze',
    short: 'Komputer bez tajemnic',
    description: 'Poznaj komputer, jego elementy i zasady bezpiecznej pracy.',
    icon: '⌨',
    accent: '#58cc02',
    dark: '#46a302',
    soft: '#e9fbdc',
    quizzes: { 0: balloonPopGame, 1: computerBasicsQuiz, 2: fileSortGame, 3: desktopFolderTask, 4: networkBuildGame },
    lessons: [
      'Gra: Baloniki',
      'Quiz: Poznajemy komputer',
      'Gra: Format pliku',
      'Folder i tło pulpitu',
      'Gra: Sieć komputerowa',
      'Komputerowy finał'
    ]
  },
  {
    slug: 'wyszukiwanie-informacji',
    title: 'Wyszukiwanie informacji',
    short: 'Znajduj mądrze i szybko',
    description: 'Naucz się sprawnie wyszukiwać i oceniać informacje w sieci.',
    icon: '⌕',
    accent: '#1cb0f6',
    dark: '#168ec6',
    soft: '#e3f6ff',
    quizzes: { 0: fakeNewsGame, 1: searchTriviaQuiz, 2: searchDetectiveQuiz },
    lessons: [
      'Gra: Detektyw Fejków',
      'Quiz: Ciekawostki z sieci',
      'Quiz: Tropiciel informacji',
      'Wiarygodne źródła',
      'Fakty czy opinie?',
      'Prawa autorskie w sieci',
      'Mistrz wyszukiwania'
    ]
  },
  {
    slug: 'dokumenty-tekstowe',
    title: 'Dokumenty tekstowe',
    short: 'Pisz i formatuj',
    description: 'Twórz czytelne dokumenty i poznaj zasady ich formatowania.',
    icon: '▤',
    accent: '#9069cd',
    dark: '#744eb3',
    soft: '#f1eafd',
    quizzes: { 0: keyboardShortcutsQuiz, 1: typingDefenseGame, 2: idolCardTask },
    lessons: [
      'Quiz: Klawiatura i skróty',
      'Gra: Obrona zamku',
      'Mój idol — karta w dokumencie',
      'Czcionki i akapity',
      'Listy i wyrównanie',
      'Obrazy w dokumencie',
      'Zapis i eksport do PDF',
      'Dokument na medal'
    ]
  },
  {
    slug: 'grafika-komputerowa',
    title: 'Grafika komputerowa',
    short: 'Projektuj i twórz',
    description: 'Odkrywaj kolory, kształty i narzędzia do tworzenia grafiki.',
    icon: '✦',
    accent: '#ff4b4b',
    dark: '#d83232',
    soft: '#ffebeb',
    quizzes: { 0: coloringTask, 1: avatarTask, 2: robotDrawingTask, 3: invitationCardTask, 4: animationTask },
    lessons: [
      'Kolorowanka online',
      'Awatar na koncie Windows',
      'Rysunek: Mój robot-pomocnik',
      'Kartka z zaproszeniem',
      'Animacja poklatkowa',
      'Tekst w grafice',
      'Zapis we właściwym formacie',
      'Projekt graficzny'
    ]
  },
  {
    slug: 'prezentacje-multimedialne',
    title: 'Prezentacje multimedialne',
    short: 'Opowiadaj obrazem',
    description: 'Buduj ciekawe slajdy i prezentuj swoje pomysły z pewnością.',
    icon: '▶',
    accent: '#ff9600',
    dark: '#d67d00',
    soft: '#fff0dc',
    locked: true,
    lessons: [
      'Cel prezentacji',
      'Plan i układ slajdów',
      'Tekst, który się czyta',
      'Obrazy i ikony',
      'Kolory i spójny styl',
      'Animacje z umiarem',
      'Prezentacja finałowa'
    ]
  },
  {
    slug: 'programowanie',
    title: 'Programowanie',
    short: 'Wydawaj polecenia komputerowi',
    description: 'Poznaj algorytmy, pętle i warunki, tworząc własne programy.',
    icon: '{ }',
    accent: '#00b8a9',
    dark: '#00978a',
    soft: '#dff8f5',
    quizzes: { 0: scottieGoTask, 1: frozenTask, 2: hourOfCodeTask, 3: programmingQuiz, 4: codeRobotGame, 5: godotTask, 6: algorithmRobotGame, 7: boardCodeGame },
    lessons: [
      'Scottie Go! — pierwszy poziom',
      'Kraina Lodu — zagadki z Elzą',
      'Godzina Kodowania — zagadki',
      'Quiz: Język robotów',
      'Gra: Kod Robota',
      'Godot — postać chodzi strzałkami',
      'Gra: Algorytmy Robota',
      'Gra: Kod Planszy',
      'Szukamy błędów'
    ]
  }
];

const lessonIcons = { done: '✓', todo: '★' };

const app = document.querySelector('#app');
const homeTemplate = document.querySelector('#home-template');
const pathTemplate = document.querySelector('#path-template');
const quizTemplate = document.querySelector('#quiz-template');
const dialog = document.querySelector('#lesson-dialog');
const welcomeDialog = document.querySelector('#welcome-dialog');
const welcomeForm = document.querySelector('#welcome-form');
const studentNameInput = document.querySelector('#student-name');
const welcomeError = document.querySelector('#welcome-error');
const studentNameKey = 'informatyczna-przygoda:name';
const studentPointsKey = 'informatyczna-przygoda:points';
const progressKey = 'informatyczna-przygoda:progress';
const quizBestKey = 'informatyczna-przygoda:quiz-best';
let sessionStudentName = '';
let sessionStudentPoints = 0;
let sessionProgress = {};
let sessionQuizBest = {};
let activeLesson = null;
let quizState = null;

function readStudentName() {
  try {
    return localStorage.getItem(studentNameKey)?.trim() || sessionStudentName;
  } catch {
    return sessionStudentName;
  }
}

// Points, progress and best scores are stored separately for every student name.
function studentKey(baseKey, name = readStudentName()) {
  return `${baseKey}:${name.toLocaleLowerCase('pl-PL')}`;
}

function readStoredObject(key) {
  const stored = JSON.parse(localStorage.getItem(key) || '{}');
  return stored && typeof stored === 'object' ? stored : {};
}

// Moves data saved before per-name storage existed to the current student.
function migrateLegacyStudentData() {
  try {
    const name = readStudentName();
    if (!name) return;

    [studentPointsKey, progressKey, quizBestKey].forEach((baseKey) => {
      const legacyValue = localStorage.getItem(baseKey);
      if (legacyValue === null) return;
      if (localStorage.getItem(studentKey(baseKey, name)) === null) {
        localStorage.setItem(studentKey(baseKey, name), legacyValue);
      }
      localStorage.removeItem(baseKey);
    });
  } catch {
    // The page still works when browser storage is unavailable.
  }
}

function saveStudentName(name) {
  const changed = name.toLocaleLowerCase('pl-PL') !== readStudentName().toLocaleLowerCase('pl-PL');
  sessionStudentName = name;

  if (changed) {
    sessionStudentPoints = 0;
    sessionProgress = {};
    sessionQuizBest = {};
  }

  try {
    localStorage.setItem(studentNameKey, name);
  } catch {
    // The page still works when browser storage is unavailable.
  }

  return changed;
}

function normalizeStudentPoints(points) {
  const numericPoints = Number(points);
  return Number.isFinite(numericPoints) && numericPoints >= 0
    ? Math.floor(numericPoints * 2) / 2
    : 0;
}

function formatPoints(points) {
  return points.toLocaleString('pl-PL');
}

// 1 for the answer, 0.5 for an incomplete (partial) answer.
function scoreItem(item, answer) {
  if (answer === item.answer) return 1;
  return item.partial !== undefined && answer === item.partial ? 0.5 : 0;
}

// An item is worth 1 point unless it sets its own `points`.
function itemPoints(item) {
  return item.points ?? 1;
}

function readStudentPoints() {
  try {
    const storedPoints = localStorage.getItem(studentKey(studentPointsKey));
    sessionStudentPoints = storedPoints === null ? 0 : normalizeStudentPoints(storedPoints);
  } catch {
    // Keep the points in memory when browser storage is unavailable.
  }

  return sessionStudentPoints;
}

function saveStudentPoints(points) {
  sessionStudentPoints = normalizeStudentPoints(points);

  try {
    localStorage.setItem(studentKey(studentPointsKey), String(sessionStudentPoints));
  } catch {
    // The page still works when browser storage is unavailable.
  }

  return sessionStudentPoints;
}

function readProgress() {
  try {
    sessionProgress = readStoredObject(studentKey(progressKey));
  } catch {
    // Keep the progress in memory when browser storage is unavailable.
  }

  return sessionProgress;
}

// Returns the set of finished lesson indexes. Older saves stored a count of
// lessons finished in order, so a number n means lessons 0…n-1.
function getCompletedLessons(topic) {
  const stored = readProgress()[topic.slug];
  const indexes = Array.isArray(stored)
    ? stored
    : Array.from({ length: Math.max(Math.floor(Number(stored)) || 0, 0) }, (_, i) => i);
  return new Set(indexes.filter((i) => Number.isInteger(i) && i >= 0 && i < topic.lessons.length));
}

function completeLesson(topic, index) {
  const completed = getCompletedLessons(topic);
  if (completed.has(index)) return;
  completed.add(index);
  sessionProgress = { ...readProgress(), [topic.slug]: [...completed].sort((a, b) => a - b) };

  try {
    localStorage.setItem(studentKey(progressKey), JSON.stringify(sessionProgress));
  } catch {
    // The page still works when browser storage is unavailable.
  }
}

function readQuizBest(quizId) {
  try {
    sessionQuizBest = readStoredObject(studentKey(quizBestKey));
  } catch {
    // Keep the best scores in memory when browser storage is unavailable.
  }

  return normalizeStudentPoints(sessionQuizBest[quizId]);
}

function saveQuizBest(quizId, score) {
  sessionQuizBest = { ...sessionQuizBest, [quizId]: score };

  try {
    localStorage.setItem(studentKey(quizBestKey), JSON.stringify(sessionQuizBest));
  } catch {
    // The page still works when browser storage is unavailable.
  }
}

function getLessonState(completedLessons, index) {
  return completedLessons.has(index) ? 'done' : 'todo';
}

function getInitials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toLocaleUpperCase('pl-PL');
}

// One header segment per topic, filled by the share of completed lessons in that topic.
function renderHeaderProgress() {
  const bar = app.querySelector('.header-progress');
  if (!bar) return;
  let completedTotal = 0;
  let lessonsTotal = 0;
  bar.replaceChildren(...topics.map((topic) => {
    const completed = getCompletedLessons(topic).size;
    completedTotal += completed;
    lessonsTotal += topic.lessons.length;
    const segment = document.createElement('span');
    segment.className = 'header-progress-segment';
    segment.style.setProperty('--accent', topic.accent);
    segment.style.setProperty('--fill', `${(completed / topic.lessons.length) * 100}%`);
    segment.title = `${topic.title}: ${completed} z ${topic.lessons.length}`;
    return segment;
  }));
  const percent = lessonsTotal ? Math.round((completedTotal / lessonsTotal) * 100) : 0;
  bar.setAttribute('aria-valuenow', String(percent));
  bar.setAttribute('aria-valuetext', `Ukończono ${completedTotal} z ${lessonsTotal} zadań`);
}

function syncStudentProfile() {
  const studentName = readStudentName();
  const studentPoints = readStudentPoints();
  renderHeaderProgress();

  app.querySelectorAll('.stat-points b').forEach((pointsCounter) => {
    pointsCounter.textContent = formatPoints(studentPoints);
  });

  if (!studentName) return;

  app.querySelectorAll('.avatar').forEach((avatar) => {
    avatar.textContent = getInitials(studentName);
    avatar.setAttribute('aria-label', `Profil ucznia: ${studentName}. Kliknij, aby zmienić imię.`);
    avatar.title = studentName;
    avatar.onclick = () => openWelcomeDialog(studentName);
  });
}

function openWelcomeDialog(currentName = '') {
  studentNameInput.value = currentName;
  welcomeError.textContent = '';
  if (!welcomeDialog.open) welcomeDialog.showModal();
  requestAnimationFrame(() => studentNameInput.focus());
}

function renderHome() {
  document.title = 'Informatyczna Przygoda';
  document.querySelector('meta[name="theme-color"]').content = '#58cc02';
  app.replaceChildren(homeTemplate.content.cloneNode(true));
  const grid = app.querySelector('#topic-grid');

  topics.forEach((topic) => {
    const card = document.createElement('a');
    card.className = `topic-card${topic.locked ? ' locked' : ''}`;
    card.href = `#/sciezka/${topic.slug}`;
    card.style.setProperty('--accent', topic.accent);
    card.style.setProperty('--soft', topic.soft);
    card.setAttribute('aria-label', `${topic.title} — ${topic.locked ? 'dostępne na kolejnej lekcji' : 'otwórz ścieżkę'}`);
    card.innerHTML = `
      <span class="topic-icon" aria-hidden="true">${topic.locked ? '🔒' : topic.icon}</span>
      <h3>${topic.title}</h3>
      <p>${topic.short}</p>
      <span class="topic-arrow" aria-hidden="true">→</span>
    `;
    if (topic.locked) {
      card.addEventListener('click', (event) => {
        event.preventDefault();
        openLockedTopic(topic);
      });
    }
    grid.append(card);
  });
  syncStudentProfile();
}

function applyTopicTheme(topic) {
  document.documentElement.style.setProperty('--path-accent', topic.accent);
  document.documentElement.style.setProperty('--path-accent-dark', topic.dark);
  document.documentElement.style.setProperty('--path-accent-soft', topic.soft);
}

function renderPath(slug) {
  const topic = topics.find((item) => item.slug === slug) || topics[0];
  document.title = `${topic.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(pathTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#path-title').textContent = topic.title;
  app.querySelector('#path-description').textContent = topic.description;
  app.querySelector('#side-icon').textContent = topic.icon;

  const completedLessons = getCompletedLessons(topic);
  const progress = Math.round((completedLessons.size / topic.lessons.length) * 100);
  app.querySelector('.progress-label strong').textContent = `${completedLessons.size} z ${topic.lessons.length}`;
  app.querySelector('.progress-track span').style.width = `${progress}%`;
  app.querySelector('.unit-progress strong').textContent = `${progress}%`;
  app.querySelector('.coming-soon p').textContent = `Ukończ wszystkie ${topic.lessons.length} zadań i zdobądź mistrzowski wynik.`;

  const trail = app.querySelector('#trail');
  topic.lessons.forEach((lessonText, index) => {
    const state = getLessonState(completedLessons, index);
    const lesson = {
      state,
      icon: index === topic.lessons.length - 1 && state !== 'done' ? '🏆' : lessonIcons[state],
      title: `Zadanie ${index + 1}`,
      text: lessonText
    };
    const isAvailable = Boolean(topic.quizzes?.[index]);
    const wrapper = document.createElement('div');
    wrapper.className = `lesson-step${isAvailable ? '' : ' unavailable'}`;
    const button = document.createElement('button');
    button.className = `lesson-node ${lesson.state}${isAvailable ? '' : ' unavailable'}`;
    button.type = 'button';
    button.innerHTML = `<span aria-hidden="true">${lesson.icon}</span>`;
    button.setAttribute('aria-label', `${lesson.title}: ${lesson.text}${isAvailable ? '' : ' (wkrótce)'}`);
    button.disabled = !isAvailable;
    if (!isAvailable) button.title = 'Zadanie w przygotowaniu';
    if (!button.disabled) {
      button.addEventListener('click', () => {
        if (topic.quizzes?.[index]) window.location.hash = `#/sciezka/${topic.slug}/zadanie/${index + 1}`;
        else openLesson(topic, lesson, index);
      });
    }

    const label = document.createElement('div');
    label.className = 'lesson-label';
    label.innerHTML = `<strong>${lesson.title}</strong>${lesson.text}${isAvailable ? '' : '<em>Wkrótce</em>'}`;
    wrapper.append(button, label);
    trail.append(wrapper);
  });
  updateTrailFill();
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function updateTrailFill() {
  const trail = app.querySelector('#trail');
  if (!trail) return;
  const doneNodes = trail.querySelectorAll('.lesson-node.done');
  const target = doneNodes[doneNodes.length - 1];
  if (!target) {
    trail.style.setProperty('--trail-fill', '0px');
    return;
  }
  const fillTop = parseFloat(getComputedStyle(trail, '::after').top) || 0;
  const trailTop = trail.getBoundingClientRect().top;
  const nodeRect = target.getBoundingClientRect();
  const center = nodeRect.top + nodeRect.height / 2 - trailTop;
  trail.style.setProperty('--trail-fill', `${Math.max(0, center - fillTop)}px`);
}

window.addEventListener('resize', updateTrailFill);

function openLesson(topic, lesson, index) {
  const isDone = lesson.state === 'done';
  activeLesson = isDone ? null : { topic, index };
  document.querySelector('#dialog-icon').textContent = isDone ? '✓' : '★';
  document.querySelector('#dialog-kicker').textContent = topic.title;
  document.querySelector('#dialog-title').textContent = lesson.title;
  document.querySelector('#dialog-copy').textContent = isDone
    ? `${lesson.text} — to zadanie jest już ukończone.`
    : `${lesson.text} — ukończ je, aby zdobyć fajkę na ścieżce.`;
  dialog.querySelector('.dialog-action').textContent = isDone ? 'Rozumiem' : 'Ukończ zadanie';
  dialog.showModal();
}

function openLockedTopic(topic) {
  activeLesson = null;
  document.querySelector('#dialog-icon').textContent = '🔒';
  document.querySelector('#dialog-kicker').textContent = topic.title;
  document.querySelector('#dialog-title').textContent = 'Już wkrótce!';
  document.querySelector('#dialog-copy').textContent = 'Ten dział będzie dostępny na kolejnej lekcji.';
  dialog.querySelector('.dialog-action').textContent = 'Rozumiem';
  dialog.showModal();
}

function shuffle(list) {
  const result = [...list];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function renderQuiz(slug, index) {
  const topic = topics.find((item) => item.slug === slug);
  const quiz = topic?.quizzes?.[index];

  if (!quiz) {
    window.location.hash = topic ? `#/sciezka/${topic.slug}` : '#/';
    return;
  }

  if (quiz.type === 'game') {
    renderFileGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'balloons') {
    renderBalloonGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'typing') {
    renderTypingGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'network') {
    renderNetworkGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'fakes') {
    renderFakeNewsGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'coloring') {
    renderColoringGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'task') {
    renderComputerTask(topic, index, quiz);
    return;
  }

  if (quiz.type === 'code') {
    renderCodeGame(topic, index, quiz);
    return;
  }

  if (quiz.type === 'board') {
    renderBoardGame(topic, index, quiz);
    return;
  }

  document.title = `${quiz.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;

  quizState = {
    topic,
    index,
    quiz,
    step: 0,
    score: 0,
    total: quiz.questions.reduce((sum, question) => sum + question.items.reduce((itemSum, item) => itemSum + itemPoints(item), 0), 0)
  };

  const body = app.querySelector('#quiz-body');
  body.addEventListener('click', handleQuizClick);
  body.addEventListener('dragstart', handleQuizDragStart);
  body.addEventListener('dragover', handleQuizDragOver);
  body.addEventListener('dragleave', handleQuizDragLeave);
  body.addEventListener('drop', handleQuizDrop);
  body.addEventListener('input', handleQuizInput);
  body.addEventListener('beforeinput', handlePracticeBeforeInput);
  body.addEventListener('cut', handlePracticeClipboard);
  body.addEventListener('paste', handlePracticeClipboard);
  app.querySelector('#quiz-check').addEventListener('click', handleQuizCheck);

  renderQuizStep();
  syncStudentProfile();
}

function currentQuestion() {
  return quizState.quiz.questions[quizState.step];
}

function setQuizProgress(fraction) {
  const progress = app.querySelector('.quiz-progress');
  const percent = Math.round(fraction * 100);
  progress.querySelector('span').style.width = `${percent}%`;
  progress.setAttribute('aria-valuenow', String(percent));
}

function renderQuizStep() {
  const question = currentQuestion();
  const { quiz, step } = quizState;
  const items = question.items.map((_, itemIndex) => itemIndex);

  Object.assign(quizState, {
    answers: new Map(),
    selected: null,
    checked: false,
    order: question.shuffle === false ? items : shuffle(items),
    sequence: [],
    bucketOrder: question.match && question.buckets ? shuffle(question.buckets) : question.buckets
  });
  if (question.type === 'inputs') {
    question.items.forEach((item, itemIndex) => {
      if (item.value) quizState.answers.set(itemIndex, item.value);
    });
  }
  if (question.type === 'practice') {
    quizState.fields = question.items.map((item, itemIndex) => {
      quizState.answers.set(itemIndex, false);
      return { left: item.left, right: '' };
    });
  }

  setQuizProgress(step / quiz.questions.length);
  app.querySelector('#quiz-kicker').textContent = `Część ${question.label} · ${step + 1} z ${quiz.questions.length}`;
  app.querySelector('#quiz-prompt').textContent = question.prompt;
  renderQuizHint(app.querySelector('#quiz-hint'), question.hint || '');
  renderQuizTip(question.tip);
  renderQuizArt(question.art);

  const footer = app.querySelector('#quiz-footer');
  footer.hidden = false;
  footer.className = 'quiz-footer';
  app.querySelector('#quiz-feedback').replaceChildren();
  app.querySelector('#quiz-check').textContent = 'Sprawdź';

  renderQuizBody();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

// Hint text with website addresses (e.g. scholar.google.com) turned into clickable links.
function renderQuizHint(element, text) {
  element.replaceChildren();
  text.split(/([a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:pl|com))/i).forEach((part, index) => {
    if (index % 2 === 0) {
      element.append(part);
      return;
    }
    const link = document.createElement('a');
    link.href = `https://${part}/`;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = part;
    element.append(link);
  });
}

// Optional collapsible how-to box under the hint: { title, steps: [...] }; `text` in a step is shown as code.
function renderQuizTip(tip) {
  const details = app.querySelector('#quiz-tip');
  details.hidden = !tip;
  details.open = false;
  if (!tip) return;

  details.querySelector('summary').textContent = tip.title;
  const list = details.querySelector('.quiz-tip-steps');
  list.replaceChildren();
  tip.steps.forEach((step) => {
    const item = document.createElement('li');
    step.split(/`([^`]+)`/).forEach((part, index) => {
      const piece = document.createElement(index % 2 ? 'code' : 'span');
      if (index % 2) piece.textContent = part;
      else renderQuizHint(piece, part);
      item.append(piece);
    });
    list.append(item);
  });
}

// Optional illustration above the rows: a picture with speech bubbles around it.
function renderQuizArt(art) {
  const figure = app.querySelector('#quiz-art');
  figure.hidden = !art;
  figure.classList.toggle('is-photo', Boolean(art?.photo));
  figure.classList.toggle('is-wide', Boolean(art?.wide));
  figure.replaceChildren();
  if (!art) return;

  const photo = document.createElement('img');
  photo.src = art.image;
  photo.alt = art.alt;
  figure.append(photo);

  (art.bubbles || []).forEach((bubble, index) => {
    const label = document.createElement('span');
    label.className = `quiz-art-bubble quiz-art-bubble-${index + 1} ${bubble.tone}`;
    label.textContent = bubble.text;
    label.setAttribute('aria-hidden', 'true');
    figure.append(label);
  });

  if (art.caption) {
    const caption = document.createElement('figcaption');
    caption.textContent = art.caption;
    figure.append(caption);
  }
}

function renderQuizBody() {
  const focusKey = document.activeElement?.dataset?.key;
  const body = app.querySelector('#quiz-body');
  const question = currentQuestion();

  if (question.type === 'choices') renderChoices(question, body);
  else if (question.type === 'keyboard') renderKeyboard(question, body);
  else if (question.type === 'inputs') renderInputs(question, body);
  else if (question.type === 'practice') renderPractice(question, body);
  else if (question.type === 'order') renderOrder(question, body);
  else renderBuckets(question, body);

  app.querySelector('.quiz-view').classList.toggle('has-selection', quizState.selected !== null);
  updateQuizCheck();
  if (focusKey) body.querySelector(`[data-key="${focusKey}"]`)?.focus();
}

function updateQuizCheck() {
  app.querySelector('#quiz-check').disabled = !quizState.checked && quizState.answers.size < currentQuestion().items.length;
}

function createChip(question, itemIndex) {
  const { answers, selected, checked } = quizState;
  const item = question.items[itemIndex];
  const chip = document.createElement('button');
  chip.type = 'button';
  chip.className = `chip${question.mono ? ' is-mono' : ''}`;
  chip.textContent = item.text;
  if (item.icon) {
    const icon = document.createElement('span');
    icon.className = 'chip-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = item.icon;
    chip.prepend(icon);
  }
  chip.dataset.item = itemIndex;
  chip.dataset.key = `item-${itemIndex}`;
  chip.setAttribute('aria-pressed', String(selected === itemIndex));

  if (checked) {
    const isCorrect = question.type === 'order'
      ? orderScores(question)[itemIndex] === 1
      : answers.get(itemIndex) === item.answer;
    chip.classList.add(isCorrect ? 'correct' : 'wrong');
    chip.disabled = true;

    if (!isCorrect && question.type === 'order') {
      const fix = document.createElement('small');
      const places = orderAnswers(question).flatMap((answer, position) => (answer === item.answer ? [position + 1] : []));
      fix.textContent = `→ miejsce ${places.join(' lub ')}`;
      chip.append(fix);
    } else if (!isCorrect && question.type !== 'keyboard') {
      const fix = document.createElement('small');
      const answerBucket = question.buckets.find((bucket) => bucket.id === item.answer);
      fix.textContent = question.match ? 'to nie ta definicja' : `→ ${answerBucket.label}`;
      chip.append(fix);
    }
  } else {
    chip.draggable = true;
  }

  return chip;
}

function renderChipPool(question) {
  const { answers, order, checked } = quizState;
  const pool = document.createElement('div');
  pool.className = 'chip-pool';
  pool.dataset.drop = '';
  const waiting = order.filter((itemIndex) => !answers.has(itemIndex));
  waiting.forEach((itemIndex) => pool.append(createChip(question, itemIndex)));

  if (!waiting.length) {
    const done = document.createElement('p');
    done.className = 'pool-empty';
    done.textContent = checked ? 'Sprawdzone!' : 'Wszystko na miejscu — kliknij „Sprawdź”.';
    pool.append(done);
  }
  return pool;
}

function renderBuckets(question, body) {
  const { answers, order, bucketOrder, checked } = quizState;
  body.className = `quiz-body bucket-quiz${question.match ? ' is-match' : ''}`;
  const pool = renderChipPool(question);

  const buckets = document.createElement('div');
  buckets.className = 'buckets';

  bucketOrder.forEach((bucket) => {
    const box = document.createElement('div');
    box.className = 'bucket';
    box.dataset.bucket = bucket.id;
    box.dataset.drop = bucket.id;

    const target = document.createElement('button');
    target.type = 'button';
    target.className = 'bucket-target';
    target.dataset.key = `bucket-${bucket.id}`;
    target.disabled = checked;
    target.textContent = bucket.label;

    if (bucket.note) {
      const note = document.createElement('small');
      note.textContent = bucket.note;
      target.append(note);
    }

    const content = document.createElement('div');
    content.className = 'bucket-items';
    order
      .filter((itemIndex) => answers.get(itemIndex) === bucket.id)
      .forEach((itemIndex) => content.append(createChip(question, itemIndex)));

    if (checked && question.match) {
      const answerItem = question.items.find((item) => item.answer === bucket.id);
      if (answers.get(question.items.indexOf(answerItem)) !== bucket.id) {
        const fix = document.createElement('small');
        fix.className = 'bucket-fix';
        fix.textContent = `Poprawnie: ${answerItem.text}`;
        content.append(fix);
      }
    }

    box.append(target, content);
    buckets.append(box);
  });

  body.replaceChildren(pool, buckets);
}

// Kolejność kroków: answer to numer kroku, a kroki z tym samym numerem są wymienne.
function orderAnswers(question) {
  return question.items.map((item) => item.answer).sort((a, b) => a - b);
}

function orderScores(question) {
  const expected = orderAnswers(question);
  return question.items.map((item, itemIndex) => (item.answer === expected[quizState.sequence.indexOf(itemIndex)] ? 1 : 0));
}

// Jedna numerowana lista; krok z puli trafia na jej koniec albo w miejsce upuszczenia.
function renderOrder(question, body) {
  body.className = 'quiz-body bucket-quiz order-quiz';
  const list = document.createElement('ol');
  list.className = 'order-list';
  list.dataset.drop = 'list';

  quizState.sequence.forEach((itemIndex, position) => {
    const step = document.createElement('li');
    step.className = 'order-step';
    step.dataset.drop = 'list';
    step.dataset.position = position;
    const number = document.createElement('span');
    number.className = 'order-number';
    number.textContent = position + 1;
    step.append(number, createChip(question, itemIndex));
    list.append(step);
  });

  if (!quizState.sequence.length) {
    const empty = document.createElement('li');
    empty.className = 'order-empty';
    empty.textContent = 'Tu ułóż kroki po kolei.';
    list.append(empty);
  } else if (!quizState.checked && quizState.sequence.length < question.items.length) {
    // Puste miejsce na końcu listy: upuszczony tu krok trafia na sam dół.
    const slot = document.createElement('li');
    slot.className = 'order-step order-slot';
    slot.dataset.drop = 'list';
    const number = document.createElement('span');
    number.className = 'order-number';
    number.textContent = quizState.sequence.length + 1;
    const space = document.createElement('span');
    space.className = 'order-slot-space';
    space.textContent = 'Upuść tu następny krok';
    slot.append(number, space);
    list.append(slot);
  }

  body.replaceChildren(renderChipPool(question), list);
}

// Klawiatura z pustymi miejscami: każde miejsce (slot) to grupa na jeden klawisz.
function renderKeyboard(question, body) {
  const { answers, order, checked } = quizState;
  body.className = 'quiz-body bucket-quiz keyboard-quiz';

  const board = document.createElement('div');
  board.className = 'kb';
  board.setAttribute('aria-label', 'Klawiatura z pustymi miejscami na klawisze');

  question.keyboard.forEach((row) => {
    const line = document.createElement('div');
    line.className = 'kb-row';
    row.forEach((key) => {
      const { label = '', w = 1, slot, gap } = typeof key === 'string' ? { label: key } : key;
      const cell = document.createElement('div');
      cell.className = `kb-key${gap ? ' is-gap' : ''}${!slot && !label ? ' is-blank' : ''}`;
      cell.style.setProperty('--w', w);
      line.append(cell);
      if (!slot) {
        cell.textContent = label;
        cell.setAttribute('aria-hidden', 'true');
        return;
      }

      cell.classList.add('bucket', 'kb-slot');
      cell.dataset.bucket = slot;
      cell.dataset.drop = slot;
      const placed = order.find((itemIndex) => answers.get(itemIndex) === slot);
      if (placed === undefined) {
        const target = document.createElement('button');
        target.type = 'button';
        target.className = 'kb-slot-target';
        target.dataset.key = `bucket-${slot}`;
        target.disabled = checked;
        target.setAttribute('aria-label', 'Puste miejsce na klawisz');
        target.textContent = '?';
        cell.append(target);
      } else {
        cell.append(createChip(question, placed));
      }

      if (checked) {
        const answerItem = question.items.find((item) => item.answer === slot);
        if (answers.get(question.items.indexOf(answerItem)) !== slot) {
          const fix = document.createElement('small');
          fix.className = 'kb-fix';
          fix.textContent = answerItem.text;
          cell.append(fix);
        }
      }
    });
    board.append(line);
  });

  body.replaceChildren(renderChipPool(question), board);
}

// Pola do wpisania tekstu; odpowiedź to wpisany tekst bez spacji na brzegach.
function renderInputs(question, body) {
  const { answers, order, checked } = quizState;
  body.className = 'quiz-body input-quiz';
  body.replaceChildren(...order.map((itemIndex) => {
    const item = question.items[itemIndex];
    const isCorrect = scoreItem(item, answers.get(itemIndex)) === 1;
    const row = document.createElement('label');
    row.className = 'input-row';
    if (checked) row.classList.add(isCorrect ? 'correct' : 'wrong');

    const text = document.createElement('span');
    text.textContent = item.text;
    const field = document.createElement('input');
    field.type = 'text';
    field.className = 'quiz-input';
    field.value = answers.get(itemIndex) ?? '';
    field.dataset.item = itemIndex;
    field.dataset.key = `input-${itemIndex}`;
    field.disabled = checked;
    field.autocomplete = 'off';
    field.spellcheck = false;
    field.setAttribute('autocapitalize', 'off');
    row.append(text, field);

    if (checked && !isCorrect) {
      const fix = document.createElement('small');
      fix.className = 'input-fix';
      fix.textContent = `Poprawnie: ${item.answer}`;
      row.append(fix);
    }
    return row;
  }));
}

// Czy uczeń zrobił to, o co prosi polecenie nad parą pól (patrz 'practice' w quizzes.js).
function isPracticeDone(item, field) {
  if (item.kind === 'copy') return Boolean(field.pasted) && field.left === item.word && field.right.trim() === item.word;
  if (item.kind === 'cut') return Boolean(field.cut && field.pasted) && !field.left.trim() && field.right.trim() === item.word;
  if (item.kind === 'clear') return Boolean(field.cleared) && !field.left;
  return field.right.trim() === item.word;
}

function renderPractice(question, body) {
  const { answers, order, checked, fields } = quizState;
  body.className = 'quiz-body practice-quiz';
  body.replaceChildren(...order.map((itemIndex) => {
    const item = question.items[itemIndex];
    const row = document.createElement('div');
    row.className = `practice-row${item.kind === 'clear' ? ' is-single' : ''}`;
    if (answers.get(itemIndex)) row.classList.add('is-done');
    if (checked) row.classList.add(answers.get(itemIndex) ? 'correct' : 'wrong');

    const text = document.createElement('p');
    text.textContent = item.text;
    const pair = document.createElement('div');
    pair.className = 'practice-fields';

    (item.kind === 'clear' ? ['left'] : ['left', 'right']).forEach((side) => {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'quiz-input';
      input.value = fields[itemIndex][side];
      input.dataset.item = itemIndex;
      input.dataset.side = side;
      input.dataset.key = `practice-${itemIndex}-${side}`;
      input.disabled = checked;
      input.autocomplete = 'off';
      input.spellcheck = false;
      input.setAttribute('aria-label', `${item.text} — pole ${side === 'left' ? 'po lewej' : 'po prawej'}`);

      // Pola nie da się kliknąć: wejść do niego można tylko klawiszem Tab.
      if (item.kind === 'tab' && side === 'right') {
        const wrap = document.createElement('div');
        wrap.className = 'practice-covered';
        wrap.title = 'Tu nie klikniesz — użyj Tab';
        wrap.addEventListener('mousedown', (event) => event.preventDefault());
        wrap.append(input);
        pair.append(wrap);
      } else {
        pair.append(input);
      }
    });

    row.append(text, pair);
    return row;
  }));
}

function handleQuizInput(event) {
  const input = event.target.closest('.quiz-input');
  if (!input || !quizState || quizState.checked) return;
  const question = currentQuestion();
  const itemIndex = Number(input.dataset.item);

  if (question.type === 'inputs') {
    const value = input.value.trim();
    if (value) quizState.answers.set(itemIndex, value);
    else quizState.answers.delete(itemIndex);
    updateQuizCheck();
    return;
  }

  if (question.type === 'practice') {
    const field = quizState.fields[itemIndex];
    field[input.dataset.side] = input.value;
    const done = isPracticeDone(question.items[itemIndex], field);
    quizState.answers.set(itemIndex, done);
    input.closest('.practice-row').classList.toggle('is-done', done);
  }
}

// Usunięcie całego zaznaczonego tekstu naraz (np. po Ctrl + A).
function handlePracticeBeforeInput(event) {
  const input = event.target.closest('.quiz-input[data-side]');
  if (!input || !quizState || quizState.checked || !event.inputType.startsWith('delete')) return;
  if (input.value && input.selectionStart === 0 && input.selectionEnd === input.value.length) {
    quizState.fields[Number(input.dataset.item)].cleared = true;
  }
}

function handlePracticeClipboard(event) {
  const input = event.target.closest('.quiz-input[data-side]');
  if (!input || !quizState || quizState.checked) return;
  const field = quizState.fields[Number(input.dataset.item)];
  if (event.type === 'cut' && input.dataset.side === 'left') field.cut = true;
  if (event.type === 'paste' && input.dataset.side === 'right') field.pasted = true;
}

function renderChoices(question, body) {
  const { answers, order, checked } = quizState;
  body.className = `quiz-body choice-list${question.layout === 'abcd' ? ' is-abcd' : ''}`;
  body.replaceChildren();

  order.forEach((itemIndex) => {
    const item = question.items[itemIndex];
    const row = document.createElement('div');
    row.className = 'choice-row';
    if (checked) row.classList.add(['wrong', 'partial', 'correct'][scoreItem(item, answers.get(itemIndex)) * 2]);

    const text = document.createElement('p');
    renderQuizHint(text, item.text);
    if (item.image) {
      const photo = document.createElement('img');
      photo.className = 'choice-photo';
      photo.src = item.image;
      photo.alt = '';
      photo.loading = 'lazy';
      text.prepend(photo);
    }

    const options = document.createElement('div');
    options.className = 'choice-options';
    options.setAttribute('role', 'group');
    options.setAttribute('aria-label', item.text);

    question.options.forEach((option) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'choice-option';
      button.textContent = option.label;
      if (question.layout === 'abcd') {
        const letter = document.createElement('span');
        letter.className = 'choice-letter';
        letter.textContent = option.id.toUpperCase();
        letter.setAttribute('aria-hidden', 'true');
        button.prepend(letter);
      }
      button.dataset.item = itemIndex;
      button.dataset.option = option.id;
      button.dataset.key = `option-${itemIndex}-${option.id}`;
      button.setAttribute('aria-pressed', String(answers.get(itemIndex) === option.id));
      button.disabled = checked;

      if (checked && option.id === item.answer) button.classList.add('is-answer');
      if (checked && answers.get(itemIndex) === option.id && option.id !== item.answer) {
        button.classList.add(option.id === item.partial ? 'is-partial' : 'is-wrong');
      }
      options.append(button);
    });

    row.append(text);

    // Algorytmy do porównania: karty obok siebie z ponumerowanymi krokami.
    if (item.algorithms) {
      const algorithms = document.createElement('div');
      algorithms.className = 'choice-algorithms';
      item.algorithms.forEach((steps, index) => {
        const card = document.createElement('div');
        card.className = 'choice-algorithm';
        const title = document.createElement('strong');
        title.textContent = `Algorytm ${index + 1}`;
        const list = document.createElement('ol');
        steps.forEach((step) => {
          const entry = document.createElement('li');
          entry.textContent = step;
          list.append(entry);
        });
        card.append(title, list);
        algorithms.append(card);
      });
      row.append(algorithms);
    }

    row.append(options);

    if (checked && item.explain) {
      const explain = document.createElement('p');
      explain.className = 'choice-explain';
      explain.textContent = item.explain;
      row.append(explain);
    }

    body.append(row);
  });
}

function placeQuizItem(itemIndex, bucketId, position) {
  const { answers, sequence } = quizState;

  if (currentQuestion().type === 'order') {
    const from = sequence.indexOf(itemIndex);
    if (from !== -1) sequence.splice(from, 1);
    if (bucketId === '') answers.delete(itemIndex);
    else {
      answers.set(itemIndex, bucketId);
      sequence.splice(position ?? sequence.length, 0, itemIndex);
    }
  } else if (bucketId === '') {
    answers.delete(itemIndex);
  } else {
    if (currentQuestion().match) {
      answers.forEach((placedBucket, placedItem) => {
        if (placedBucket === bucketId && placedItem !== itemIndex) answers.delete(placedItem);
      });
    }
    answers.set(itemIndex, bucketId);
  }

  quizState.selected = null;
  renderQuizBody();
}

function handleQuizClick(event) {
  if (!quizState || quizState.checked) return;
  const question = currentQuestion();

  if (question.type === 'choices') {
    const option = event.target.closest('[data-option]');
    if (!option) return;
    quizState.answers.set(Number(option.dataset.item), option.dataset.option);
    renderQuizBody();
    return;
  }

  const chip = event.target.closest('.chip');
  const bucket = event.target.closest('.bucket');
  const { selected, answers } = quizState;

  if (question.type === 'order') {
    if (chip) placeQuizItem(Number(chip.dataset.item), answers.has(Number(chip.dataset.item)) ? '' : 'list');
    return;
  }

  if (chip) {
    const itemIndex = Number(chip.dataset.item);
    if (selected !== null && selected !== itemIndex && bucket) {
      placeQuizItem(selected, bucket.dataset.bucket);
    } else if (answers.has(itemIndex)) {
      placeQuizItem(itemIndex, '');
    } else {
      quizState.selected = selected === itemIndex ? null : itemIndex;
      renderQuizBody();
    }
    return;
  }

  if (bucket && selected !== null) placeQuizItem(selected, bucket.dataset.bucket);
}

function handleQuizDragStart(event) {
  const chip = event.target.closest('.chip');
  if (!chip || !quizState || quizState.checked) return;
  event.dataTransfer.setData('text/plain', chip.dataset.item);
  event.dataTransfer.effectAllowed = 'move';
  startDragAutoScroll();
}

// Przewijanie okna, gdy przeciągany element zbliża się do górnej/dolnej krawędzi ekranu.
const DRAG_SCROLL_EDGE = 80;
const DRAG_SCROLL_MAX_SPEED = 18;
let dragScrollY = null;
let dragScrollFrame = 0;

function trackDragPointer(event) {
  dragScrollY = event.clientY;
}

function dragAutoScrollStep() {
  if (dragScrollY !== null) {
    const height = window.innerHeight;
    const edge = Math.min(DRAG_SCROLL_EDGE, height / 4);
    let delta = 0;
    if (dragScrollY < edge) delta = -DRAG_SCROLL_MAX_SPEED * (1 - dragScrollY / edge);
    else if (dragScrollY > height - edge) delta = DRAG_SCROLL_MAX_SPEED * (1 - (height - dragScrollY) / edge);
    if (delta) window.scrollBy(0, delta);
  }
  dragScrollFrame = requestAnimationFrame(dragAutoScrollStep);
}

function startDragAutoScroll() {
  stopDragAutoScroll();
  document.addEventListener('dragover', trackDragPointer);
  document.addEventListener('dragend', stopDragAutoScroll);
  document.addEventListener('drop', stopDragAutoScroll);
  dragScrollFrame = requestAnimationFrame(dragAutoScrollStep);
}

function stopDragAutoScroll() {
  cancelAnimationFrame(dragScrollFrame);
  dragScrollY = null;
  document.removeEventListener('dragover', trackDragPointer);
  document.removeEventListener('dragend', stopDragAutoScroll);
  document.removeEventListener('drop', stopDragAutoScroll);
}

function handleQuizDragOver(event) {
  const target = event.target.closest('[data-drop]');
  if (!target || !quizState || quizState.checked) return;
  event.preventDefault();
  target.classList.add('drag-over');
}

function handleQuizDragLeave(event) {
  const target = event.target.closest('[data-drop]');
  if (target && !target.contains(event.relatedTarget)) target.classList.remove('drag-over');
}

function handleQuizDrop(event) {
  const target = event.target.closest('[data-drop]');
  if (!target || !quizState || quizState.checked) return;
  event.preventDefault();
  const itemIndex = Number(event.dataTransfer.getData('text/plain'));
  const step = event.target.closest('[data-position]');
  if (Number.isInteger(itemIndex)) placeQuizItem(itemIndex, target.dataset.drop, step ? Number(step.dataset.position) : undefined);
}

const rewardDialog = document.querySelector('#reward-dialog');
const confettiCanvas = document.querySelector('#confetti-canvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const rewardTitles = ['Świetnie!', 'Brawo!', 'Rewelacja!', 'Tak trzymaj!', 'Mistrzowsko!'];
let confettiFrame = 0;
let rewardTimers = [];

function launchConfetti() {
  if (reduceMotion.matches) return;
  cancelAnimationFrame(confettiFrame);

  const ctx = confettiCanvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  confettiCanvas.width = width * ratio;
  confettiCanvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

  const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#9069cd', '#ff9600'];
  const pieces = Array.from({ length: 160 }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = (fromLeft ? -60 : -120) + (Math.random() - 0.5) * 50;
    const speed = 9 + Math.random() * 10;
    return {
      x: fromLeft ? 0 : width,
      y: height * 0.75,
      vx: Math.cos((angle * Math.PI) / 180) * speed,
      vy: Math.sin((angle * Math.PI) / 180) * speed,
      size: 6 + Math.random() * 7,
      color: colors[i % colors.length],
      spin: Math.random() * Math.PI,
      spinSpeed: (Math.random() - 0.5) * 0.35,
      round: Math.random() < 0.3
    };
  });
  const start = performance.now();

  function frame(now) {
    const elapsed = now - start;
    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = Math.max(0, Math.min(1, (3200 - elapsed) / 800));

    pieces.forEach((piece) => {
      piece.vx *= 0.985;
      piece.vy = piece.vy * 0.985 + 0.32;
      piece.x += piece.vx;
      piece.y += piece.vy;
      piece.spin += piece.spinSpeed;

      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.spin);
      ctx.fillStyle = piece.color;
      if (piece.round) {
        ctx.beginPath();
        ctx.arc(0, 0, piece.size / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillRect(-piece.size / 2, -piece.size / 4, piece.size, (piece.size / 2) * Math.abs(Math.cos(piece.spin * 2)) + 1);
      }
      ctx.restore();
    });

    if (elapsed < 3200) confettiFrame = requestAnimationFrame(frame);
    else ctx.clearRect(0, 0, width, height);
  }

  confettiFrame = requestAnimationFrame(frame);
}

function countUp(element, target, delay, duration = 700) {
  element.textContent = '0';
  if (reduceMotion.matches || !target) {
    element.textContent = formatPoints(target);
    return;
  }

  rewardTimers.push(setTimeout(() => {
    const start = performance.now();
    let shown = 0;
    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const value = progress < 1 ? Math.round(target * (1 - (1 - progress) ** 3)) : target;
      if (value !== shown) {
        shown = value;
        element.textContent = formatPoints(value);
        element.classList.remove('is-bumping');
        void element.offsetWidth;
        element.classList.add('is-bumping');
      }
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, delay));
}

// correct counts partial answers as halves; correctCount counts only full answers.
function showReward(points, correct, correctCount, total, gif) {
  rewardTimers.forEach(clearTimeout);
  rewardTimers = [];

  const character = rewardDialog.querySelector('#reward-character');
  if (gif) character.src = gif;
  else character.removeAttribute('src');

  const allCorrect = correctCount === total;
  rewardDialog.classList.remove('is-task');
  rewardDialog.classList.toggle('is-partial', !allCorrect);
  rewardDialog.querySelector('#reward-title').textContent = allCorrect
    ? rewardTitles[Math.floor(Math.random() * rewardTitles.length)]
    : correct >= total / 2 ? 'Nieźle!' : 'Zapamiętaj poprawki';
  rewardDialog.querySelector('#reward-copy').textContent = allCorrect
    ? 'Wszystkie odpowiedzi poprawne!'
    : `Poprawne odpowiedzi: ${correctCount} z ${total}. Sprawdź poprawki w zadaniu.`;
  countUp(rewardDialog.querySelector('#reward-points'), points, 350);
  countUp(rewardDialog.querySelector('#reward-correct'), correctCount, 500);
  countUp(rewardDialog.querySelector('#reward-accuracy'), Math.round((correct / total) * 100), 650);

  rewardDialog.querySelector('#reward-review').hidden = allCorrect;
  rewardDialog.showModal();
  rewardDialog.querySelector('#reward-action').focus();
  if (allCorrect) launchConfetti();
}

// Zadanie zaliczone kodem nauczyciela: ten sam mem i konfetti, ale tylko punkty (bez poprawnych i celności).
function showTaskReward(points, gif) {
  showReward(points, 1, 1, 1, gif);
  rewardDialog.classList.add('is-task');
  rewardDialog.querySelector('#reward-copy').textContent = 'Zadanie zaliczone!';
}

function closeReward() {
  rewardTimers.forEach(clearTimeout);
  rewardTimers = [];
  cancelAnimationFrame(confettiFrame);
  confettiCanvas.getContext('2d').clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
  if (rewardDialog.open) rewardDialog.close();
}

rewardDialog.querySelector('#reward-action').addEventListener('click', () => {
  closeReward();
  if (quizState?.checked) handleQuizCheck();
});
// Zamyka podsumowanie bez przechodzenia dalej, żeby uczeń zobaczył poprawki; „Dalej” jest w stopce.
rewardDialog.querySelector('#reward-review').addEventListener('click', () => {
  closeReward();
  app.querySelector('#quiz-check')?.focus();
});
rewardDialog.addEventListener('cancel', () => closeReward());

function handleQuizCheck() {
  const question = currentQuestion();
  const { quiz } = quizState;

  if (quizState.checked) {
    quizState.step += 1;
    if (quizState.step < quiz.questions.length) renderQuizStep();
    else renderQuizSummary();
    return;
  }

  const scores = question.type === 'order'
    ? orderScores(question)
    : question.items.map((item, itemIndex) => scoreItem(item, quizState.answers.get(itemIndex)));
  const correct = scores.reduce((sum, score) => sum + score, 0);
  const total = question.items.length;
  const points = question.items.reduce((sum, item, itemIndex) => sum + scores[itemIndex] * itemPoints(item), 0);
  const maxPoints = question.items.reduce((sum, item) => sum + itemPoints(item), 0);
  quizState.score += points;
  quizState.checked = true;
  quizState.selected = null;
  renderQuizBody();

  const allCorrect = correct === total;
  app.querySelector('#quiz-footer').classList.add(allCorrect ? 'is-correct' : 'is-partial');

  const heading = document.createElement('strong');
  heading.textContent = allCorrect ? 'Świetnie! Wszystko dobrze!' : correct >= total / 2 ? 'Nieźle!' : 'Zapamiętaj poprawki';
  const detail = document.createElement('span');
  detail.textContent = allCorrect
    ? total === 1 ? `+${formatPoints(points)} pkt!` : `${correct} z ${total} poprawnych odpowiedzi.`
    : `${formatPoints(points)} z ${maxPoints} pkt. Sprawdź poprawione odpowiedzi powyżej.`;
  app.querySelector('#quiz-feedback').replaceChildren(heading, detail);

  const button = app.querySelector('#quiz-check');
  button.textContent = quizState.step === quiz.questions.length - 1 ? 'Zobacz wynik' : 'Dalej';
  button.focus();

  showReward(points, correct, scores.filter((score) => score === 1).length, total, question.rewardGif);
}

function renderQuizSummary() {
  const { topic, index, quiz, score, total } = quizState;
  const quizId = quiz.id || `${topic.slug}/${index}`;
  const earned = Math.max(0, score - readQuizBest(quizId));
  const percent = Math.round((score / total) * 100);

  if (earned) {
    saveQuizBest(quizId, score);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = quiz.title;
  app.querySelector('#quiz-prompt').textContent = percent >= 80 ? 'Brawo, quiz ukończony!' : 'Quiz ukończony!';
  app.querySelector('#quiz-tip').hidden = true;
  app.querySelector('#quiz-hint').textContent = percent === 100
    ? 'Wszystkie odpowiedzi poprawne. Komputer nie ma przed Tobą tajemnic!'
    : 'Powtórz quiz, aby poprawić wynik i zdobyć więcej punktów.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">${percent >= 80 ? '🏆' : '★'}</div>
    <div class="summary-stats">
      <div><strong>${formatPoints(score)}/${total}</strong><span>punktów</span></div>
      <div><strong>${percent}%</strong><span>wynik</span></div>
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <button class="secondary-button quiz-retry" type="button">Powtórz quiz</button>
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  body.querySelector('.quiz-retry').addEventListener('click', () => renderQuiz(topic.slug, index));
  quizState = null;
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function route() {
  const match = window.location.hash.match(/^#\/sciezka\/([^/]+)(?:\/zadanie\/(\d+))?/);
  quizState = null;
  stopFileGame();
  stopBalloonGame();
  stopNetworkGame();
  stopFakeNewsGame();
  stopTypingGame();
  stopColoringGame();
  stopCodeGame();
  stopBoardGame();
  stopPivotAnimator();
  closeReward();
  if (match && topics.find((topic) => topic.slug === match[1])?.locked) {
    window.location.replace('#/');
    return;
  }
  if (match?.[2]) renderQuiz(match[1], Number(match[2]) - 1);
  else if (match) renderPath(match[1]);
  else renderHome();
}

dialog.querySelector('.dialog-close').addEventListener('click', () => dialog.close());
dialog.querySelector('.dialog-action').addEventListener('click', () => {
  dialog.close();
  if (!activeLesson) return;
  completeLesson(activeLesson.topic, activeLesson.index);
  activeLesson = null;
  route();
});
dialog.addEventListener('click', (event) => {
  if (event.target === dialog) dialog.close();
});

welcomeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const studentName = studentNameInput.value.trim().replace(/\s+/g, ' ');

  if (studentName.length < 2) {
    welcomeError.textContent = 'Wpisz imię składające się z co najmniej 2 znaków.';
    studentNameInput.focus();
    return;
  }

  const nameChanged = saveStudentName(studentName);
  welcomeDialog.close();

  // Another student: show the home screen with their own points and progress.
  if (nameChanged && window.location.hash) window.location.hash = '';
  else if (nameChanged) route();
  else syncStudentProfile();
});

welcomeDialog.addEventListener('cancel', (event) => {
  if (!readStudentName()) event.preventDefault();
});

window.addEventListener('hashchange', route);
migrateLegacyStudentData();
route();
if (!readStudentName()) openWelcomeDialog();
