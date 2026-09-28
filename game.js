const messages = [
  {
    theme: "postal",
    avatar: "P",
    from: "Poczta Polska",
    address: "powiadomienia@poczta-polska-dostawa.info",
    recipient: "Antoni Nowak",
    time: "dzisiaj, 09:42",
    subject: "Problem z doręczeniem przesyłki nr PL784921603",
    brand: "POCZTA POLSKA",
    eyebrow: "POWIADOMIENIE O PRZESYŁCE",
    headline: "Nie udało się doręczyć Twojej paczki",
    body: [
      "Dzień dobry,",
      "kurier nie mógł dziś doręczyć przesyłki z powodu niepełnych danych adresowych. Aby wybrać nowy termin, ureguluj brakującą opłatę."
    ],
    details: [
      ["Numer przesyłki", "PL784921603"],
      ["Status", "Wstrzymana"],
      ["Do zapłaty", "1,49 zł"]
    ],
    actionLabel: "DOPŁAĆ I WYBIERZ TERMIN",
    link: "poczta24-doplata.info/odbierz",
    signature: ["Dziękujemy,", "Zespół Poczty Polskiej"],
    footer: "Wiadomość automatyczna — prosimy na nią nie odpowiadać.",
    type: "phish",
    clues: [
      { text: "Adres nadawcy nie pasuje do nazwy Poczty Polskiej", correct: true },
      { text: "Link prowadzi do jeszcze innej domeny", correct: true },
      { text: "Niespodziewana prośba o małą dopłatę", correct: true },
      { text: "Wiadomość zawiera numer przesyłki", correct: false }
    ],
    explanation: "Kolory i logo można łatwo skopiować. Adres nadawcy i adres przycisku nie pasują do marki, a mała dopłata ma skłonić do podania danych karty. Status przesyłki sprawdź z dorosłym w oficjalnej aplikacji lub na stronie wpisanej ręcznie."
  },
  {
    theme: "school",
    avatar: "A",
    from: "Pani Asia",
    address: "asia@malafinlandia.pl",
    recipient: "Klasa 4B",
    time: "wczoraj, 14:10",
    subject: "[Plastyka 4B] Materiały na wtorkową lekcję",
    brand: "",
    eyebrow: "",
    headline: "",
    body: [
      "Dzień dobry, klaso!",
      "Przypominam, że jutro na plastykę przynosimy farby plakatowe, pędzel i kubeczek na wodę. Będziemy malować podwodny krajobraz.",
      "Informacja jest też w dzienniku szkolnym."
    ],
    details: [],
    link: "",
    signature: ["Pozdrawiam", "pani Asia"],
    footer: "",
    type: "safe",
    clues: [],
    explanation: "Adres pochodzi ze znanej szkolnej domeny malafinlandia.pl, a treść dotyczy zwykłej lekcji i można ją potwierdzić w e-dzienniku. Nie ma presji ani prośby o prywatne dane."
  },
  {
    theme: "pixel",
    avatar: "PX",
    from: "PixelTown",
    address: "news@pixeltown.pl",
    recipient: "Antoni Nowak",
    time: "pon., 18:03",
    subject: "Aktualizacja 2.6 jest już dostępna",
    brand: "PIXELTOWN",
    eyebrow: "NOWA AKTUALIZACJA",
    headline: "Jesienny Festiwal startuje w piątek!",
    body: [
      "Cześć, Antek!",
      "W wersji 2.6 czekają nowe zadania drużynowe, jesienna mapa i poprawki zgłoszone przez graczy. Aktualizacja pobierze się automatycznie po uruchomieniu gry."
    ],
    details: [],
    actionLabel: "ZOBACZ, CO NOWEGO",
    link: "pixeltown.pl/aktualnosci/2-6",
    signature: ["Do zobaczenia w grze!", "Zespół PixelTown"],
    footer: "Otrzymujesz tę wiadomość, ponieważ włączono aktualności gry na koncie rodzinnym.",
    type: "safe",
    clues: [],
    explanation: "Nazwa i domena nadawcy pasują do adresu przycisku. Wiadomość informuje o aktualizacji, nie żąda hasła ani natychmiastowego działania."
  },
  {
    theme: "library",
    avatar: "B15",
    from: "Biblioteka szkolna",
    address: "biblioteka@sp15.edu.pl",
    recipient: "Antoni Nowak",
    time: "12 wrz, 11:25",
    subject: "Przypomnienie o terminie zwrotu książki",
    brand: "",
    eyebrow: "",
    headline: "",
    body: [
      "Cześć, Antku!",
      "Przypominam, że termin zwrotu książki „Kosmiczne przygody” minął 11 września. Przynieś ją proszę do biblioteki w tym tygodniu.",
      "Jeśli potrzebujesz więcej czasu, podejdź do mnie na długiej przerwie."
    ],
    details: [],
    link: "",
    signature: ["Pozdrawiam", "pani Marta z biblioteki"],
    footer: "",
    type: "safe",
    clues: [],
    explanation: "Nadawca ma szkolny adres, a wiadomość nie prosi o kliknięcie, hasło ani dane. Podaje też bezpieczny sposób kontaktu na żywo."
  },
  {
    theme: "social",
    avatar: "FC",
    from: "Zespół bezpieczeństwa FotoCzat",
    address: "security@fotoczat-alert.net",
    recipient: "Antoni Nowak",
    time: "dzisiaj, 20:17",
    subject: "Pilne: ktoś opublikował Twoje prywatne zdjęcie",
    brand: "FotoCzat",
    eyebrow: "ALERT BEZPIECZEŃSTWA",
    headline: "Wykryliśmy publikację Twojego zdjęcia",
    body: [
      "Cześć, Antek,",
      "nasz system wykrył zdjęcie oznaczone Twoim imieniem. Ze względów bezpieczeństwa podgląd został ukryty.",
      "Potwierdź datę urodzenia i hasło w ciągu 10 minut, aby usunąć publikację. Nie przekazuj tej wiadomości rodzicom — może to opóźnić weryfikację."
    ],
    details: [],
    actionLabel: "SPRAWDŹ I USUŃ ZDJĘCIE",
    link: "fotoczat-weryfikacja.net/ukryte-zdjecie",
    signature: ["Centrum bezpieczeństwa FotoCzat"],
    footer: "Automatyczne powiadomienie dotyczące bezpieczeństwa konta.",
    type: "phish",
    clues: [
      { text: "Straszenie i wywoływanie paniki", correct: true },
      { text: "Prośba o hasło i datę urodzenia", correct: true },
      { text: "Polecenie: „nikomu nie mów”", correct: true },
      { text: "Wiadomość przyszła wieczorem", correct: false }
    ],
    explanation: "Oszust próbuje przestraszyć i odciąć Cię od pomocy. Nie klikaj. Powiedz zaufanej osobie dorosłej i wejdź do aplikacji zwykłą drogą."
  },
  {
    theme: "fortnite",
    avatar: "F",
    from: "Fortnite",
    address: "rewards@fortnite-gifts-event.com",
    recipient: "Antoni Nowak",
    time: "dzisiaj, 21:06",
    subject: "Antek, Twój prezent z wydarzenia czeka 🎁",
    brand: "FORTNITE",
    eyebrow: "LIMITOWANY DROP DLA GRACZA",
    headline: "2 800 V-DOLCÓW CZEKA!",
    body: [
      "Cześć, xAntek_PL!",
      "Twoje konto zostało wybrane do specjalnego dropu po ostatnim wydarzeniu. Nagroda nie została jeszcze przypisana.",
      "Zaloguj się na konto Epic Games w ciągu 30 minut, aby V-dolce nie trafiły do kolejnego gracza."
    ],
    details: [],
    actionLabel: "ODBIERZ V-DOLCE",
    link: "epic-rewards-fortnite.com/claim",
    signature: ["Zespół Fortnite Rewards"],
    footer: "© Epic Games — wiadomość promocyjna. Nie odpowiadaj na ten e-mail.",
    type: "phish",
    clues: [
      { text: "Adres nadawcy nie należy do Epic Games", correct: true },
      { text: "Adres przycisku różni się od adresu nadawcy", correct: true },
      { text: "Darmowa waluta i presja 30 minut", correct: true },
      { text: "Wiadomość zna nick gracza", correct: false }
    ],
    explanation: "To, że wiadomość zna nick i wygląda jak Fortnite, nie dowodzi jej prawdziwości. Adres nadawcy nie należy do Epic Games, a przycisk prowadzi do kolejnej obcej domeny. Nagrodę sprawdź z dorosłym bezpośrednio w grze."
  }
];

