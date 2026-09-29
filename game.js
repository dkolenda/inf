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
const photoStage = document.querySelector("#photoStage");
const photoSidebar = document.querySelector("#photoSidebar");
const photoGameGrid = document.querySelector(".photo-game-grid");
const photoProgressText = document.querySelector("#photoProgressText");
const photoProgressBar = document.querySelector("#photoProgressBar");
const photoFeedback = document.querySelector("#photoFeedback");
const photoFeedbackModal = document.querySelector("#photoFeedbackModal");
const photoFeedbackIcon = document.querySelector("#photoFeedbackIcon");
const nextPhotoButton = document.querySelector("#nextPhotoButton");
const photoConfetti = document.querySelector("#photoConfetti");

let state = {
  current: 0,
  score: 0,
  lives: 3,
  stage: "judge",
  musicOn: false
};

let photoState = {
  current: 0,
  answered: false,
  found: new Set(),
  feedbackMode: null,
  caseDecision: null
};

const PHOTO_RISK_TOTAL = 5;

const photoCaseStudies = [
  {
    id: "eye-reflection",
    kicker: "Przypadek 1 z 9 · Odbicie w oku",
    title: "Czy to selfie można opublikować?",
    hint: "Obejrzyj całe zdjęcie, także niewielkie odbicia.",
    type: "case-study",
    image: "assets/photo-case-temp/case_4.png",
    alt: "Selfie piosenkarki Eny Matsuoki z odbiciami widocznymi w oczach",
    decision: "dont-send",
    tools: true,
    metadata: [
      ["Format", "PNG · 1536 × 1024 px"],
      ["Rozmiar", "2,3 MB"],
      ["GPS", "Brak danych GPS"]
    ],
    history: "Japońska piosenkarka Ena Matsuoka opublikowała selfie, w którego oku odbijały się elementy stacji kolejowej. Stalker porównał szczegóły z mapami, ustalił okolicę, a później śledził i zaatakował artystkę.",
    reasons: [
      { text: "Odbicie może zdradzić miejsce", correct: true },
      { text: "Brak GPS gwarantuje anonimowość", correct: false },
      { text: "Małych odbić nie da się powiększyć", correct: false },
      { text: "Selfie zawsze można publikować", correct: false }
    ],
    explanation: "Odbicia w oczach i okularach też są częścią kadru. Przed publikacją obejrzyj zdjęcie w powiększeniu i usuń szczegóły zdradzające miejsce."
  },
  {
    id: "flag-planes",
    kicker: "Przypadek 2 z 9 · Samoloty nad flagą",
    title: "Czy ta transmisja zdradza miejsce?",
    hint: "Zwróć uwagę na niebo i powtarzające się trasy samolotów.",
    type: "case-study",
    image: "assets/photo-case-temp/case_2.png",
    alt: "Flaga He Will Not Divide Us na tle nieba i smug samolotów",
    decision: "dont-send",
    history: "W 2017 r. flagę „He Will Not Divide Us” transmitowano z miejsca, które miało pozostać tajne. Internauci porównali widoczne samoloty i ich smugi z danymi FlightRadar, dzięki czemu zawęzili obszar poszukiwań.",
    reasons: [
      { text: "Trasy samolotów mogą zdradzić miejsce", correct: true },
      { text: "Niebo wygląda wszędzie tak samo", correct: false },
      { text: "Bez GPS nie da się znaleźć miejsca", correct: false },
      { text: "Transmisja na żywo ukrywa czas", correct: false }
    ],
    explanation: "Obraz bez budynków nadal może ujawniać lokalizację. Trasy lotów, pogoda i kierunek światła bywają wystarczającymi wskazówkami."
  },
  {
    id: "safe-landscape",
    kicker: "Przypadek 3 z 9 · Bezpieczny kadr",
    title: "Czy to zdjęcie można wysłać?",
    hint: "Nie każde zdjęcie jest ryzykowne — oceń tylko to, co naprawdę widać.",
    type: "case-study",
    image: "assets/photo-case-temp/case_5.png",
    alt: "Górski krajobraz z drzewami i kwiatami, bez osób oraz dokumentów",
    decision: "send",
    history: "To zdjęcie przedstawia ogólny górski krajobraz bez osób, dokumentów, tablic adresowych ani czytelnych oznaczeń. W pokazanej wersji nie ma widocznego szczegółu, który ujawniałby prywatne dane właściciela.",
    reasons: [
      { text: "Kadr nie pokazuje prywatnych danych", correct: true },
      { text: "Każdy krajobraz jest zawsze bezpieczny", correct: false },
      { text: "Metadanych nigdy nie trzeba sprawdzać", correct: false },
      { text: "Zdjęcie można wysłać każdemu", correct: false }
    ],
    explanation: "Ten kadr można wysłać, jeśli plik nie zawiera wrażliwych metadanych. Bezpieczeństwo polega na uważnej ocenie, a nie na automatycznym odrzucaniu każdego zdjęcia."
  },
  {
    id: "mcafee",
    kicker: "Przypadek 4 z 9 · EXIF i GPS",
    title: "Czy wysłać oryginalny plik?",
    hint: "To, czego nie widać na zdjęciu, może być zapisane w pliku.",
    type: "case-study",
    image: "assets/photo-case-temp/case_5.webp",
    alt: "John McAfee i reporter VICE stojący przed roślinnością",
    decision: "dont-send",
    metadata: [
      ["Aparat", "Apple iPhone 4S"],
      ["Data", "03.12.2012 · 12:26"],
      ["GPS", "15.***, −88.***"]
    ],
    history: "Gdy John McAfee ukrywał się w Ameryce Środkowej, VICE opublikował wykonane iPhonem zdjęcie jego i reportera. Oryginalny plik zawierał współrzędne GPS wskazujące miejsce w Gwatemali.",
    reasons: [
      { text: "Plik zawiera współrzędne GPS", correct: true },
      { text: "Zmiana nazwy usuwa lokalizację", correct: false },
      { text: "Kadrowanie usuwa EXIF", correct: false },
      { text: "GPS działa tylko w mapach", correct: false }
    ],
    explanation: "Nie wysyłaj oryginalnego pliku, dopóki nie sprawdzisz i nie usuniesz metadanych lokalizacji. Samo kadrowanie lub zmiana nazwy zdjęcia nie czyści EXIF."
  },
  {
    id: "raf",
    kicker: "Przypadek 5 z 9 · Tło zdjęcia",
    title: "Czy opublikować zdjęcie z bazy RAF?",
    hint: "Najważniejszy szczegół może znajdować się za fotografowaną osobą.",
    type: "case-study",
    image: "assets/photo-case-temp/case_6.png",
    alt: "Książę William w bazie RAF z kartką z danymi logowania w tle",
    decision: "dont-send",
    history: "Na oficjalnych zdjęciach księcia Williama podczas pracy w RAF-ie w tle znalazły się kartki z danymi dostępowymi oraz ekran z pocztą. Fotografie później usunięto i wyretuszowano, lecz oryginały zdążyły trafić do internetu.",
    reasons: [
      { text: "W tle widać dane logowania", correct: true },
      { text: "Oficjalne zdjęcia są zawsze bezpieczne", correct: false },
      { text: "Małych napisów nie da się odczytać", correct: false },
      { text: "Retusz usuwa wcześniejsze kopie", correct: false }
    ],
    explanation: "Sprawdź cały kadr, zwłaszcza kartki, tablice i ekrany. Po publikacji kopie mogą zostać zapisane, więc późniejszy retusz nie cofa ujawnienia."
  },
  {
    id: "speed-camera",
    kicker: "Przypadek 6 z 9 · Etykieta urządzenia",
    title: "Czy pokazać ten fotoradar?",
    hint: "Naklejki serwisowe mogą zawierać dane dostępowe.",
    type: "case-study",
    image: "assets/photo-case-temp/case_8.jpg",
    alt: "Naklejka na fotoradarze z adresem IP i częściowo zasłoniętymi danymi logowania",
    decision: "dont-send",
    history: "W Polsce opublikowano nagranie fotoradaru straży miejskiej z naklejką serwisową na obudowie. Ze stopklatki można było odczytać adres IP, login i hasło urządzenia.",
    reasons: [
      { text: "Naklejka pokazuje dane logowania", correct: true },
      { text: "Dane na obudowie są bezpieczne", correct: false },
      { text: "Stopklatki nie da się powiększyć", correct: false },
      { text: "Login można publikować bez ryzyka", correct: false }
    ],
    explanation: "Obejrzyj etykiety, kody i naklejki serwisowe. Dane dostępowe nie powinny znajdować się ani publicznie na obudowie, ani w opublikowanym kadrze."
  },
  {
    id: "boarding-pass",
    kicker: "Przypadek 7 z 9 · Dokument podróży",
    title: "Czy opublikować kartę pokładową?",
    hint: "Kod lub numer rezerwacji może być kluczem do dalszych danych.",
    type: "case-study",
    image: "assets/photo-case-temp/case_9.png",
    alt: "Karta pokładowa linii Qantas z kodami i danymi rezerwacji",
    decision: "dont-send",
    history: "Były premier Australii Tony Abbott opublikował zdjęcie dokumentów związanych z lotem. Numer rezerwacji otworzył badaczowi dostęp do rezerwacji Qantas, a dodatkowa podatność ujawniła między innymi dane paszportowe i numer telefonu.",
    reasons: [
      { text: "Numer rezerwacji może ujawnić dane", correct: true },
      { text: "Po locie karta jest bezpieczna", correct: false },
      { text: "Kod kreskowy jest tylko ozdobą", correct: false },
      { text: "Wystarczy zasłonić nazwisko", correct: false }
    ],
    explanation: "Nie publikuj kart pokładowych, etykiet bagażowych ani numerów rezerwacji. Zasłonięcie nazwiska nie wystarcza, jeśli kod nadal pozwala otworzyć rezerwację."
  },
  {
    id: "hawaii",
    kicker: "Przypadek 8 z 9 · Hasło na karteczce",
    title: "Czy opublikować zdjęcie stanowiska?",
    hint: "Sprawdź monitory, identyfikatory i małe notatki.",
    type: "case-study",
    image: "assets/photo-case-temp/case_11.webp",
    alt: "Stanowisko w centrum Hawaii Emergency Management Agency z monitorami i karteczkami",
    decision: "dont-send",
    history: "Na zdjęciu Associated Press z centrum Hawaii Emergency Management Agency przy monitorze była widoczna karteczka z hasłem „Warningpoint2”. Fotografia pozostawała publiczna przez miesiące, choć nie ma dowodu, że to hasło pozwalało zdalnie wysłać alarm rakietowy.",
    reasons: [
      { text: "Na karteczce widać hasło", correct: true },
      { text: "Hasło w tle jest niewidoczne", correct: false },
      { text: "Służbowe zdjęcia są zawsze bezpieczne", correct: false },
      { text: "Małych notatek nie trzeba sprawdzać", correct: false }
    ],
    explanation: "Przed publikacją usuń z kadru hasła i poufne notatki. Trzymaj się faktów: fotografia ujawniła hasło, ale nie dowodziła możliwości zdalnego uruchomienia alarmu."
  },
  {
    id: "flag-stars",
    kicker: "Przypadek 9 z 9 · Gwiazdy nad flagą",
    title: "Czy nocne niebo jest anonimowe?",
    hint: "Układ gwiazd zmienia się zależnie od miejsca, czasu i kierunku.",
    type: "case-study",
    image: "assets/photo-case-temp/case_3.png",
    alt: "Flaga He Will Not Divide Us na tle nocnego nieba i gwiazd",
    decision: "dont-send",
    history: "Po analizie samolotów lokalizacja flagi „He Will Not Divide Us” wciąż nie była dokładna. Użytkownicy wykorzystali więc ruch gwiazd na nocnym niebie, aby wyznaczyć kierunek obserwacji i jeszcze bardziej zawęzić miejsce transmisji.",
    reasons: [
      { text: "Układ gwiazd może zdradzić miejsce", correct: true },
      { text: "Nocne niebo wygląda wszędzie tak samo", correct: false },
      { text: "Czas publikacji niczego nie ujawnia", correct: false },
      { text: "Zdjęcie nocą nie zawiera wskazówek", correct: false }
    ],
    explanation: "Nocne niebo może działać jak mapa i zegar. Jeśli miejsce ma pozostać tajne, ogranicz widok nieba i nie publikuj transmisji na żywo z danymi o czasie."
  }
];

