// Zadanie „Praca na komputerze”: lista krótkich kroków z podpowiedziami pod „?”
// i pole na kod, który nauczyciel podaje po sprawdzeniu pracy (sprawdza go teacher-code.js).
// Korzysta z funkcji app.js (setQuizProgress, completeLesson, saveStudentPoints…).
function normalizeTaskCode(code) {
  return code.toUpperCase().replace(/\s+/g, '');
}

function renderComputerTask(topic, index, task) {
  document.title = `${task.title} — Informatyczna Przygoda`;
  document.querySelector('meta[name="theme-color"]').content = topic.accent;
  app.replaceChildren(quizTemplate.content.cloneNode(true));
  applyTopicTheme(topic);
  app.querySelector('#quiz-close').href = `#/sciezka/${topic.slug}`;
  app.querySelector('#quiz-footer').hidden = true;
  app.querySelector('#quiz-kicker').textContent = task.title;
  app.querySelector('#quiz-prompt').textContent = task.prompt;
  app.querySelector('#quiz-hint').innerHTML = task.hint || '';
  app.querySelector('#quiz-hint').hidden = !task.hint;
  setQuizProgress(0);

  const body = app.querySelector('#quiz-body');
  body.className = `quiz-body ct-task${task.tone ? ` is-${task.tone}` : ''}`;
  body.innerHTML = `
    ${task.intro ? `<p class="ct-intro">${task.intro}</p>` : ''}
    ${task.layout || ''}
    ${task.link ? `<p class="ct-link"><a class="primary-button" href="${task.link.href}" target="_blank" rel="noopener">${task.link.label} <span aria-hidden="true">↗</span></a></p>` : ''}
    ${task.steps.length ? `<ol class="ct-steps">
      ${task.steps.map((step, stepIndex) => `
        <li class="ct-step">
          <div class="ct-row">
            <button class="ct-check" type="button" aria-pressed="false" aria-label="Krok ${stepIndex + 1} zrobiony">${stepIndex + 1}</button>
            <span class="ct-icon" aria-hidden="true">${step.icon}</span>
            <p class="ct-text">${step.text}</p>
            ${step.help ? `<button class="ct-help-toggle" type="button" aria-expanded="false" aria-controls="ct-help-${stepIndex}" aria-label="Podpowiedź do kroku ${stepIndex + 1}">?</button>` : ''}
          </div>
          ${step.help ? `<div class="ct-help" id="ct-help-${stepIndex}" hidden><span aria-hidden="true">💡</span><div class="ct-help-body">${step.help}</div></div>` : ''}
        </li>`).join('')}
    </ol>` : ''}
    <form class="ct-code" novalidate>
      <label for="ct-code-input">Kod od nauczyciela</label>
      <div class="ct-code-row">
        <input id="ct-code-input" type="text" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="20" placeholder="Wpisz kod" />
        <button class="primary-button" type="submit">Sprawdź</button>
      </div>
      <p class="ct-code-error" role="alert" aria-live="polite"></p>
    </form>
  `;

  // Odhaczanie kroków jest tylko dla ucznia — pasek postępu rośnie, ale zalicza dopiero kod.
  const checks = [...body.querySelectorAll('.ct-check')];
  checks.forEach((check, stepIndex) => check.addEventListener('click', () => {
    const done = check.getAttribute('aria-pressed') !== 'true';
    check.setAttribute('aria-pressed', String(done));
    check.textContent = done ? '✓' : String(stepIndex + 1);
    check.closest('.ct-step').classList.toggle('is-done', done);
    const doneCount = checks.filter((item) => item.getAttribute('aria-pressed') === 'true').length;
    setQuizProgress(doneCount / (checks.length + 1));
  }));

  body.querySelectorAll('.ct-help-toggle').forEach((toggle) => toggle.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    body.querySelector(`#${toggle.getAttribute('aria-controls')}`).hidden = !open;
  }));

  const form = body.querySelector('.ct-code');
  const input = form.querySelector('input');
  const error = form.querySelector('.ct-code-error');
  input.addEventListener('input', () => {
    error.textContent = '';
    form.classList.remove('is-wrong');
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const code = normalizeTaskCode(input.value);
    if (code && isTeacherCodeValid(code)) {
      finishComputerTask(topic, index, task);
      return;
    }

    error.textContent = code
      ? 'To nie jest dobry kod. Sprawdź litery i spróbuj jeszcze raz.'
      : 'Najpierw wpisz kod od nauczyciela.';
    form.classList.remove('is-wrong');
    void form.offsetWidth;
    form.classList.add('is-wrong');
    input.focus();
  });

  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function finishComputerTask(topic, index, task) {
  const earned = Math.max(0, task.reward - readQuizBest(task.id));
  if (earned) {
    saveQuizBest(task.id, task.reward);
    saveStudentPoints(readStudentPoints() + earned);
  }
  completeLesson(topic, index);

  setQuizProgress(1);
  app.querySelector('#quiz-prompt').textContent = 'Brawo, zadanie zaliczone!';
  app.querySelector('#quiz-hint').textContent = task.doneHint || 'Masz swój folder, plik z imieniem i nowe tło pulpitu.';

  const body = app.querySelector('#quiz-body');
  body.className = 'quiz-body quiz-summary';
  body.innerHTML = `
    <div class="summary-icon" aria-hidden="true">🏆</div>
    <div class="summary-stats">
      ${task.steps.length ? `<div><strong>${task.steps.length}</strong><span>zrobionych kroków</span></div>` : ''}
      <div><strong>+${formatPoints(earned)}</strong><span>nowych punktów</span></div>
    </div>
    <div class="summary-actions">
      <a class="primary-button quiz-finish" href="#/sciezka/${topic.slug}">Wróć do ścieżki <span aria-hidden="true">→</span></a>
    </div>
  `;
  syncStudentProfile();
  window.scrollTo({ top: 0, behavior: 'instant' });
}