const screens = [...document.querySelectorAll("[data-screen]")];
const game = document.querySelector("#game");
const hud = document.querySelector("#hud");
const livesValue = document.querySelector("#livesValue");
const scoreValue = document.querySelector("#scoreValue");
const progressText = document.querySelector("#progressText");
const progressBar = document.querySelector("#progressBar");
const judgeActions = document.querySelector("#judgeActions");
const clueForm = document.querySelector("#clueForm");
const clueOptions = document.querySelector("#clueOptions");
const feedback = document.querySelector("#feedback");
const feedbackModal = document.querySelector("#feedbackModal");
const feedbackIcon = document.querySelector("#feedbackIcon");
const nextButton = document.querySelector("#nextButton");
const questionKicker = document.querySelector("#questionKicker");
const quizTitle = document.querySelector("#quizTitle");
const questionHelp = document.querySelector("#questionHelp");
const toast = document.querySelector("#toast");
const musicButton = document.querySelector("#musicButton");
const mailCard = document.querySelector("#mailCard");
const confetti = document.querySelector("#confetti");

let state = {
  current: 0,
  score: 0,
  lives: 3,
  stage: "judge",
  musicOn: false
};

let audioContext;
let musicTimer;
let musicStep = 0;
let toastTimer;

function showScreen(name) {
  screens.forEach((screen) => {
    const active = screen.dataset.screen === name;
    screen.hidden = !active;
    screen.classList.toggle("is-active", active);
  });
  hud.hidden = name !== "quiz";
  if (name !== "result") confetti.replaceChildren();
  game.focus({ preventScroll: true });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHud(kind) {
  livesValue.textContent = state.lives;
  scoreValue.textContent = state.score;
  if (kind) {
    const target = kind === "score" ? scoreValue.parentElement : livesValue.parentElement;
    target.classList.remove("bump");
    void target.offsetWidth;
    target.classList.add("bump");
  }
}

function showToast(text, kind = "score") {
  window.clearTimeout(toastTimer);
  toast.textContent = text;
  toast.className = `toast toast--${kind} is-visible`;
  toastTimer = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

function addScore(points) {
  state.score += points;
  updateHud("score");
  showToast(`+${points} punktów!`, "score");
  playEffect("good");
}

function loseLife() {
  state.lives = Math.max(0, state.lives - 1);
  updateHud("life");
  document.querySelector(".mail-card").classList.remove("shake");
  void document.querySelector(".mail-card").offsetWidth;
  document.querySelector(".mail-card").classList.add("shake");
  showToast("Tracisz jedno życie", "life");
  playEffect("bad");
}

function renderMessage() {
  const message = messages[state.current];
  state.stage = "judge";
  progressText.textContent = `Wiadomość ${state.current + 1} z ${messages.length}`;
  progressBar.style.width = `${((state.current + 1) / messages.length) * 100}%`;
  mailCard.className = `mail-card mail-card--${message.theme}`;
  document.querySelector("#mailAvatar").textContent = message.avatar;
  document.querySelector("#mailFrom").textContent = message.from;
  document.querySelector("#mailAddress").textContent = `<${message.address}>`;
  document.querySelector("#mailRecipient").textContent = message.recipient;
  document.querySelector("#mailTime").textContent = message.time;
  document.querySelector("#mailSubject").textContent = message.subject;
  const mailBrand = document.querySelector("#mailBrand");
  mailBrand.hidden = !message.brand;
  mailBrand.textContent = message.brand;
  document.querySelector("#mailBody").innerHTML = `
    ${message.eyebrow ? `<p class="mail-eyebrow">${message.eyebrow}</p>` : ""}
    ${message.headline ? `<h3>${message.headline}</h3>` : ""}
    ${message.body.map((paragraph) => `<p>${paragraph}</p>`).join("")}
    ${message.details.length ? `<dl class="mail-details">
      ${message.details.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}
    </dl>` : ""}
  `;
  const mailAction = document.querySelector("#mailAction");
  mailAction.hidden = !message.link;
  document.querySelector("#mailCta").textContent = message.actionLabel || "";
  document.querySelector("#mailLink").textContent = message.link;
  document.querySelector("#mailSignature").innerHTML = message.signature
    .map((line, index) => `<span${index === 1 ? ' class="mail-signature__name"' : ""}>${line}</span>`)
    .join("");
  const mailFooter = document.querySelector("#mailFooter");
  mailFooter.hidden = !message.footer;
  mailFooter.textContent = message.footer;

  questionKicker.textContent = "Twoja decyzja";
  quizTitle.textContent = "Czy ta wiadomość jest bezpieczna?";
  questionHelp.textContent = "Przeczytaj uważnie. Nie musisz klikać w link.";
  judgeActions.hidden = false;
  clueForm.hidden = true;
  feedbackModal.hidden = true;
  clueOptions.innerHTML = "";
  document.querySelector(".decision-card").scrollIntoView({ block: "nearest", behavior: "smooth" });
}

function handleJudgement(choice) {
  if (state.stage !== "judge") return;
  const message = messages[state.current];
  const correct = choice === message.type;
  state.stage = message.type === "phish" && correct ? "clues" : "feedback";
  judgeActions.hidden = true;

  if (correct) {
    addScore(20);
  } else {
    loseLife();
  }

  if (message.type === "phish" && correct) {
    renderClues(message);
    return;
  }

  const title = correct ? "Dobra decyzja! +20" : "Tym razem nie.";
  const copy = correct
    ? message.explanation
    : message.type === "phish"
      ? `Ta wiadomość jest próbą phishingu. ${message.explanation}`
      : `Ta wiadomość jest bezpieczna. ${message.explanation}`;
  showFeedback(correct, title, copy);
}

function renderClues(message) {
  questionKicker.textContent = "Jeszcze jeden krok";
  quizTitle.textContent = "Znajdź czerwone flagi";
  questionHelp.textContent = "Dobra ocena — zdobywasz 20 punktów. Teraz możesz zdobyć 10 punktów bonusu.";
  const clueSubmitButton = clueForm.querySelector('button[type="submit"]');
  clueSubmitButton.hidden = false;
  clueSubmitButton.disabled = false;
  clueOptions.innerHTML = message.clues.map((clue, index) => `
    <label class="clue-option">
      <input type="checkbox" name="clue" value="${index}" />
      <span>${clue.text}</span>
    </label>
  `).join("");
  clueForm.hidden = false;
  clueOptions.querySelector("input")?.focus();
}

function checkClues(event) {
  event.preventDefault();
  if (state.stage !== "clues") return;
  const message = messages[state.current];
  const checked = [...clueForm.querySelectorAll("input:checked")].map((input) => Number(input.value));
  const correctIndices = message.clues.map((clue, index) => clue.correct ? index : -1).filter((index) => index >= 0);
  const exact = checked.length === correctIndices.length && correctIndices.every((index) => checked.includes(index));

  clueForm.querySelectorAll(".clue-option").forEach((label, index) => {
    const selected = label.querySelector("input").checked;
    label.classList.toggle("is-correct", message.clues[index].correct);
    label.classList.toggle("is-wrong", selected && !message.clues[index].correct);
    label.querySelector("input").disabled = true;
  });
  clueForm.querySelector("button").hidden = true;
  state.stage = "feedback";

  if (exact) {
    addScore(10);
    showFeedback(true, "Wszystkie flagi znalezione! +10", message.explanation);
  } else {
    showFeedback(false, "Prawie! Zielone pola pokazują wszystkie sygnały.", message.explanation);
  }
}

function showFeedback(good, title, copy) {
  feedback.className = `feedback feedback--${good ? "good" : "bad"}`;
  feedback.innerHTML = `<strong>${good ? "✓" : "💡"} ${title}</strong><p>${copy}</p>`;
  feedbackIcon.textContent = good ? "✓" : "!";
  nextButton.textContent = state.current === messages.length - 1 || state.lives === 0
    ? "Zobacz wynik →"
    : "Następna wiadomość →";
  feedbackModal.hidden = false;
  nextButton.focus();
}

function nextMessage() {
  if (state.lives === 0 || state.current === messages.length - 1) {
    finishGame();
    return;
  }
  state.current += 1;
  renderMessage();
}

function resetGame() {
  state.current = 0;
  state.score = 0;
  state.lives = 3;
  state.stage = "judge";
  updateHud();
  renderMessage();
}

function finishGame() {
  let best = 0;
  try {
    best = Math.max(Number(localStorage.getItem("cyberRafaBest") || 0), state.score);
    localStorage.setItem("cyberRafaBest", String(best));
  } catch {
    best = state.score;
  }
  document.querySelector("#finalScore").textContent = state.score;
  document.querySelector("#bestScore").textContent = best;
  document.querySelector("#resultMessage").textContent = state.lives === 0
    ? "To był dobry trening. Aksio przypomina: kiedy coś budzi niepokój, zatrzymaj się i poproś dorosłego o pomoc."
    : state.score >= 110
      ? "Masz sokoli wzrok! Rozpoznajesz presję, podejrzane adresy i prośby o prywatne dane."
      : "Dobra robota! Najważniejsza zasada już jest Twoja: zatrzymaj się, sprawdź i poproś dorosłego o pomoc.";
  showScreen("result");
  if (state.lives > 0) launchConfetti();
  playEffect("finish");
}

function launchConfetti() {
  const colors = ["#ffd84d", "#ffffff", "#41d6c3", "#5bc0ff", "#ff8b73", "#b9ff66"];
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < 72; index += 1) {
    const piece = document.createElement("i");
    piece.style.setProperty("--x", `${Math.random() * 100}%`);
    piece.style.setProperty("--y", `${8 + Math.random() * 84}%`);
    piece.style.setProperty("--delay", `${-Math.random() * 5}s`);
    piece.style.setProperty("--duration", `${3.4 + Math.random() * 2.6}s`);
    piece.style.setProperty("--drift", `${-90 + Math.random() * 180}px`);
    piece.style.setProperty("--turn", `${360 + Math.random() * 720}deg`);
    piece.style.setProperty("--confetti-color", colors[index % colors.length]);
    piece.classList.toggle("confetti__piece--round", index % 5 === 0);
    fragment.append(piece);
  }

  confetti.replaceChildren(fragment);
}

function readCurrentScreen() {
  if (!("speechSynthesis" in window)) {
    showToast("Ta przeglądarka nie obsługuje czytania", "life");
    return;
  }
  window.speechSynthesis.cancel();
  const active = document.querySelector(".screen:not([hidden])");
  const text = active?.innerText.replace(/\s+/g, " ").trim();
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = "pl-PL";
  utterance.rate = .92;
  window.speechSynthesis.speak(utterance);
}

function ensureAudio() {
  if (!audioContext) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    audioContext = new AudioCtx();
  }
  if (audioContext.state === "suspended") audioContext.resume();
  return audioContext;
}