const photoTasks = [
  {
    kicker: "Zadanie 1 · Sprawdź tło",
    title: "Co nie powinno trafić na zdjęcie?",
    hint: "Zaznacz przedmioty, które mogą zdradzić prywatne informacje.",
    type: "hotspots"
  },
  ...photoCaseStudies
];

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
  hud.hidden = !["quiz", "photo-game"].includes(name);
  if (name !== "result") confetti.replaceChildren();
  if (name !== "photo-result") photoConfetti.replaceChildren();
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
  const activeCard = document.querySelector(".screen:not([hidden]) .mail-card, .screen:not([hidden]) .photo-stage");
  activeCard?.classList.remove("shake");
  if (activeCard) void activeCard.offsetWidth;
  activeCard?.classList.add("shake");
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

function launchConfetti(target = confetti) {
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

  target.replaceChildren(fragment);
}

function photoTaskHeader(task) {
  return `
    <header class="photo-task-head">
      <p class="eyebrow">${task.kicker}</p>
      <h1 id="photoTaskTitle" tabindex="-1">${task.title}</h1>
    </header>
  `;
}

function photoChoice(value, icon, title, copy, className = "") {
  return `
    <button class="photo-choice ${className}" type="button" data-photo-answer="${value}">
      <span aria-hidden="true">${icon}</span>
      <strong>${title}</strong>
      <small>${copy}</small>
    </button>
  `;
}

function photoTaskDotsMarkup() {
  return photoTasks.map((item, index) => `
    <span class="${index < photoState.current ? "is-done" : index === photoState.current ? "is-current" : ""}"
      ${index === photoState.current ? 'aria-current="step"' : ""} title="${item.title}">${index < photoState.current ? "✓" : index + 1}</span>
  `).join("");
}

function renderPhotoSidebar(task) {
  const isCaseStudy = task.type === "case-study";
  photoGameGrid.classList.toggle("photo-game-grid--case-study", isCaseStudy);
  photoSidebar.hidden = isCaseStudy;
  photoSidebar.classList.remove("photo-sidecard--tools");

  if (isCaseStudy) {
    photoSidebar.replaceChildren();
    return;
  }

  photoSidebar.innerHTML = `
    <div class="photo-sidecard__mascot" aria-hidden="true"><img src="assets/olek-przewodnik.png" alt="" /></div>
    <p class="eyebrow">Zasada Olka</p>
    <h2>Komu, co i dlaczego?</h2>
    <p>${task.hint}</p>
    <div class="photo-task-dots" aria-label="Dziesięć zadań misji">${photoTaskDotsMarkup()}</div>
    <div class="photo-score-note"><span aria-hidden="true">🔎</span><p>Nie śpiesz się. Bezpieczna decyzja jest ważniejsza niż szybka.</p></div>
  `;
}

function renderPhotoTask() {
  const task = photoTasks[photoState.current];
  photoState.answered = false;
  photoState.found = new Set();
  photoState.feedbackMode = null;
  photoState.caseDecision = null;
  photoFeedbackModal.hidden = true;
  photoProgressText.textContent = `Zadanie ${photoState.current + 1} z ${photoTasks.length}`;
  photoProgressBar.style.width = `${((photoState.current + 1) / photoTasks.length) * 100}%`;

  const renderers = {
    hotspots: renderHotspotTask,
    exif: renderExifTask,
    chat: renderChatTask,
    "case-study": renderCaseStudy
  };
  photoStage.innerHTML = renderers[task.type](task);
  renderPhotoSidebar(task);
  photoStage.querySelector("h1")?.focus({ preventScroll: true });
}

function renderHotspotTask(task) {
  const risks = [
    ["school", 0.5, 42.2, 16.1, 30.7, "54,1 68,9 74,24 86,29 89,40 99,51 95,97 9,100 0,75 6,48 15,39 26,32 33,17 45,8", true, "Plecak ze znakiem szkoły", "Znak lub nazwa szkoły może zdradzić, gdzie się uczysz. Przed publikacją wykadruj plecak albo zamazuj oznaczenie."],
    ["parcel", 0, 70.2, 18, 28.5, "28,1 72,12 100,24 99,81 70,100 0,83 0,19", true, "Paczka z etykietą adresową", "Etykieta może pokazać imię, nazwisko i adres domu. Usuń paczkę z kadru lub dokładnie zamazuj całą etykietę."],
    ["mirror", 19.7, 5.2, 13.5, 54.6, "14,0 91,7 100,97 4,100 0,9", true, "Odbicie w lustrze", "Lustro pokazuje więcej niż planujesz — osoby, ekran albo prywatne rzeczy poza kadrem. Sprawdź każde odbicie przed wysłaniem."],
    ["timetable", 75.7, 1, 10.8, 21.6, "3,8 94,0 100,95 0,100", true, "Plan lekcji", "Plan może ujawnić szkołę, klasę i godziny, w których jesteś poza domem. Zdejmij go lub zamazuj przed zrobieniem zdjęcia."],
    ["badge", 85.8, 24.3, 4.4, 9.5, "12,0 90,8 100,95 0,87", true, "Identyfikator z nazwiskiem", "Nazwisko i identyfikator to dane osobowe. Schowaj identyfikator albo zamazuj go przed udostępnieniem zdjęcia."],
    ["teddy", 51.2, 33.8, 4.3, 6.3, "50,0 70,10 76,23 93,32 100,60 80,100 27,100 0,70 12,35 20,20 34,16", false, "Miś na łóżku", "Miś nie ujawnia w tym kadrze prywatnych danych ani nie stwarza istotnego zagrożenia. Nie trzeba usuwać go ze zdjęcia."],
    ["laptop", 60, 46.7, 29.3, 9.4, "0,21 78,0 92,14 100,67 89,75 22,100 8,89", false, "Laptop", "Zamknięty laptop bez widocznych danych na obudowie nie ujawnia w tym kadrze prywatnych informacji. Nie trzeba usuwać go ze zdjęcia."],
    ["helmet", 19, 54.2, 7.3, 10.7, "20,10 45,0 70,7 91,29 100,55 92,82 70,96 30,100 2,82 0,52 8,26", false, "Kask rowerowy", "Kask rowerowy nie ujawnia w tym kadrze prywatnych danych i nie stwarza istotnego zagrożenia. Nie trzeba usuwać go ze zdjęcia."]
  ];
  return `${photoTaskHeader(task)}
    <p class="photo-task-lead">Zaznacz przedmioty, które należy wykluczyć przed opublikowaniem zdjęcia. Za każdy poprawny wybór otrzymasz <strong>+10 punktów</strong>.</p>
    <div class="risk-workspace">
      <figure class="risk-photo" id="riskPhoto">
        <img src="assets/pokoj-prywatnosc-z-identyfikatorem.png" alt="Pokój uczennicy z biurkiem, tablicą, lustrem, plecakiem, paczką, misiem, laptopem i kaskiem" />
        ${risks.map(([id, x, y, width, height, outline, correct, label, reason]) => `
          <button type="button" class="risk-frame${id === "mirror" ? " risk-frame--label-top" : ""}" data-risk="${id}" data-correct="${correct}" data-label="${label}" data-reason="${reason}" style="--x:${x}%;--y:${y}%;--w:${width}%;--h:${height}%" aria-label="Zaznacz: ${label}" aria-pressed="false">
            <svg class="risk-frame__outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="${outline}"></polygon></svg>
            <span aria-hidden="true">${correct ? "✓" : "×"}</span><b>${label}</b>
          </button>
        `).join("")}
        <span class="risk-lens" id="riskLens" aria-hidden="true"></span>
      </figure>
      <aside class="risk-inspector" aria-label="Narzędzia do sprawdzania zdjęcia">
        <div class="risk-inspector__buttons">
          <button type="button" class="risk-inspector__tool" data-photo-step="toggle-zoom" aria-pressed="false">
            <span aria-hidden="true">⌕</span><strong>LUPA</strong><small>Przybliż fragment</small>
          </button>
          <button type="button" class="risk-inspector__tool risk-inspector__tool--meta" data-photo-step="toggle-meta" aria-expanded="false" aria-controls="riskMetadata">
            <span aria-hidden="true">META</span><strong>Metadane</strong><small>Sprawdź plik</small>
          </button>
        </div>
        <div class="risk-metadata" id="riskMetadata" hidden>
          <div class="risk-metadata__head"><span aria-hidden="true">ⓘ</span><strong>Dane w pliku</strong></div>
          <dl>
            <div><dt>Nazwa</dt><dd>IMG_4821.jpg</dd></div>
            <div><dt>Data</dt><dd>14.09.2026 · 16:42</dd></div>
            <div><dt>Urządzenie</dt><dd>AquaPhone 12</dd></div>
            <div class="is-warning"><dt>GPS</dt><dd>52.***, 21.***</dd></div>
          </dl>
          <p><strong>Uwaga:</strong> GPS też usuń przed publikacją.</p>
        </div>
        <p class="risk-inspector__hint" id="riskToolHint">Włącz lupę i wskaż fragment zdjęcia.</p>
      </aside>
    </div>
    <div class="photo-submit-row">
      <div class="risk-count">
        <p id="riskCounter"><strong>Znaleziono: 0 z ${PHOTO_RISK_TOTAL}</strong></p>
        <p class="risk-status" id="riskStatus" aria-live="polite">Gdy skończysz, sprawdź odpowiedzi.</p>
      </div>
      <button class="primary-button risk-check-button" type="button" data-photo-step="check-risks">Sprawdź <span aria-hidden="true">✓</span></button>
    </div>`;
}