function pluck(frequency, duration = .28, volume = .035, delay = 0) {
  const context = ensureAudio();
  if (!context) return;
  const now = context.currentTime + delay;
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, now);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(volume, now + .018);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + .02);
}

function musicTick() {
  const notes = [261.63, 329.63, 392, 329.63, 293.66, 349.23, 440, 349.23];
  pluck(notes[musicStep % notes.length], .42, .018);
  if (musicStep % 2 === 0) pluck(notes[(musicStep + 2) % notes.length] / 2, .55, .012, .04);
  musicStep += 1;
}

function toggleMusic() {
  state.musicOn = !state.musicOn;
  musicButton.setAttribute("aria-pressed", String(state.musicOn));
  musicButton.setAttribute("aria-label", state.musicOn ? "Wyłącz muzykę" : "Włącz muzykę");
  musicButton.title = state.musicOn ? "Muzyka jest włączona" : "Muzyka jest wyłączona";
  if (state.musicOn) {
    musicTick();
    musicTimer = window.setInterval(musicTick, 580);
    showToast("Muzyka włączona", "score");
  } else {
    window.clearInterval(musicTimer);
    showToast("Muzyka wyłączona", "score");
  }
}

function playEffect(type) {
  if (!state.musicOn) return;
  if (type === "good") {
    pluck(523.25, .22, .045);
    pluck(659.25, .28, .04, .12);
  } else if (type === "bad") {
    pluck(196, .32, .04);
    pluck(164.81, .38, .035, .12);
  } else {
    [523.25, 659.25, 783.99].forEach((note, index) => pluck(note, .45, .04, index * .13));
  }
}

document.querySelector("#startButton").addEventListener("click", () => showScreen("map"));
document.querySelector("#phishingMission").addEventListener("click", () => showScreen("lesson"));
document.querySelector("#beginQuizButton").addEventListener("click", () => {
  resetGame();
  showScreen("quiz");
});
document.querySelectorAll("[data-judgement]").forEach((button) => {
  button.addEventListener("click", () => handleJudgement(button.dataset.judgement));
});
clueForm.addEventListener("submit", checkClues);
nextButton.addEventListener("click", nextMessage);
document.querySelector("#playAgainButton").addEventListener("click", () => {
  resetGame();
  showScreen("quiz");
});
document.querySelector("#backToMapButton").addEventListener("click", () => showScreen("map"));
document.querySelector("[data-go-home]").addEventListener("click", () => showScreen("map"));
document.querySelector("#readButton").addEventListener("click", readCurrentScreen);
musicButton.addEventListener("click", toggleMusic);

updateHud();