function renderExifTask(task) {
  return `${photoTaskHeader(task)}
    <p class="photo-task-lead">To zwyczajne zdjęcie parku. Sprawdź, co podróżuje razem z oryginalnym plikiem.</p>
    <div class="exif-layout">
      <figure class="file-photo">
        <div class="file-photo__viewport">
          <img src="assets/park-exif.png" alt="Ścieżka, staw i rower w parku" />
          <dl class="metadata-list photo-metadata-overlay" id="exifPanel" aria-label="Metadane zdjęcia" hidden>
            <div><dt>Data wykonania</dt><dd>14.09.2026 · 16:42</dd></div>
            <div><dt>Urządzenie</dt><dd>AquaPhone 12</dd></div>
            <div><dt>Aparat</dt><dd>24 mm · f/1.8 · 1/320 s</dd></div>
            <div class="metadata-list__warning"><dt>Lokalizacja GPS</dt><dd>52.***, 21.***</dd></div>
          </dl>
        </div>
        <figcaption>IMG_2841.jpg <span>oryginalny plik · 4,8 MB</span></figcaption>
      </figure>
      <div class="file-inspector">
        <div class="file-inspector__empty" id="exifEmpty">
          <span aria-hidden="true">📄</span><p>Informacje o pliku są jeszcze zamknięte.</p>
          <button class="secondary-button" type="button" data-photo-step="open-exif" aria-expanded="false" aria-controls="exifPanel">Otwórz informacje</button>
        </div>
      </div>
    </div>
    <div class="photo-actions-panel" id="exifActions" hidden>
      <h2>Co zrobisz przed wysłaniem?</h2>
      <div class="photo-choices photo-choices--four">
        ${photoChoice("exif-original", "📤", "Wyślę oryginał", "Najszybciej")}
        ${photoChoice("exif-location", "📍", "Usunę lokalizację", "GPS nie pojedzie z plikiem")}
        ${photoChoice("exif-copy", "🛡️", "Zrobię bezpieczną kopię", "Usunę metadane i sprawdzę tło", "photo-choice--best")}
        ${photoChoice("exif-cancel", "✋", "Nie udostępnię", "Jeśli wysyłanie nie jest potrzebne")}
      </div>
    </div>`;
}

function renderChatTask(task) {
  return `${photoTaskHeader(task)}
    <div class="chat-scenario">
      <div class="phone-bar"><span>PixelQuest · czat</span><b>online</b></div>
      <div class="chat-bubble chat-bubble--other"><strong>Dragon_Pro99</strong>Hej, też gram w tę grę. Wyślij selfie, żebym wiedział, z kim rozmawiam.</div>
      <div class="chat-bubble chat-bubble--other chat-bubble--pressure">No co? Tylko dla mnie. Nikomu nie mów 🤫</div>
      <div class="chat-warning"><span aria-hidden="true">!</span> Nie znasz tej osoby poza internetem.</div>
    </div>
    <div class="photo-actions-panel">
      <h2>Jak reagujesz?</h2>
      <div class="photo-choices photo-choices--responses">
        ${photoChoice("chat-send", "🤳", "Wyślij", "To tylko jedno selfie")}
        ${photoChoice("chat-refuse", "✋", "Nie wysyłaj", "Odmów i zakończ rozmowę")}
        ${photoChoice("chat-ask", "❓", "Zapytaj, kim jest", "Sama odpowiedź nie potwierdza tożsamości")}
        ${photoChoice("chat-adult", "🧑", "Zapytaj dorosłego", "Pokaż wiadomości zaufanej osobie")}
        ${photoChoice("chat-report", "🛡️", "Zablokuj i zgłoś", "Zachowaj dowód i przerwij kontakt", "photo-choice--best")}
      </div>
    </div>`;
}

function renderCaseStudy(task) {
  const fileName = task.image.split("/").pop();
  const metadata = task.metadata || [
    ["Nazwa pliku", fileName],
    ["Dane EXIF", "Brak w materiale ćwiczeniowym"],
    ["GPS", "Brak zapisanej lokalizacji"]
  ];
  const singleCorrectReason = task.reasons.filter((reason) => reason.correct).length === 1;
  return `${photoTaskHeader(task)}
    <div class="case-study-layout">
      <figure class="case-study-photo">
        <div class="case-study-photo__viewport" id="casePhotoViewport">
          <img src="${task.image}" alt="${task.alt}" loading="lazy" />
          <span class="case-zoom-lens" id="caseZoomLens" aria-hidden="true">
            <img src="${task.image}" alt="" />
          </span>
          <dl class="case-exif-panel photo-metadata-overlay" id="caseExifPanel" aria-label="Metadane zdjęcia" hidden>
            ${metadata.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join("")}
          </dl>
        </div>
        <figcaption>
          <span><b>${fileName}</b><small> materiał do oceny</small></span>
          <span class="case-study-photo__status"><span aria-hidden="true">●</span> Sprawdź przed wysłaniem</span>
        </figcaption>
      </figure>
      <aside class="case-tools case-tools--inline" aria-label="Narzędzia do sprawdzania zdjęcia">
        <button class="case-tool" type="button" data-photo-step="case-zoom" aria-pressed="false">
          <span aria-hidden="true">🔍</span><strong>Powiększ</strong><small>Najedź na zdjęcie</small>
        </button>
        <button class="case-tool" type="button" data-photo-step="case-metadata" aria-pressed="false" aria-expanded="false" aria-controls="caseExifPanel">
          <span class="case-tool__meta" aria-hidden="true">META</span><strong>Metadane</strong><small>Dane pliku</small>
        </button>
        <p class="case-tools__status" id="caseToolStatus" role="status">Wybierz narzędzie do sprawdzenia zdjęcia.</p>
      </aside>
    </div>
    <section class="case-decision" id="caseDecision" aria-labelledby="caseDecisionTitle">
      <div>
        <p class="eyebrow">Twoja decyzja · +20 punktów</p>
        <h2 id="caseDecisionTitle">Czy publikować lub wysłać ten materiał?</h2>
        <p>Zdecyduj na podstawie zdjęcia i informacji zapisanych w pliku.</p>
      </div>
      <div class="case-decision__buttons">
        <button class="case-decision-button case-decision-button--send" type="button" data-case-decision="send">
          <span aria-hidden="true">📤</span><strong>Wyślij</strong><small>Materiał jest bezpieczny</small>
        </button>
        <button class="case-decision-button case-decision-button--stop" type="button" data-case-decision="dont-send">
          <span aria-hidden="true">✋</span><strong>Nie wysyłaj</strong><small>Najpierw zatrzymaj publikację</small>
        </button>
      </div>
      <p class="case-decision__result" id="caseDecisionResult" role="status" aria-live="polite"></p>
    </section>
    <section class="case-reasons${singleCorrectReason ? " case-reasons--single" : ""}" id="caseReasons" aria-labelledby="caseReasonsTitle" hidden>
      <div class="case-reasons__head">
        <div>
          <p class="eyebrow">Runda bonusowa · +10 punktów</p>
          <h2 id="caseReasonsTitle">${task.decision === "send" ? "Dlaczego można wysłać?" : "Dlaczego nie wysyłać?"}</h2>
        </div>
        <span>${singleCorrectReason ? "Wybierz jedną poprawną odpowiedź" : "Zaznacz wszystkie poprawne powody"}</span>
      </div>
      <div class="case-reason-list">
        ${task.reasons.map((reason, index) => `
          <label class="case-reason" data-case-reason-label="${index}">
            <input type="${singleCorrectReason ? "radio" : "checkbox"}"${singleCorrectReason ? ' name="case-reason"' : ""} value="${index}" data-case-reason="${index}" />
            <span class="case-reason__box" aria-hidden="true">${singleCorrectReason ? "●" : "✓"}</span>
            <span>${reason.text}</span>
          </label>
        `).join("")}
      </div>
      <div class="case-reasons__submit">
        <p id="caseReasonStatus" role="status">Wybierz jeden najważniejszy powód.</p>
        <button class="primary-button" type="button" data-photo-step="check-case-reasons">${singleCorrectReason ? "Sprawdź odpowiedź" : "Sprawdź powody"} <span aria-hidden="true">→</span></button>
      </div>
    </section>`;
}

function formatCaseFeedback(task, extra = "") {
  return `<span class="feedback-case-label">Historia przypadku</span>
    <span class="feedback-case-history">${task.history}</span>
    <span class="feedback-case-label">Wniosek</span>
    <span class="feedback-case-tip">${task.explanation}</span>
    ${extra ? `<span class="feedback-case-extra">${extra}</span>` : ""}`;
}

function handleCaseDecision(value) {
  if (photoState.answered || photoState.caseDecision) return;
  const task = photoTasks[photoState.current];
  const buttons = [...photoStage.querySelectorAll("[data-case-decision]")];
  const correctDecision = task.decision || "dont-send";
  const isCorrect = value === correctDecision;
  buttons.forEach((button) => {
    button.disabled = true;
    const selected = button.dataset.caseDecision === value;
    button.classList.toggle("is-selected", selected);
    button.classList.toggle("is-answer-correct", selected && isCorrect);
    button.classList.toggle("is-answer-wrong", selected && !isCorrect);
  });
  photoState.caseDecision = value;

  if (!isCorrect) {
    buttons.find((button) => button.dataset.caseDecision === correctDecision)?.classList.add("is-correct-answer");
    const correctReason = task.reasons.find((reason) => reason.correct)?.text;
    completePhotoTask(
      false,
      0,
      correctDecision === "send" ? "To zdjęcie można wysłać" : "Tego materiału nie należy wysyłać",
      formatCaseFeedback(task, `Poprawna decyzja: <b>${correctDecision === "send" ? "Wyślij" : "Nie wysyłaj"}</b>.${correctReason ? ` Powód: <b>${correctReason}</b>.` : ""}`),
      false
    );
    return;
  }

  addScore(20);
  const result = document.querySelector("#caseDecisionResult");
  const singleCorrectReason = task.reasons.filter((reason) => reason.correct).length === 1;
  if (result) result.innerHTML = `<strong>✓ +20 punktów!</strong> Dobra decyzja — teraz ${singleCorrectReason ? "wybierz poprawną odpowiedź" : "wskaż wszystkie powody"}.`;
  const reasons = document.querySelector("#caseReasons");
  if (reasons) {
    reasons.hidden = false;
    reasons.scrollIntoView({ behavior: "smooth", block: "nearest" });
    reasons.querySelector("input")?.focus({ preventScroll: true });
  }
}

function checkCaseReasons() {
  if (photoState.answered || !photoState.caseDecision) return;
  const task = photoTasks[photoState.current];
  const inputs = [...photoStage.querySelectorAll("[data-case-reason]")];
  const selected = new Set(inputs.filter((input) => input.checked).map((input) => Number(input.value)));
  const correct = new Set(task.reasons.flatMap((reason, index) => reason.correct ? [index] : []));
  const exact = selected.size === correct.size && [...correct].every((index) => selected.has(index));

  inputs.forEach((input) => {
    const index = Number(input.value);
    const label = input.closest(".case-reason");
    input.disabled = true;
    label.classList.toggle("is-correct", correct.has(index));
    label.classList.toggle("is-wrong", selected.has(index) && !correct.has(index));
    label.classList.toggle("is-missed", correct.has(index) && !selected.has(index));
  });

  const correctReasons = task.reasons.filter((reason) => reason.correct).map((reason) => reason.text).join("; ");
  const singleCorrectReason = correct.size === 1;
  completePhotoTask(
    exact,
    exact ? 10 : 0,
    exact
      ? singleCorrectReason ? "Poprawna odpowiedź! +10" : "Wszystkie powody zaznaczone! +10"
      : singleCorrectReason ? "Sprawdź poprawną odpowiedź" : "Decyzja była dobra, ale sprawdź powody",
    formatCaseFeedback(task, `${singleCorrectReason ? "Poprawna odpowiedź" : "Poprawne powody"}: ${correctReasons}.`),
    false,
    exact ? "good" : "warning"
  );
}

function toggleCaseExif(button) {
  const panel = document.querySelector("#caseExifPanel");
  if (!panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  button.classList.toggle("is-active", open);
  button.setAttribute("aria-expanded", String(open));
  if (open) panel.closest(".case-study-photo__viewport")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function setCaseToolMode(mode) {
  const viewport = document.querySelector("#casePhotoViewport");
  if (!viewport) return;
  const panel = document.querySelector("#caseExifPanel");
  const status = document.querySelector("#caseToolStatus");
  const nextMode = viewport.dataset.toolMode === mode ? "preview" : mode;
  const stepForMode = {
    preview: "case-preview",
    metadata: "case-metadata",
    zoom: "case-zoom"
  };

  photoStage.querySelectorAll(".case-tool").forEach((button) => {
    const active = button.dataset.photoStep === stepForMode[nextMode];
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    if (button.dataset.photoStep === "case-metadata") {
      button.setAttribute("aria-expanded", String(active));
    }
  });
  photoSidebar.querySelectorAll(".case-tool").forEach((button) => {
    const active = button.dataset.photoStep === stepForMode[nextMode];
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
    if (button.dataset.photoStep === "case-metadata") {
      button.setAttribute("aria-expanded", String(active));
    }
  });

  viewport.dataset.toolMode = nextMode;
  viewport.classList.toggle("is-zoomed", nextMode === "zoom");
  if (panel) panel.hidden = nextMode !== "metadata";
  if (nextMode === "zoom") {
    const rect = viewport.getBoundingClientRect();
    showCaseZoom(viewport, rect.width / 2, rect.height / 2);
  } else {
    hideCaseZoom();
  }
  if (status) {
    status.textContent = {
      preview: "Wybierz narzędzie do sprawdzenia zdjęcia.",
      metadata: "Metadane pliku są widoczne na zdjęciu",
      zoom: "Najedź na zdjęcie i przesuwaj lupę po szczegółach."
    }[nextMode];
  }
}

function moveCaseZoom(event) {
  const viewport = event.target.closest("#casePhotoViewport.is-zoomed");
  if (!viewport) return;
  const rect = viewport.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  showCaseZoom(viewport, x, y);
}

function showCaseZoom(viewport, x, y) {
  const lens = viewport.querySelector("#caseZoomLens");
  const lensImage = lens?.querySelector("img");
  if (!lens || !lensImage) return;
  const rect = viewport.getBoundingClientRect();
  const radius = lens.offsetWidth / 2;
  const lensX = Math.max(radius, Math.min(rect.width - radius, x));
  const lensY = Math.max(radius, Math.min(rect.height - radius, y));
  const scale = 2.5;

  lens.style.left = `${lensX}px`;
  lens.style.top = `${lensY}px`;
  lensImage.style.width = `${rect.width * scale}px`;
  lensImage.style.height = `${rect.height * scale}px`;
  lensImage.style.left = `${radius - (x * scale)}px`;
  lensImage.style.top = `${radius - (y * scale)}px`;
  lens.classList.add("is-visible");
}

function hideCaseZoom() {
  document.querySelector("#caseZoomLens")?.classList.remove("is-visible");
}

function updateFoundRisks(button) {
  const id = button.dataset.risk;
  if (button.dataset.correct !== "true") {
    showSafeObjectFeedback(button);
    return;
  }
  if (photoState.found.has(id)) return;
  photoState.found.add(id);
  button.classList.remove("is-missed");
  button.classList.add("is-found");
  button.setAttribute("aria-pressed", "true");
  button.setAttribute("aria-label", `Wykluczono: ${button.dataset.label}`);
  const counter = document.querySelector("#riskCounter strong");
  if (counter) counter.textContent = `Znaleziono: ${photoState.found.size} z ${PHOTO_RISK_TOTAL}`;
  const status = document.querySelector("#riskStatus");
  if (status && document.querySelector(".risk-frame.is-missed")) {
    status.textContent = photoState.found.size < PHOTO_RISK_TOTAL
      ? "Czerwone obrysy wskazują pominięte przedmioty."
      : "Wszystkie przedmioty zaznaczone. Kliknij „Sprawdź”.";
  }
  addScore(10);
  showRiskFeedback(button.dataset.label, button.dataset.reason);
}

function showSafeObjectFeedback(button) {
  if (button.classList.contains("is-safe")) return;
  button.classList.add("is-safe");
  button.setAttribute("aria-label", `Bez zagrożenia: ${button.dataset.label}`);
  loseLife();
  photoState.feedbackMode = "risk";
  photoFeedback.className = "feedback feedback--bad";
  photoFeedback.innerHTML = `<strong>To nie jest zagrożenie: ${button.dataset.label}</strong><p>${button.dataset.reason}</p>`;
  photoFeedbackIcon.textContent = "!";
  photoFeedbackIcon.classList.remove("feedback-modal__icon--points");
  nextPhotoButton.innerHTML = state.lives === 0
    ? 'Zobacz wynik <span aria-hidden="true">→</span>'
    : 'Szukam dalej <span aria-hidden="true">→</span>';
  photoFeedbackModal.hidden = false;
  nextPhotoButton.focus();
}

function showRiskFeedback(label, reason) {
  photoState.feedbackMode = "risk";
  photoFeedback.className = "feedback feedback--good";
  photoFeedback.innerHTML = `<strong>✓ +10 punktów! ${label}</strong><p>${reason}</p>`;
  photoFeedbackIcon.textContent = "+10";
  photoFeedbackIcon.classList.add("feedback-modal__icon--points");
  nextPhotoButton.innerHTML = photoState.found.size === PHOTO_RISK_TOTAL
    ? 'Wróć i sprawdź <span aria-hidden="true">→</span>'
    : 'Szukam dalej <span aria-hidden="true">→</span>';
  photoFeedbackModal.hidden = false;
  nextPhotoButton.focus();
}

function checkRisks() {
  const missing = [...photoStage.querySelectorAll('.risk-frame[data-correct="true"]:not(.is-found)')];
  const status = document.querySelector("#riskStatus");
  if (missing.length) {
    loseLife();
    missing.forEach((button) => {
      button.classList.add("is-missed");
      button.setAttribute("aria-label", `Pominięto: ${button.dataset.label}. Zaznacz ten przedmiot.`);
    });
    if (status) status.textContent = "Nie wszystkie zagrożenia są zaznaczone — tracisz 1 życie. Pominięte poprawne odpowiedzi mają czerwony obrys.";
    completePhotoTask(
      false,
      0,
      "Nie znaleziono wszystkich zagrożeń",
      "Pominięte poprawne odpowiedzi zaznaczyliśmy czerwonym obrysem. W kolejnym zadaniu dokładnie obejrzyj cały kadr.",
      false
    );
    return;
  }
  completePhotoTask(
    true,
    0,
    "Wszystkie przedmioty znalezione!",
    "Brawo! Rozpoznajesz konkretne zagrożenia i wiesz, że nie każdy zwykły przedmiot trzeba usuwać ze zdjęcia."
  );
}

function toggleRiskMagnifier(button) {
  const photo = document.querySelector("#riskPhoto");
  if (!photo) return;
  const enabled = !photo.classList.contains("is-magnifier-on");
  photo.classList.toggle("is-magnifier-on", enabled);
  button.classList.toggle("is-active", enabled);
  button.setAttribute("aria-pressed", String(enabled));
  const hint = document.querySelector("#riskToolHint");
  if (hint) hint.textContent = enabled
    ? "Przesuwaj lupę po zdjęciu, aby obejrzeć szczegóły."
    : "Włącz lupę i wskaż fragment zdjęcia.";
  const lens = document.querySelector("#riskLens");
  if (enabled && lens) {
    const rect = photo.getBoundingClientRect();
    lens.style.left = "50%";
    lens.style.top = "50%";
    lens.style.backgroundSize = `${rect.width * 2}px ${rect.height * 2}px`;
    lens.style.backgroundPosition = `${(lens.offsetWidth / 2) - rect.width}px ${(lens.offsetHeight / 2) - rect.height}px`;
    lens.classList.add("is-visible");
  } else {
    lens?.classList.remove("is-visible");
  }
}

function moveRiskMagnifier(event) {
  const photo = event.target.closest("#riskPhoto");
  if (!photo?.classList.contains("is-magnifier-on")) return;
  const lens = photo.querySelector("#riskLens");
  if (!lens) return;
  const rect = photo.getBoundingClientRect();
  const x = Math.max(0, Math.min(rect.width, event.clientX - rect.left));
  const y = Math.max(0, Math.min(rect.height, event.clientY - rect.top));
  lens.style.left = `${x}px`;
  lens.style.top = `${y}px`;
  lens.style.backgroundSize = `${rect.width * 2}px ${rect.height * 2}px`;
  lens.style.backgroundPosition = `${(lens.offsetWidth / 2) - (x * 2)}px ${(lens.offsetHeight / 2) - (y * 2)}px`;
  lens.classList.add("is-visible");
}

function hideRiskMagnifier() {
  document.querySelector("#riskLens")?.classList.remove("is-visible");
}

function handleRiskPointerOut(event) {
  const photo = event.target.closest("#riskPhoto");
  if (photo && !photo.contains(event.relatedTarget)) hideRiskMagnifier();
  const caseViewport = event.target.closest("#casePhotoViewport");
  if (caseViewport && !caseViewport.contains(event.relatedTarget)) hideCaseZoom();
}

function toggleRiskMetadata(button) {
  const panel = document.querySelector("#riskMetadata");
  if (!panel) return;
  const open = panel.hidden;
  panel.hidden = !open;
  button.classList.toggle("is-active", open);
  button.setAttribute("aria-expanded", String(open));
  const hint = document.querySelector("#riskToolHint");
  if (hint) hint.textContent = open
    ? "Metadane są niewidoczne na zdjęciu, ale zapisane w pliku."
    : "Włącz lupę i wskaż fragment zdjęcia.";
}

function revealExif() {
  const empty = document.querySelector("#exifEmpty");
  const panel = document.querySelector("#exifPanel");
  const button = empty.querySelector("button");
  panel.hidden = false;
  empty.classList.add("is-revealed");
  empty.querySelector("span").textContent = "✓";
  empty.querySelector("p").textContent = "Metadane są teraz widoczne na zdjęciu.";
  button.setAttribute("aria-expanded", "true");
  button.hidden = true;
  document.querySelector("#exifActions").hidden = false;
  panel.closest(".file-photo__viewport")?.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function completePhotoTask(good, points, title, copy, loseOnBad = true, feedbackTone = good ? "good" : "bad") {
  if (photoState.answered) return;
  photoState.answered = true;
  photoState.feedbackMode = "complete";
  if (points > 0) addScore(points);
  if (!good && loseOnBad) loseLife();
  photoFeedback.className = `feedback feedback--${feedbackTone}`;
  photoFeedback.innerHTML = `<strong>${good ? "✓" : "💡"} ${title}</strong><p>${copy}</p>`;
  photoFeedbackIcon.textContent = good ? "✓" : "!";
  photoFeedbackIcon.classList.remove("feedback-modal__icon--points");
  nextPhotoButton.innerHTML = photoState.current === photoTasks.length - 1 || state.lives === 0
    ? 'Zobacz wynik <span aria-hidden="true">→</span>'
    : 'Następne zadanie <span aria-hidden="true">→</span>';
  photoFeedbackModal.hidden = false;
  nextPhotoButton.focus();
}

function handlePhotoAnswer(value) {
  const answers = {
    "exif-original": [false, 0, "Oryginał może zdradzać za dużo", "W pliku mogą pozostać data, urządzenie i GPS. Najpierw przygotuj bezpieczną kopię."],
    "exif-location": [true, 20, "Dobra ochrona lokalizacji! +20", "Usunięcie GPS chroni miejsce. Jeszcze lepiej wyczyścić też pozostałe metadane i sprawdzić tło."],
    "exif-copy": [true, 25, "Najbezpieczniejsza wersja! +25", "Kopia bez metadanych, po sprawdzeniu tła, ogranicza kilka ryzyk naraz."],
    "exif-cancel": [true, 15, "Bezpieczna decyzja! +15", "Jeśli zdjęcia nie trzeba wysyłać, rezygnacja jest w porządku."],
    "chat-send": [false, 0, "Nie wysyłaj selfie obcej osobie", "Nie wiesz, kto naprawdę prowadzi konto. Presja i „nikomu nie mów” to czerwone flagi."],
    "chat-refuse": [true, 18, "Dobra granica! +18", "Odmowa jest bezpieczna. Możesz też zablokować konto, zgłosić je i powiedzieć dorosłemu."],
    "chat-ask": [false, 0, "Odpowiedź nie potwierdzi tożsamości", "Obca osoba może napisać cokolwiek. Nie wysyłaj zdjęcia; przerwij kontakt i poproś o pomoc."],
    "chat-adult": [true, 22, "Świetnie, prosisz o pomoc! +22", "Zaufany dorosły pomoże zachować dowód, zablokować konto i zgłosić użytkownika."],
    "chat-report": [true, 25, "Bezpieczna reakcja! +25", "Blokada przerywa kontakt, a zgłoszenie może ochronić też innych. Pokaż wiadomości dorosłemu."]
  };
  const answer = answers[value];
  if (answer) completePhotoTask(...answer);
}

function handlePhotoStageClick(event) {
  if (photoState.answered) return;
  const caseDecision = event.target.closest("[data-case-decision]")?.dataset.caseDecision;
  if (caseDecision) return handleCaseDecision(caseDecision);
  const risk = event.target.closest("[data-risk]");
  if (risk) return updateFoundRisks(risk);
  const step = event.target.closest("[data-photo-step]")?.dataset.photoStep;
  if (step === "check-case-reasons") return checkCaseReasons();
  if (step === "toggle-case-exif") return toggleCaseExif(event.target.closest("[data-photo-step]"));
  if (step === "case-preview") return setCaseToolMode("preview");
  if (step === "case-metadata") return setCaseToolMode("metadata");
  if (step === "case-zoom") return setCaseToolMode("zoom");
  if (step === "check-risks") return checkRisks();
  if (step === "toggle-zoom") return toggleRiskMagnifier(event.target.closest("[data-photo-step]"));
  if (step === "toggle-meta") return toggleRiskMetadata(event.target.closest("[data-photo-step]"));
  if (step === "open-exif") return revealExif();
  const answer = event.target.closest("[data-photo-answer]")?.dataset.photoAnswer;
  if (answer) return handlePhotoAnswer(answer);
}

function resetPhotoGame() {
  state.current = 0;
  state.score = 0;
  state.lives = 3;
  state.stage = "photos";
  photoState.current = 0;
  photoState.caseDecision = null;
  updateHud();
  renderPhotoTask();
}

function nextPhotoTask() {
  if (state.lives === 0 || photoState.current === photoTasks.length - 1) {
    finishPhotoGame();
    return;
  }
  photoState.current += 1;
  renderPhotoTask();
  photoStage.scrollIntoView({ behavior: "smooth", block: "start" });
}

function handlePhotoFeedbackNext() {
  if (photoState.feedbackMode === "risk") {
    photoFeedbackModal.hidden = true;
    photoState.feedbackMode = null;
    if (state.lives === 0) {
      finishPhotoGame();
      return;
    }
    const nextTarget = photoState.found.size === PHOTO_RISK_TOTAL
      ? photoStage.querySelector(".risk-check-button")
      : photoStage.querySelector('.risk-frame[data-correct="true"]:not(.is-found)');
    nextTarget?.focus();
    return;
  }
  nextPhotoTask();
}

function finishPhotoGame() {
  let best = 0;
  try {
    best = Math.max(Number(localStorage.getItem("cyberRafaPhotosBestV4") || 0), state.score);
    localStorage.setItem("cyberRafaPhotosBestV4", String(best));
  } catch {
    best = state.score;
  }
  document.querySelector("#photoFinalScore").textContent = state.score;
  document.querySelector("#photoBestScore").textContent = best;
  document.querySelector("#photoResultMessage").textContent = state.lives === 0
    ? "To był dobry trening. Gdy zdjęcie lub prośba budzi niepokój, zatrzymaj się i pokaż sytuację zaufanej osobie dorosłej."
    : state.score >= 290
      ? "Brawo! Łączysz prawdziwe historie z bezpiecznymi decyzjami jak doświadczony cyberdetektyw."
      : "Dobra robota! Przed wysłaniem sprawdź tło, odbicia, dokumenty i metadane — prawdziwe przypadki pokazują, że każdy szczegół może mieć znaczenie.";
  showScreen("photo-result");
  if (state.lives > 0) launchConfetti(photoConfetti);
  playEffect("finish");
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
document.querySelector("#photosMission").addEventListener("click", () => showScreen("photo-lesson"));
document.querySelector("#beginQuizButton").addEventListener("click", () => {
  resetGame();
  showScreen("quiz");
});
document.querySelectorAll("[data-judgement]").forEach((button) => {
  button.addEventListener("click", () => handleJudgement(button.dataset.judgement));
});
clueForm.addEventListener("submit", checkClues);
nextButton.addEventListener("click", nextMessage);
document.querySelector("#beginPhotoButton").addEventListener("click", () => {
  resetPhotoGame();
  showScreen("photo-game");
});
photoStage.addEventListener("click", handlePhotoStageClick);
photoSidebar.addEventListener("click", handlePhotoStageClick);
photoStage.addEventListener("pointermove", moveRiskMagnifier);
photoStage.addEventListener("pointermove", moveCaseZoom);
photoStage.addEventListener("pointerdown", moveRiskMagnifier);
photoStage.addEventListener("pointerdown", moveCaseZoom);
photoStage.addEventListener("pointerout", handleRiskPointerOut);
photoStage.addEventListener("pointerleave", () => {
  hideRiskMagnifier();
  hideCaseZoom();
});
nextPhotoButton.addEventListener("click", handlePhotoFeedbackNext);
document.querySelector("#photoPlayAgainButton").addEventListener("click", () => {
  resetPhotoGame();
  showScreen("photo-game");
});
document.querySelector("#photoBackToMapButton").addEventListener("click", () => showScreen("map"));
document.querySelector("#playAgainButton").addEventListener("click", () => {
  resetGame();
  showScreen("quiz");
});
document.querySelector("#backToMapButton").addEventListener("click", () => showScreen("map"));
document.querySelector("[data-go-home]").addEventListener("click", () => showScreen("map"));
document.querySelector("#readButton").addEventListener("click", readCurrentScreen);
musicButton.addEventListener("click", toggleMusic);

updateHud();
