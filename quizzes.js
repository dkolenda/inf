// Quiz data. Each question is either:
// - 'buckets': sort items into groups (match: true = one item per group, used for term ↔ definition),
// - 'choices': pick one option for every row (yes/no, true/false).
//   An item's optional `partial` option is an incomplete answer worth half a point.
// Devices without a fitting emoji get inline SVG icons. 'choices' items may have an 'image' (photo shown next to the row).
const scannerIcon = '<svg viewBox="0 0 24 24"><path d="M4 9 7 3h14l-1 6z" fill="#90a4ae"/><rect x="2" y="9" width="20" height="11" rx="2" fill="#cfd8dc" stroke="#546e7a" stroke-width="1.2"/><rect x="4" y="11" width="16" height="3" rx="1" fill="#80deea"/><rect x="4" y="12" width="16" height="1" fill="#00c853"/><circle cx="18.5" cy="17" r="1" fill="#43a047"/></svg>';
const pendriveIcon = '<svg viewBox="0 0 24 24"><g transform="rotate(-45 12 12)"><rect x="8" y="1.5" width="8" height="7" rx="0.8" fill="#cfd8dc" stroke="#78909c"/><rect x="9.8" y="3.5" width="1.6" height="1.6" fill="#546e7a"/><rect x="12.6" y="3.5" width="1.6" height="1.6" fill="#546e7a"/><rect x="6.5" y="8" width="11" height="14" rx="2.5" fill="#1e88e5"/><rect x="9" y="16" width="6" height="3" rx="1" fill="#90caf9"/></g></svg>';

// Ikony plików podobne do tych z Eksploratora Windows: kartka + kolorowa plakietka.
const filePage = '<path d="M5 1.5h10l5 5v16H5z" fill="#fff" stroke="#9e9e9e"/><path d="M15 1.5v5h5" fill="#e0e0e0" stroke="#9e9e9e" stroke-linejoin="round"/>';
const fileLines = '<path d="M8 10h9M8 13h9M8 16h9M8 19h6" stroke="#90a4ae" stroke-width="1.2"/>';
const badgeIcon = (color, letter) => `<svg viewBox="0 0 24 24">${filePage}${fileLines}<rect x="1" y="9" width="12" height="12" rx="2" fill="${color}"/><text x="7" y="18.6" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="9.5" font-weight="700" fill="#fff">${letter}</text></svg>`;
const odfIcon = (color) => `<svg viewBox="0 0 24 24"><path d="M5 1.5h10l5 5v16H5z" fill="${color}"/><path d="M15 1.5v5h5z" fill="#fff" opacity=".55"/><path d="M8 11h9M8 14h9M8 17h6" stroke="#fff" stroke-width="1.4"/></svg>`;
const fileIcons = {
  txt: `<svg viewBox="0 0 24 24">${filePage}${fileLines}</svg>`,
  docx: badgeIcon('#185abd', 'W'),
  odt: odfIcon('#2a6ec7'),
  image: `<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="2" fill="#e3f2fd" stroke="#1e88e5" stroke-width="1.2"/><circle cx="16.5" cy="8.5" r="2" fill="#fbc02d"/><path d="M3 19l6-7 4 4.5 2.5-2.5L21 19z" fill="#43a047"/></svg>`,
  exe: `<svg viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="1.5" fill="#fff" stroke="#607d8b" stroke-width="1.2"/><rect x="2" y="4" width="20" height="4" rx="1.5" fill="#1e88e5"/><rect x="5" y="10.5" width="6" height="6.5" fill="#bbdefb"/><path d="M13 11h6M13 14h6M13 17h4" stroke="#90a4ae" stroke-width="1.2"/></svg>`,
  msi: `<svg viewBox="0 0 24 24"><path d="M3 9l9-4 9 4v10l-9 4-9-4z" fill="#d7a35f" stroke="#8d6e3f"/><path d="M3 9l9 4 9-4M12 13v10" fill="none" stroke="#8d6e3f"/><circle cx="12" cy="6" r="5" fill="#eceff1" stroke="#78909c"/><circle cx="12" cy="6" r="1.4" fill="#78909c"/></svg>`,
  html: `<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#1e88e5"/><path d="M2 12h20M12 2c-3.5 3-3.5 17 0 20M12 2c3.5 3 3.5 17 0 20M4 7h16M4 17h16" fill="none" stroke="#e3f2fd" stroke-width="1.1"/></svg>`,
  css: badgeIcon('#7b1fa2', '#'),
  js: `<svg viewBox="0 0 24 24">${filePage}${fileLines}<rect x="1" y="9" width="12" height="12" rx="2" fill="#f7df1e"/><text x="7" y="18.3" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="7" font-weight="700" fill="#222">JS</text></svg>`,
  xlsx: badgeIcon('#107c41', 'X'),
  ods: odfIcon('#1e9e4a'),
  pptx: badgeIcon('#c43e1c', 'P'),
  odp: odfIcon('#e8730c'),
  folder: `<svg viewBox="0 0 24 24"><path d="M2 5.5A1.5 1.5 0 0 1 3.5 4H9l2 2.5h9.5A1.5 1.5 0 0 1 22 8v10.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#e8a317"/><path d="M2 9h20v9.5a1.5 1.5 0 0 1-1.5 1.5h-17A1.5 1.5 0 0 1 2 18.5z" fill="#ffc83d"/></svg>`
};

const computerBasicsQuiz = {
  // Stały klucz najlepszego wyniku — quiz był wcześniej zadaniem 1 (indeks 0).
  id: 'praca-na-komputerze/0',
  title: 'Quiz: Poznajemy komputer',
  questions: [
    {
      type: 'buckets',
      label: 'A',
      rewardGif: 'assets/reward-gifs/music-headphones.gif',
      prompt: 'Jakim urządzeniem jest każdy z tych sprzętów?',
      hint: 'Kliknij urządzenie, a potem grupę — albo przeciągnij je myszą. Kliknij umieszczone urządzenie, aby je cofnąć.',
      buckets: [
        { id: 'in', label: 'Urządzenia wejścia', note: 'wprowadzają dane do komputera' },
        { id: 'out', label: 'Urządzenia wyjścia', note: 'wyprowadzają dane z komputera' },
        { id: 'io', label: 'Urządzenia wejścia-wyjścia', note: 'wprowadzają i wyprowadzają dane' }
      ],
      items: [
        { text: 'Klawiatura', icon: '⌨️', answer: 'in' },
        { text: 'Mysz', icon: '🖱️', answer: 'in' },
        { text: 'Mikrofon', icon: '🎤', answer: 'in' },
        { text: 'Kamera', icon: '📷', answer: 'in' },
        { text: 'Skaner', icon: scannerIcon, answer: 'in' },
        { text: 'Monitor', icon: '🖥️', answer: 'out' },
        { text: 'Drukarka', icon: '🖨️', answer: 'out' },
        { text: 'Słuchawki', icon: '🎧', answer: 'out' },
        { text: 'Urządzenie wielofunkcyjne (drukarka ze skanerem)', icon: '🖨️' + scannerIcon, answer: 'io' },
        { text: 'Pendrive', icon: pendriveIcon, answer: 'io' }
      ]
    },
    {
      type: 'choices',
      label: 'B',
      rewardGif: 'assets/reward-gifs/hush-minecraft-dimans.gif',
      prompt: 'Czy to jest komputer osobisty?',
      hint: 'Przy każdym urządzeniu wybierz „Tak” albo „Nie”.',
      options: [
        { id: 'yes', label: 'Tak' },
        { id: 'no', label: 'Nie' }
      ],
      items: [
        { text: 'Laptop', image: 'assets/pc-quiz/laptop.jpg', answer: 'yes' },
        { text: 'Smartfon', image: 'assets/pc-quiz/smartfon.jpg', answer: 'yes' },
        { text: 'Smartwatch', image: 'assets/pc-quiz/smartwatch.jpg', answer: 'yes', explain: 'To mały komputer noszony na nadgarstku przez jedną osobę.' },
        { text: 'PlayStation', image: 'assets/pc-quiz/playstation.png', answer: 'yes', partial: 'no', explain: 'Konsola do gier też jest komputerem osobistym — ma procesor, pamięć i system, a korzysta z niej jedna osoba.' },
        { text: 'Komputer typu wieża', image: 'assets/pc-quiz/wieza.jpg', answer: 'yes' },
        { text: 'Router', image: 'assets/pc-quiz/router.jpg', answer: 'no', explain: 'Router łączy urządzenia z siecią i internetem.' },
        { text: 'Gogle VR (Oculus)', image: 'assets/pc-quiz/gogle-vr.jpg', answer: 'yes', partial: 'no', explain: 'Gogle Oculus mają własny procesor i system — działają jak konsola do gier, którą zakłada się na głowę.' },
        { text: 'Monitor dotykowy', image: 'assets/pc-quiz/monitor.png', answer: 'no', explain: 'To urządzenie wejścia-wyjścia podłączane do komputera.' }
      ]
    },
    {
      type: 'choices',
      label: 'C',
      rewardGif: 'assets/reward-gifs/cat-respect.gif',
      prompt: 'Prawda czy fałsz?',
      hint: 'Przeczytaj uważnie każde zdanie.',
      shuffle: false,
      art: {
        image: 'assets/quiz-art/profesor.svg',
        alt: 'Zakłopotany profesor drapie się po głowie.',
        bubbles: [
          { text: 'Prawda?', tone: 'good' },
          { text: 'Fałsz?!', tone: 'bad' },
          { text: 'A może jednak…', tone: 'maybe' }
        ],
        caption: 'Nawet profesor musi czasem pomyśleć dwa razy.'
      },
      options: [
        { id: 'true', label: 'Prawda' },
        { id: 'false', label: 'Fałsz' }
      ],
      items: [
        {
          text: 'Tylko niektóre smartfony są komputerem osobistym.',
          answer: 'false',
          explain: 'Każdy smartfon jest komputerem osobistym.'
        },
        {
          text: 'Kamera podłączona do komputera stacjonarnego jest urządzeniem wejścia-wyjścia.',
          answer: 'false',
          explain: 'Kamera tylko wprowadza obraz do komputera, więc jest urządzeniem wejścia.'
        },
        {
          text: 'Pendrive jest urządzeniem wejścia-wyjścia, ponieważ umożliwia przenoszenie, przechowywanie i udostępnianie danych.',
          answer: 'true',
          explain: 'Na pendrive można zapisywać dane i odczytywać je z niego.'
        }
      ]
    },
    {
      type: 'buckets',
      label: 'D',
      rewardGif: 'assets/reward-gifs/despicable-me-minion.gif',
      prompt: 'Dopasuj pliki do ich typu.',
      hint: 'Patrz na rozszerzenie — to końcówka nazwy po kropce. Folder nie ma rozszerzenia.',
      mono: true,
      buckets: [
        { id: 'text', label: 'Pliki tekstowe' },
        { id: 'image', label: 'Pliki graficzne' },
        { id: 'program', label: 'Programy' },
        { id: 'web', label: 'Strony internetowe' },
        { id: 'sheet', label: 'Arkusze kalkulacyjne' },
        { id: 'slides', label: 'Prezentacje' },
        { id: 'folder', label: 'Foldery' }
      ],
      items: [
        { text: 'notatki.txt', icon: fileIcons.txt, answer: 'text' },
        { text: 'wypracowanie.docx', icon: fileIcons.docx, answer: 'text' },
        { text: 'opowiadanie.odt', icon: fileIcons.odt, answer: 'text' },
        { text: 'wakacje.jpg', icon: fileIcons.image, answer: 'image' },
        { text: 'logo.png', icon: fileIcons.image, answer: 'image' },
        { text: 'animacja.gif', icon: fileIcons.image, answer: 'image' },
        { text: 'gra.exe', icon: fileIcons.exe, answer: 'program' },
        { text: 'instalator.msi', icon: fileIcons.msi, answer: 'program' },
        { text: 'index.html', icon: fileIcons.html, answer: 'web' },
        { text: 'style.css', icon: fileIcons.css, answer: 'web' },
        { text: 'skrypt.js', icon: fileIcons.js, answer: 'web' },
        { text: 'oceny.xlsx', icon: fileIcons.xlsx, answer: 'sheet' },
        { text: 'budzet.ods', icon: fileIcons.ods, answer: 'sheet' },
        { text: 'referat.pptx', icon: fileIcons.pptx, answer: 'slides' },
        { text: 'projekt.odp', icon: fileIcons.odp, answer: 'slides' },
        { text: 'Zdjęcia', icon: fileIcons.folder, answer: 'folder' },
        { text: 'Szkoła', icon: fileIcons.folder, answer: 'folder' }
      ]
    },
    {
      type: 'buckets',
      label: 'E',
      rewardGif: 'assets/reward-gifs/pikachu-clap.gif',
      match: true,
      prompt: 'Dopasuj hasło do definicji.',
      hint: 'Kliknij hasło, a potem pole obok pasującej definicji.',
      buckets: [
        { id: 'desktop', label: 'Główny ekran systemu, który widzisz po uruchomieniu komputera. Leżą na nim ikony i otwierają się okna.' },
        { id: 'taskbar', label: 'Pasek na dole ekranu z przyciskiem Start, ikonami otwartych programów i zegarem.' },
        { id: 'icon', label: 'Mały obrazek, który oznacza program, plik lub folder.' },
        { id: 'folder', label: 'Miejsce, w którym porządkujemy pliki i inne foldery.' },
        { id: 'file', label: 'Zapisane dane, np. tekst, zdjęcie lub program, które mają nazwę i rozszerzenie.' },
        { id: 'start', label: 'Przycisk w systemie Windows, który otwiera menu z listą programów i ustawieniami.' },
        { id: 'pendrive', label: 'Przenośna pamięć podłączana do portu USB, służąca do przenoszenia danych.' }
      ],
      items: [
        { text: 'Pulpit', answer: 'desktop' },
        { text: 'Pasek zadań', answer: 'taskbar' },
        { text: 'Ikona', answer: 'icon' },
        { text: 'Folder', answer: 'folder' },
        { text: 'Plik', answer: 'file' },
        { text: 'Start', answer: 'start' },
        { text: 'Pendrive', answer: 'pendrive' }
      ]
    }
  ]
};

// Spokojne wprowadzenie do gry „Format pliku”: te same grupy, ale bez pośpiechu i z opisami.
const fileTypesIntroQuiz = {
  id: 'praca-na-komputerze/typy-plikow',
  title: 'Jakie to pliki?',
  questions: [
    {
      type: 'buckets',
      label: 'A',
      prompt: 'Dopasuj pliki do kategorii.',
      hint: 'Każdy plik ma nazwę i rozszerzenie — to końcówka po kropce, np. w „kot.jpg” rozszerzenie to „jpg”. Po rozszerzeniu poznasz, co jest w pliku. Pod nazwą każdej grupy masz podpowiedź.',
      mono: true,
      buckets: [
        { id: 'text', label: 'Pliki tekstowe', note: 'coś napisanego: .txt .docx .odt .rtf' },
        { id: 'image', label: 'Grafika', note: 'zdjęcia i obrazki: .jpg .png .gif .bmp' },
        { id: 'sheet', label: 'Arkusze kalkulacyjne', note: 'tabelki z liczbami: .xlsx .xls .ods' },
        { id: 'program', label: 'Programy', note: 'coś, co się uruchamia: .exe .msi .apk' },
        { id: 'none', label: 'Inne pliki', note: 'muzyka, filmy, paczki, prezentacje: .mp3 .mp4 .zip .pptx — w grze przepuść je dalej' }
      ],
      items: [
        { text: 'notatki.txt', icon: fileIcons.txt, answer: 'text' },
        { text: 'zaproszenie.docx', icon: fileIcons.docx, answer: 'text' },
        { text: 'wiersz.odt', icon: fileIcons.odt, answer: 'text' },
        { text: 'kot.jpg', icon: fileIcons.image, answer: 'image' },
        { text: 'rysunek.png', icon: fileIcons.image, answer: 'image' },
        { text: 'animacja.gif', icon: fileIcons.image, answer: 'image' },
        { text: 'oceny.xlsx', icon: fileIcons.xlsx, answer: 'sheet' },
        { text: 'budzet.ods', icon: fileIcons.ods, answer: 'sheet' },
        { text: 'gra.exe', icon: fileIcons.exe, answer: 'program' },
        { text: 'instalator.msi', icon: fileIcons.msi, answer: 'program' },
        { text: 'piosenka.mp3', icon: badgeIcon('#e91e63', '♪'), answer: 'none' },
        { text: 'film.mp4', icon: badgeIcon('#d32f2f', '▶'), answer: 'none' }
      ]
    }
  ]
};

// Gra zręcznościowa: pliki jadą po taśmie, gracz wysyła je klawiszami W/A/S/D do właściwej strefy.
const fileSortGame = {
  type: 'game',
  id: 'praca-na-komputerze/gra-format-pliku',
  title: 'Gra: Format pliku',
  prompt: 'Dopasuj format pliku do typu',
  goal: 100,
  pointsPerFile: 10,
  hideIconsAt: 60,
  reward: 40,
  lives: 3,
  // Od tylu punktów pojawiają się pliki, które nie pasują do żadnej strefy — trzeba je przepuścić.
  distractorsAt: 50,
  zones: [
    { id: 'text', key: 'W', label: 'Plik tekstowy', icon: fileIcons.docx, color: '#1e6fd9', soft: '#e6f0fd' },
    { id: 'image', key: 'A', label: 'Grafika', icon: fileIcons.image, color: '#9c27b0', soft: '#f6e8f9' },
    { id: 'sheet', key: 'S', label: 'Arkusz kalkulacyjny', icon: fileIcons.xlsx, color: '#107c41', soft: '#e3f5ea' },
    { id: 'program', key: 'D', label: 'Program', icon: fileIcons.exe, color: '#e8710a', soft: '#fdf0e3' }
  ],
  files: [
    { ext: 'txt', type: 'text', icon: fileIcons.txt, names: ['notatki', 'lista-zakupow', 'przepis'] },
    { ext: 'docx', type: 'text', icon: fileIcons.docx, names: ['wypracowanie', 'zaproszenie', 'list'] },
    { ext: 'odt', type: 'text', icon: fileIcons.odt, names: ['opowiadanie', 'referat', 'wiersz'] },
    { ext: 'rtf', type: 'text', icon: fileIcons.txt, names: ['dyktando', 'ogloszenie'] },
    { ext: 'jpg', type: 'image', icon: fileIcons.image, names: ['wakacje', 'kot', 'gory'] },
    { ext: 'png', type: 'image', icon: fileIcons.image, names: ['logo', 'rysunek', 'mapa'] },
    { ext: 'gif', type: 'image', icon: fileIcons.image, names: ['animacja', 'smieszny-pies'] },
    { ext: 'bmp', type: 'image', icon: fileIcons.image, names: ['obrazek', 'tapeta'] },
    { ext: 'xlsx', type: 'sheet', icon: fileIcons.xlsx, names: ['oceny', 'wydatki', 'plan-lekcji'] },
    { ext: 'ods', type: 'sheet', icon: fileIcons.ods, names: ['budzet', 'wyniki-meczow'] },
    { ext: 'xls', type: 'sheet', icon: fileIcons.xlsx, names: ['tabela', 'pomiary'] },
    { ext: 'numbers', type: 'sheet', icon: badgeIcon('#1fa463', 'N'), names: ['frekwencja', 'kieszonkowe'] },
    { ext: 'exe', type: 'program', icon: fileIcons.exe, names: ['gra', 'kalkulator', 'paint'] },
    { ext: 'msi', type: 'program', icon: fileIcons.msi, names: ['instalator', 'setup'] },
    { ext: 'apk', type: 'program', icon: badgeIcon('#3ddc84', 'A'), names: ['aplikacja', 'gra-mobilna'] },
    { ext: 'app', type: 'program', icon: fileIcons.exe, names: ['notatnik', 'przegladarka'] },
    // Formaty spoza stref (type: 'none'): dźwięk, film, archiwum, prezentacja.
    { ext: 'mp3', type: 'none', icon: badgeIcon('#e91e63', '♪'), names: ['piosenka', 'dzwonek'] },
    { ext: 'mp4', type: 'none', icon: badgeIcon('#d32f2f', '▶'), names: ['film', 'teledysk'] },
    { ext: 'zip', type: 'none', icon: badgeIcon('#8d6e63', 'Z'), names: ['archiwum', 'paczka'] },
    { ext: 'pptx', type: 'none', icon: fileIcons.pptx, names: ['referat', 'prezentacja'] }
  ]
};

// Zadanie praktyczne: uczeń robi kroki na swoim komputerze, a nauczyciel po sprawdzeniu podaje kod.
// Kod zależy od godziny i daty (teacher-code.js), nauczyciel odczytuje go z ukrytej strony.
const desktopFolderTask = {
  type: 'task',
  id: 'praca-na-komputerze/zadanie-folder-tlo',
  title: 'Praca na komputerze',
  prompt: 'Folder, plik i nowe tło pulpitu',
  hint: 'Rób kroki po kolei. Nie wiesz jak? Kliknij znak zapytania.',
  reward: 30,
  steps: [
    {
      icon: '📁',
      text: 'Na pulpicie zrób folder <b>zadanie3</b>.',
      help: 'Kliknij <b>prawym</b> przyciskiem myszy w puste miejsce na pulpicie. Wybierz <b>Nowy → Folder</b>. Wpisz nazwę <b>zadanie3</b> i wciśnij <kbd>Enter</kbd>.'
    },
    {
      icon: '📄',
      text: 'W tym folderze zrób <b>plik tekstowy</b>.',
      help: 'Otwórz folder <b>zadanie3</b> (kliknij go dwa razy). Kliknij <b>prawym</b> przyciskiem w puste miejsce. Wybierz <b>Nowy → Dokument tekstowy</b>. Nazwij go np. <b>imie</b>.'
    },
    {
      icon: '✍️',
      text: 'Wpisz w pliku <b>swoje imię</b> i zapisz.',
      help: 'Kliknij plik dwa razy — otworzy się Notatnik. Wpisz swoje imię. Zapisz skrótem <kbd>Ctrl</kbd> + <kbd>S</kbd> i zamknij okno.'
    },
    {
      icon: '🌐',
      text: 'Znajdź w internecie <b>dowolne zdjęcie</b>.',
      help: 'Otwórz przeglądarkę. Wpisz w wyszukiwarkę np. <b>kot</b> albo <b>góry</b>. Kliknij <b>Grafika</b> lub <b>Obrazy</b> i wybierz zdjęcie, które Ci się podoba.'
    },
    {
      icon: '💾',
      text: 'Zapisz zdjęcie w folderze <b>zadanie3</b>.',
      help: 'Kliknij zdjęcie <b>prawym</b> przyciskiem. Wybierz <b>Zapisz obraz jako…</b>. Po lewej kliknij <b>Pulpit</b>, potem otwórz folder <b>zadanie3</b> i kliknij <b>Zapisz</b>.'
    },
    {
      icon: '🖼️',
      text: 'Ustaw to zdjęcie jako <b>tło pulpitu</b>.',
      help: 'Otwórz folder <b>zadanie3</b>. Kliknij zdjęcie <b>prawym</b> przyciskiem i wybierz <b>Ustaw jako tło pulpitu</b>. Nie widzisz tej opcji? Kliknij najpierw <b>Pokaż więcej opcji</b>.'
    },
    {
      icon: '🙋',
      text: 'Zgłoś się do nauczyciela. Dostaniesz <b>kod</b>.',
      help: 'Podnieś rękę i poczekaj. Nauczyciel sprawdzi Twój folder i tło pulpitu, a potem poda Ci kod. Wpisz go w pole poniżej.'
    }
  ]
};

// Quiz „Dokumenty tekstowe”: klawiatura, polskie litery i skróty klawiszowe.
// 'keyboard': klawiatura z pustymi miejscami (slot) — działa jak dopasowanie, każdy klawisz pasuje do jednego miejsca.
//   Klawisz to napis albo { label, w (szerokość), slot }. Klawisze bez napisu są puste, żeby nie zdradzać odpowiedzi.
// 'inputs': uczeń wpisuje tekst w pole; `value` to tekst wpisany na start. Wielkość liter ma znaczenie.
// 'practice': para pól — lewe pełne, prawe puste; kind mówi, co trzeba zrobić:
//   copy — skopiuj i wklej, cut — wytnij i wklej, clear — zaznacz wszystko i usuń, tab — przejdź Tabem do zasłoniętego pola.
const keyboardShortcutsQuiz = {
  id: 'dokumenty-tekstowe/quiz-klawiatura',
  title: 'Quiz: Klawiatura i skróty',
  questions: [
    {
      type: 'keyboard',
      label: 'A',
      rewardGif: 'assets/reward-gifs/cat-dance-cat.gif',
      match: true,
      prompt: 'Wstaw brakujące klawisze na klawiaturze.',
      hint: 'Przeciągnij klawisz na puste miejsce — albo kliknij klawisz, a potem puste miejsce. Kliknij wstawiony klawisz, aby go cofnąć.',
      keyboard: [
        [{ slot: 'esc' }, { w: 0.5, gap: true }, 'F1', 'F2', 'F3', 'F4', { w: 0.5, gap: true }, 'F5', 'F6', 'F7', 'F8', { w: 0.5, gap: true }, 'F9', 'F10', 'F11', 'F12'],
        ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', { slot: 'backspace', w: 2 }],
        [{ slot: 'tab', w: 1.5 }, 'Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', { label: '\\', w: 1.5 }],
        [{ label: 'Caps Lock', w: 1.75 }, 'A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'", { label: 'Enter', w: 2.25 }],
        [{ slot: 'shift', w: 2.25 }, 'Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/', { w: 2.75 }],
        [{ slot: 'ctrl', w: 1.5 }, { label: '⊞', w: 1.25 }, { w: 1.25 }, { slot: 'space', w: 6.25 }, { slot: 'alt', w: 1.25 }, { label: '☰', w: 1.25 }, { w: 2.25 }]
      ],
      items: [
        { text: 'Esc', answer: 'esc' },
        { text: 'Backspace', answer: 'backspace' },
        { text: 'Tab', answer: 'tab' },
        { text: 'Shift', answer: 'shift' },
        { text: 'Ctrl', answer: 'ctrl' },
        { text: 'Alt', answer: 'alt' },
        { text: 'Spacja', answer: 'space' }
      ]
    },
    {
      type: 'buckets',
      label: 'B',
      rewardGif: 'assets/reward-gifs/spongebob.gif',
      match: true,
      prompt: 'Co robi ten klawisz?',
      hint: 'Kliknij klawisz, a potem pole obok pasującego opisu.',
      buckets: [
        { id: 'tab', label: 'Przenosi kursor do następnego pola albo robi wcięcie w tekście.' },
        { id: 'shift', label: 'Przytrzymany razem z literą pisze wielką literę.' },
        { id: 'space', label: 'Wstawia odstęp między wyrazami.' },
        { id: 'caps', label: 'Włącza i wyłącza pisanie samymi wielkimi literami.' }
      ],
      items: [
        { text: 'Tab', answer: 'tab' },
        { text: 'Shift', answer: 'shift' },
        { text: 'Spacja', answer: 'space' },
        { text: 'Caps Lock', answer: 'caps' }
      ]
    },
    {
      type: 'inputs',
      label: 'C',
      rewardGif: 'assets/reward-gifs/dance-hamster.gif',
      shuffle: false,
      prompt: 'Wpisz w pola.',
      hint: 'Wpisz dokładnie to, o co prosi polecenie. Wielkość liter ma znaczenie!',
      tip: {
        title: 'Jak napisać wielką albo polską literę?',
        steps: [
          'Wielka litera: przytrzymaj `Shift` i naciśnij literę.',
          'Polska litera: przytrzymaj prawy `Alt` i naciśnij literę, np. `Alt` + `z` = ż.',
          'Wielka polska litera: przytrzymaj `Shift` i prawy `Alt`, a potem naciśnij literę.'
        ]
      },
      items: [
        { text: 'Wielka litera S', answer: 'S' },
        { text: 'Litera ż', answer: 'ż' },
        { text: 'Litera s', answer: 's' },
        { text: 'Litera ź', answer: 'ź' },
        { text: 'Litera ć', answer: 'ć' },
        { text: 'Wielka litera Ą', answer: 'Ą' },
        { text: 'Słowo: łyżwa', answer: 'łyżwa' },
        { text: 'Słowo: żółw', answer: 'żółw' },
        { text: 'Usuń literę A ze słowa', value: 'koAt', answer: 'kot' }
      ]
    },
    {
      type: 'buckets',
      label: 'D',
      rewardGif: 'assets/reward-gifs/shia-labeouf-clapping.gif',
      match: true,
      mono: true,
      prompt: 'Co robi ten skrót klawiszowy?',
      hint: 'Kliknij skrót, a potem pole obok pasującego opisu.',
      buckets: [
        { id: 'copy', label: 'Kopiuj', note: 'zapamiętuje zaznaczenie w schowku' },
        { id: 'cut', label: 'Wytnij', note: 'zabiera zaznaczenie do schowka' },
        { id: 'paste', label: 'Wklej', note: 'wstawia to, co jest w schowku' },
        { id: 'all', label: 'Zaznacz wszystko', note: 'zaznacza cały tekst' }
      ],
      items: [
        { text: 'Ctrl + C', answer: 'copy' },
        { text: 'Ctrl + X', answer: 'cut' },
        { text: 'Ctrl + V', answer: 'paste' },
        { text: 'Ctrl + A', answer: 'all' }
      ]
    },
    {
      type: 'practice',
      label: 'E',
      rewardGif: 'assets/reward-gifs/pikachu-clap.gif',
      shuffle: false,
      prompt: 'Użyj skrótów klawiszowych.',
      hint: 'Zrób to, co jest napisane nad polami. Gdy się uda, pola zrobią się zielone.',
      items: [
        { kind: 'copy', text: 'Skopiuj słowo i wklej je do pola obok.', left: 'komputer', word: 'komputer', answer: true },
        { kind: 'cut', text: 'Wytnij słowo i wklej je do pola obok.', left: 'klawiatura', word: 'klawiatura', answer: true },
        { kind: 'clear', text: 'Zaznacz cały tekst i usuń go.', left: 'Ten tekst jest bardzo długi i usuwanie go literka po literce trwałoby wieki. Zaznacz go cały naraz i usuń jednym klawiszem!', answer: true },
        { kind: 'tab', text: 'Przejdź do pola obok i wpisz Mam', left: 'Kliknij tutaj', word: 'Mam', answer: true }
      ]
    }
  ]
};

// Zadanie „Dokumenty tekstowe”: karta ulubionego sportowca, artysty lub zespołu
// w edytorze tekstu (zdjęcie z opisem obok, lista pod spodem). Zalicza kod nauczyciela.
const idolCardTask = {
  type: 'task',
  id: 'dokumenty-tekstowe/zadanie-moj-idol',
  title: 'Dokumenty tekstowe',
  prompt: 'Mój idol — karta w dokumencie',
  hint: 'Zrób stronę jak na obrazku. Gotowe? Pokaż ją nauczycielowi i wpisz kod.',
  intro: '🌟 Opisz <b>swojego idola</b> — piłkarza, aktora, malarza… w <b>Dokumentach Google</b> albo <b>Writerze</b>. Na górze jego <b>imię</b>, obok <b>zdjęcia</b> 3 zdania o nim, pod spodem <b>3 sukcesy</b>. Zapisz jako <b>Mój idol</b>.',
  doneHint: 'Brawo! Masz zdjęcie, opis i listę. 🎉',
  reward: 30,
  tone: 'orange',
  layout: `
    <div class="ct-layout" aria-label="Wzór strony: tytuł u góry, zdjęcie po lewej, opis po prawej, lista pod zdjęciem">
      <div class="ct-layout-title">Imię i nazwisko / nazwa zespołu</div>
      <div class="ct-layout-row">
        <div class="ct-layout-photo">🖼️<span>zdjęcie</span></div>
        <div class="ct-layout-text"><span></span><span></span><span></span><span></span><small>krótki opis ~200 znaków</small></div>
      </div>
      <ol class="ct-layout-list"><li><span></span></li><li><span></span></li><li><span></span></li></ol>
      <small class="ct-layout-note">lista: medale, filmy, płyty, piosenki…</small>
    </div>`,
  steps: []
};

// Zadania „Grafika komputerowa”: w hint co stworzyć i w czym, w steps kryteria zaliczenia,
// które uczeń odhacza, a nauczyciel sprawdza. Zalicza kod nauczyciela.
const PHOTOPEA_LINK = '<a href="https://www.photopea.com" target="_blank" rel="noopener">Photopea</a>';

// Kolorowanka jak na kolorujonline.pl: obrazki SVG w assets/coloring, każde pole to kształt z klasą „c”.
// Nowy obrazek z PNG: wrzuć <id>.png do assets/coloring i uruchom node tools/png-do-kolorowanki.mjs.
const coloringTask = {
  type: 'coloring',
  id: 'grafika-komputerowa/zadanie-kolorowanka',
  title: 'Grafika komputerowa',
  prompt: 'Pokoloruj obrazek online',
  doneHint: 'Obrazek jest cały kolorowy. Możesz go pobrać jako PNG.',
  reward: 30,
  minColors: 5,
  pages: [
    { id: 'smok', label: 'Smok i zamek', src: 'assets/coloring/smok.svg' },
    { id: 'rakieta', label: 'Kosmonauta i rakieta', src: 'assets/coloring/rakieta.svg' },
    { id: 'akwarium', label: 'Podwodny świat', src: 'assets/coloring/akwarium.svg' },
    { id: 'lama', label: 'Lama z balonami', src: 'assets/coloring/lama.svg' },
    { id: 'pinata', label: 'Lama-piniata', src: 'assets/coloring/pinata.svg' },
    { id: 'klocki', label: 'Świat z klocków', src: 'assets/coloring/klocki.svg' },
    { id: 'kolarstwo', label: 'Wyścig kolarski', src: 'assets/coloring/kolarstwo.svg' },
    { id: 'wisla', label: 'Mecz Białej Gwiazdy', src: 'assets/coloring/wisla.svg' },
    { id: 'stworki', label: 'Wyprawa ze stworkami', src: 'assets/coloring/stworki.svg' },
    { id: 'aniimo', label: 'Przygoda z Aniimo', src: 'assets/coloring/aniimo.svg' }
  ]
};

const avatarTask = {
  type: 'task',
  id: 'grafika-komputerowa/zadanie-awatar',
  title: 'Grafika komputerowa',
  prompt: 'Awatar na koncie Windows',
  tone: 'blue',
  intro: '<b>Stwórz</b> swój awatar i ustaw go jako <b>zdjęcie konta</b> w Windows.',
  layout: '<img class="ct-art" src="assets/task-art/avatarmaker.png" width="1033" height="525" alt="Kreator awatarów Avatar Maker: twarz postaci i wybór części do zmiany" />',
  link: { href: 'https://avatarmaker.com', label: 'Rozpocznij' },
  doneHint: 'Twój awatar jest na koncie Windows i nauczyciel go widział.',
  reward: 30,
  steps: [
    { icon: '🧑‍🎨', text: 'Awatar ma <b>zmienione</b> co najmniej <b>3 rzeczy</b>: np. włosy, oczy, ubranie, tło.' },
    { icon: '💾', text: 'Awatar jest <b>pobrany</b> jako obrazek <b>PNG</b>.' },
    {
      icon: '🪟',
      text: 'Awatar jest <b>zdjęciem konta</b> — widać go w menu <b>Start</b>.',
      help: '<p><b>Ustawienia</b> (<kbd>Win</kbd> + <kbd>I</kbd>) → <b>Konta</b> → <b>Twoje informacje</b>.</p>'
    },
    { icon: '🙋', text: '<b>Pochwal się</b> nauczycielowi.' }
  ]
};

const robotDrawingTask = {
  type: 'task',
  id: 'grafika-komputerowa/zadanie-robot',
  title: 'Grafika komputerowa',
  prompt: 'Narysuj robota-pomocnika',
  tone: 'orange',
  intro: '<b>Stwórz</b> rysunek <b>robota</b>, który Ci w czymś <b>pomaga</b>.',
  layout: '<img class="ct-art" src="assets/task-art/paint-photopea.png" alt="Ekran programu Paint przełamany po skosie z ekranem Photopea" />',
  doneHint: 'Twój robot ma kształty, kolory, imię i jest zapisany jako PNG.',
  reward: 30,
  steps: [
    { icon: '⬜', text: 'Robot jest zbudowany z <b>kształtów</b>: <b>prostokątów</b>, <b>kół</b> i <b>linii</b>.' },
    { icon: '🦾', text: 'Robot ma <b>głowę</b>, <b>tułów</b>, <b>ręce</b> i <b>nogi</b>.' },
    { icon: '🪣', text: 'Robot i <b>tło</b> są pokolorowane — co najmniej <b>4 kolory</b>.' },
    { icon: '🔤', text: 'Na rysunku jest <b>imię robota</b>.' },
    { icon: '💾', text: 'Rysunek jest zapisany jako <b>robot.png</b>.' },
    { icon: '🗣️', text: 'Umiesz powiedzieć, <b>w czym pomaga</b> Twój robot.' }
  ]
};

const invitationCardTask = {
  type: 'task',
  id: 'grafika-komputerowa/zadanie-zaproszenie',
  title: 'Grafika komputerowa',
  prompt: 'Kartka z zaproszeniem',
  hint: `<b>Stwórz:</b> kartkę z zaproszeniem na <b>przedstawienie z okazji Dnia Rodziny</b> albo <b>szkolne rozgrywki sportowe</b>.<br><b>W czym:</b> Paint albo ${PHOTOPEA_LINK}`,
  layout: '<img class="ct-art" src="assets/task-art/paint-photopea-zaproszenie.png" alt="Kartka z zaproszeniem w programie Paint przełamanym po skosie z Photopea" />',
  doneHint: 'Twoja kartka spełnia wszystkie warunki i nauczyciel ją widział.',
  reward: 30,
  tone: 'orange',
  steps: [
    { icon: '🔤', text: 'Na górze jest duży napis <b>ZAPROSZENIE</b>.' },
    { icon: '📅', text: 'Jest napisane, <b>na co</b> zapraszasz, <b>kiedy</b> (dzień i godzina) i <b>gdzie</b>.' },
    { icon: '🌷', text: 'Są co najmniej <b>3 rysunki</b> pasujące do tematu.' },
    { icon: '🪣', text: '<b>Tło</b> jest kolorowe, a cała kartka ma co najmniej <b>4 kolory</b>.' },
    { icon: '👀', text: 'Cały tekst da się <b>łatwo przeczytać</b> i nie ma w nim błędów.' },
    { icon: '💾', text: 'Kartka jest zapisana jako <b>zaproszenie.png</b>.' }
  ]
};

const animationTask = {
  type: 'task',
  id: 'grafika-komputerowa/zadanie-animacja',
  title: 'Grafika komputerowa',
  prompt: 'Stwórz własną animację',
  tone: 'orange',
  intro: '<b>Stwórz:</b> animację według własnego pomysłu.',
  layout: `<div class="ct-apps">
    <figure class="ct-app">
      <img class="ct-app-art" src="assets/task-art/brush-ninja.png" width="640" height="556" alt="Edytor animacji Brush Ninja: płótno, pędzle, kolory i klatki" />
      <a class="primary-button" href="https://brush.ninja/create/animation-maker/" target="_blank" rel="noopener">Stwórz animację <span aria-hidden="true">↗</span></a>
    </figure>
    <figure class="ct-app">
      <img class="ct-app-art" src="assets/task-art/pivot-animator.png" width="640" height="400" alt="Program Pivot Animator: ludzik z łukiem i pasek klatek" />
      <button class="primary-button" type="button" data-pivot-open>Stwórz animację</button>
    </figure>
  </div>`,
  doneHint: 'Twoja animacja się rusza i nauczyciel ją widział.',
  reward: 30,
  steps: [
    { icon: '🎞️', text: 'Animacja ma co najmniej <b>10 klatek</b>.' },
    { icon: '⏱️', text: 'Animacja trwa co najmniej <b>5 sekund</b>.' },
    { icon: '🏃', text: 'Postać albo rzecz <b>porusza się płynnie</b> — bez dużych skoków między klatkami.' },
    { icon: '💡', text: 'Umiesz w jednym zdaniu powiedzieć, <b>co dzieje się</b> w animacji.' }
  ]
};

// Zadanie „Programowanie”: gra Scottie Go! na telefonie od nauczyciela. Zalicza kod nauczyciela.
const scottieGoTask = {
  type: 'task',
  id: 'programowanie/zadanie-scottie-go',
  title: 'Programowanie',
  prompt: 'Scottie Go! — pierwszy poziom',
  hint: 'Poproś nauczyciela o <b>telefon</b> i grę <b>Scottie Go!</b> Rozwiąż wszystkie zagadki na <b>pierwszym poziomie</b>.',
  doneHint: 'Rozwiązałeś zagadki z pierwszego poziomu Scottie Go!',
  reward: 30,
  layout: '<img class="ct-art" src="assets/task-art/scottie-go.png" width="640" height="441" alt="Robot Scottie i ekran gry Scottie Go! na tablecie" />',
  steps: []
};

// Zadanie „Programowanie”: zagadki z Elzą (Kraina Lodu) na code.org. Zalicza kod nauczyciela.
const frozenTask = {
  type: 'task',
  id: 'programowanie/zadanie-kraina-lodu',
  title: 'Programowanie',
  prompt: 'Kraina Lodu — zagadki z Elzą',
  hint: 'Wejdź na stronę <a href="https://studio.code.org/pl/courses/frozen/units/1/lessons/1/levels/2" target="_blank" rel="noopener">code.org — Kraina Lodu</a> i rozwiąż <b>10 zagadek</b> z Elzą.',
  link: { href: 'https://studio.code.org/pl/courses/frozen/units/1/lessons/1/levels/2', label: 'Rozpocznij' },
  doneHint: 'Rozwiązałeś 10 zagadek z Elzą.',
  reward: 30,
  layout: '<img class="ct-art" src="assets/task-art/frozen-elza.png" width="400" height="410" alt="Elza ślizga się po lodzie i rysuje linie" />',
  steps: []
};

// Zadanie „Programowanie”: Godzina Kodowania na code.org. Zalicza kod nauczyciela.
const hourOfCodeTask = {
  type: 'task',
  id: 'programowanie/zadanie-godzina-kodowania',
  title: 'Programowanie',
  prompt: 'Godzina Kodowania — zagadki',
  hint: 'Wejdź na stronę <a href="https://studio.code.org/pl/hoc/2" target="_blank" rel="noopener">code.org — Godzina Kodowania</a> i rozwiąż <b>10 zagadek</b>.',
  link: { href: 'https://studio.code.org/pl/hoc/2', label: 'Rozpocznij' },
  doneHint: 'Rozwiązałeś 10 zagadek z Godziny Kodowania.',
  reward: 30,
  layout: '<img class="ct-art" src="assets/task-art/hoc-angry-birds.png" width="402" height="406" alt="Labirynt z czerwonym ptakiem Angry Birds i zieloną świnką" />',
  steps: []
};

// Podpowiedź z osobnymi krokami dla dwóch programów (domyślnie Dokumenty Google i LibreOffice Writer).
function twoAppsHelp(firstSteps, secondSteps, names = ['Dokumenty Google', 'LibreOffice Writer']) {
  const block = (name, steps) => `<div class="ct-app"><strong>${name}</strong><ol>${steps.map((step) => `<li>${step}</li>`).join('')}</ol></div>`;
  return block(names[0], firstSteps) + block(names[1], secondSteps);
}

// Gra na myszkę: baloniki lecą od dołu, gracz klika je, zanim uciekną. Ćwiczy szybkość i precyzję.
// Prędkości w pikselach na sekundę; speedUp mnoży prędkość i częstość baloników wraz z wynikiem.
// ramp: o ile px/s balonik danego koloru przyspiesza z każdą sekundą gry (najwyżej do maxSpeed).
const balloonPopGame = {
  type: 'balloons',
  id: 'praca-na-komputerze/gra-baloniki',
  title: 'Gra: Baloniki',
  prompt: 'Przebij baloniki myszką',
  goal: 200,
  reward: 40,
  lives: 4,
  // Od tylu punktów lecą też bomby — kliknięta bomba zabiera życie.
  bombsAt: 40,
  bombChance: 0.22,
  bombSpeed: 85,
  spawnEvery: 1.1,
  speedUp: { perPoint: 0.007, max: 2.4 },
  balloons: [
    { id: 'red', label: 'czerwony', points: 5, color: '#ff4b4b', speed: 80, ramp: 0.6, maxSpeed: 130, weight: 55 },
    { id: 'green', label: 'zielony — szybki', points: 10, color: '#58cc02', speed: 140, weight: 30 },
    { id: 'purple', label: 'fioletowy — szybki zygzak', points: 15, color: '#9069cd', speed: 140, zigzag: 70, weight: 15 }
  ]
};

// Gra „Sieć komputerowa”: plansza-labirynt, po lewej Internet, po prawej komputer.
// Mapa: # ściana, . podłoga, I i J gniazdka Internetu, M modem, K komputer, C–G kolejne komputery, L komputer z Wi-Fi,
// P, Q, R drukarki.
// tags — numerki na urządzeniach, gdy na planszy jest kilka komputerów (np. { K: '1', C: '2' }).
// rooms — podpisy sal nad planszą (from, to — numery kolumn).
// Cele: internet / offline (device), link (każde z a widzi każde z b), isolated (żadne z a nie widzi żadnego z b, nie licząc VPN).
// device, a i b mogą być listą urządzeń. alert — komunikat, gdy reguła zostanie złamana.
// cables — kable ułożone na starcie między sąsiednimi urządzeniami (nie da się ich odłączyć).
// tools — sprzęt do postawienia (modem, router, ap) i wzmocnienia do slotów (wifi — karta Wi-Fi, apModule — moduł access point do routera,
// vpn — usługa VPN do komputera: komputery z nią łączy tunel (linia przerywana); działa, gdy oba mają internet).
// fact — ciekawostka „Czy wiesz?” pokazywana po przejściu poziomu.
// Wi-Fi: siła = 1 − odległość / range − ściany × wallLoss; urządzenie łączy się, gdy siła > 0.
const networkBuildGame = {
  type: 'network',
  id: 'praca-na-komputerze/gra-siec',
  title: 'Gra: Sieć komputerowa',
  prompt: 'Zbuduj sieć komputerową',
  reward: 50,
  wifi: { range: 5, wallLoss: 0.3 },
  levels: [
    {
      title: 'Kabel przez labirynt',
      hint: 'Internet przychodzi z gniazdka do modemu. Złap modem albo komputer myszką i poprowadź kabel korytarzem do drugiego urządzenia. Kabel nie przejdzie przez ścianę.',
      fact: 'Kabel sieciowy to kabel Ethernet. Ma na końcu wtyczkę RJ-45 — podobną do telefonicznej, ale szerszą.',
      tools: {},
      cables: [['I', 'M']],
      goals: [{ kind: 'internet', device: 'K', label: 'Komputer ma internet' }],
      map: [
        'IM.#........',
        '##.#.######.',
        '...#.#....#.',
        '.###.#.##.#.',
        '.....#.#..#.',
        '####.#.#.###',
        '.......#...K',
        '.#####...#..'
      ]
    },
    {
      title: 'Postaw modem',
      hint: 'Gniazdka od dostawcy nie podłączysz prosto do komputera. Postaw modem, połącz go kablem z gniazdkiem, a potem z komputerem.',
      fact: 'Modem zamienia sygnał, który dostawca przesyła kablem telefonicznym, telewizyjnym albo światłowodem, na sieć zrozumiałą dla komputerów.',
      tools: { modem: 1 },
      goals: [{ kind: 'internet', device: 'K', label: 'Komputer ma internet' }],
      map: [
        'I..#.....#..',
        '.#.#.###.#.#',
        '.#...#...#.#',
        '.#####.###.#',
        '.....#.#...#',
        '.###.#.#.#.K',
        '...#...#.#..',
        '.#...#.....#'
      ]
    },
    {
      title: 'Router z modemem',
      hint: 'Tym razem nie ma osobnego modemu. Postaw router i włóż do jego slotu moduł modemu — wtedy podłączysz go prosto do gniazdka portem WAN (pomarańczowy). Router ma jeszcze 4 porty LAN dla urządzeń.',
      fact: 'W wielu domach modem, router i Wi-Fi są schowane w jednym pudełku od operatora. W środku i tak robią trzy różne rzeczy. Gniazdko łączy się z portem WAN (sieć rozległa, czyli internet), a urządzenia z portami LAN (sieć lokalna w domu).',
      tools: { router: 1, modemModule: 1 },
      goals: [
        { kind: 'internet', device: 'K', label: 'Komputer ma internet' },
        { kind: 'link', a: 'K', b: 'P', label: 'Komputer jest połączony z drukarką' }
      ],
      map: [
        'I....#......',
        '####.#.####.',
        '.......#...K',
        '.#####.#.##.',
        '.......#....',
        '.#####.####.',
        '.#P...#.....',
        '...#......#.'
      ]
    },
    {
      title: 'Zamknięta sala',
      hint: 'Do sali z laptopem nie ma drzwi, ale laptop ma Wi-Fi. Access point dostaje internet kablem od routera. Postaw router i access point blisko sali — albo włóż do slotu routera moduł access point. Każda ściana osłabia sygnał.',
      fact: 'Wi-Fi to sieć bez kabli — dane lecą falami radiowymi. Ściany, zwłaszcza betonowe, osłabiają sygnał, dlatego router najlepiej stawiać na środku domu.',
      tools: { router: 1, modemModule: 1, ap: 1, apModule: 1 },
      goals: [{ kind: 'internet', device: 'L', label: 'Laptop ma internet' }],
      map: [
        'I.......#...',
        '######..#.#.',
        '.....#..#.#.',
        '.###.#.##.#.',
        '.#...#.#####',
        '.#.###.#L..#',
        '.#.....#...#',
        '...#...#####'
      ]
    },
    {
      title: 'Karta Wi-Fi',
      hint: 'Zwykły komputer i drukarka nie mają Wi-Fi. Przeciągnij na nie kartę Wi-Fi. Jeden access point nie sięgnie do obu pokoi.',
      fact: 'Laptopy i telefony mają kartę Wi-Fi wbudowaną w środku. Do zwykłego komputera trzeba ją dołożyć.',
      tools: { router: 1, modemModule: 1, ap: 2, wifi: 2 },
      goals: [
        { kind: 'internet', device: 'K', label: 'Komputer ma internet' },
        { kind: 'link', a: 'K', b: 'P', label: 'Komputer jest połączony z drukarką' }
      ],
      map: [
        'I....#......',
        '.###.#.#####',
        '.#.....#...#',
        '.#.###.#.K.#',
        '.#...#.#####',
        '##.#.#......',
        'P#.#.####.#.',
        '##...#......'
      ]
    },
    {
      title: 'Drukarka bez internetu',
      hint: 'Komputer i drukarka nie przekazują internetu dalej — robi to tylko modem, router i access point. Komputer ma jedną wypustkę i slot na kartę Wi-Fi.',
      fact: 'Urządzenia w sieci lokalnej mogą się ze sobą komunikować nawet bez internetu — tak działa drukowanie albo gra w sieci w jednej sali.',
      tools: { router: 1, modemModule: 1, ap: 1, wifi: 1 },
      goals: [
        { kind: 'internet', device: 'K', label: 'Komputer ma internet' },
        { kind: 'link', a: 'K', b: 'P', label: 'Komputer jest połączony z drukarką' },
        { kind: 'offline', device: 'P', label: 'Drukarka NIE może mieć internetu' }
      ],
      map: [
        'I...#.......',
        '.##.#.#####.',
        '.#..#.#####.',
        '.#.##.##P..#',
        '.#......#..#',
        '.####.##..K#',
        '......#..###',
        '.####.......'
      ]
    },
    {
      title: 'Dwie sieci',
      hint: 'Zbuduj dwie osobne sieci. Komputer 1 i laptop mają mieć internet przez router podłączony do modemu. Pracownia — komputery 2 i 3 z drukarką — ma działać bez internetu na własnym routerze, którego nie łączysz ani z modemem, ani z pierwszym routerem. Kable nie mogą się krzyżować ani leżeć na tej samej kratce.',
      fact: 'Sieć lokalna (LAN) działa też bez internetu — komputery widzą w niej siebie nawzajem i drukarkę. Tak buduje się np. sieci w salach egzaminacyjnych, żeby nikt nie szukał odpowiedzi w internecie.',
      tools: { router: 2 },
      cables: [['I', 'M']],
      tags: { K: '1', C: '2', D: '3' },
      goals: [
        { kind: 'internet', device: 'K', label: 'Komputer 1 ma internet' },
        { kind: 'internet', device: 'L', label: 'Laptop ma internet' },
        { kind: 'link', a: 'C', b: 'P', label: 'Komputer 2 jest połączony z drukarką' },
        { kind: 'link', a: 'D', b: 'P', label: 'Komputer 3 jest połączony z drukarką' },
        { kind: 'offline', device: 'P', label: 'Pracownia (komputery 2, 3 i drukarka) NIE może mieć internetu' }
      ],
      map: [
        'IM...#.....K',
        '####.#.###.#',
        'L......#...#',
        '##.###.#.###',
        '#....#.....#',
        '#.##.#.#.#.#',
        'C.#........P',
        '###D##.#...#'
      ]
    },
    {
      title: 'Dwie sale i tunel VPN',
      hint: 'Każda sala ma swoje gniazdko internetu. Sala A: komputery 1–3 i drukarka A. Sala B: komputery 4–6 i drukarki B. Sale nie mogą się widzieć — ani kablem, ani przez Wi-Fi. Włóż usługę VPN do komputerów 3 i 6 — połączy je tunel (linia przerywana). Tunel biegnie przez internet, więc oba komputery muszą mieć internet. Router ma tylko 4 boki na kable.',
      fact: 'VPN (wirtualna sieć prywatna) to bezpieczny tunel przez internet. Dzięki niemu komputer w innym budynku działa tak, jakby stał w tej samej sieci lokalnej — np. w szkole albo w firmie.',
      tools: { router: 2, modemModule: 1, apModule: 2, wifi: 3, vpn: 2 },
      cables: [['I', 'M']],
      tags: { K: '1', C: '2', D: '3', E: '4', F: '5', G: '6', P: 'A', Q: 'B', R: 'B' },
      rooms: [{ label: 'Sala A', from: 0, to: 5 }, { label: 'Sala B', from: 7, to: 13 }],
      goals: [
        { kind: 'internet', device: ['K', 'C', 'D'], label: 'Komputery 1, 2 i 3 mają internet' },
        { kind: 'link', a: ['K', 'C', 'D'], b: 'P', label: 'Sala A drukuje na drukarce A' },
        { kind: 'link', a: ['E', 'F', 'G'], b: ['Q', 'R'], label: 'Sala B drukuje na drukarkach B' },
        { kind: 'link', a: 'D', b: 'G', label: 'Komputery 3 i 6 są w jednej sieci' },
        { kind: 'isolated', a: ['K', 'C', 'D', 'P'], b: ['E', 'F', 'G', 'Q', 'R'], label: 'Sale A i B NIE mogą się widzieć (poza VPN)', alert: 'Ups! Sale A i B się połączyły.' }
      ],
      map: [
        'IM....#.J....E',
        '.#..#.#.#.#...',
        'K.....#.......',
        '#..#..#.#..#.F',
        '......#.......',
        '.#..#.#.#.....',
        'C...P.#.....R.',
        '.#.#..#.#.....',
        '.....D#G..Q...'
      ]
    },
    {
      title: 'Laptop drukuje',
      hint: 'Laptop ma wbudowane Wi-Fi i jedną wypustkę na kabel. Drukarka w jego pokoju NIE może mieć internetu. Zastanów się, czy karta Wi-Fi w ogóle jest tu potrzebna.',
      fact: 'Nie trzeba podłączać do internetu wszystkiego. Im mniej urządzeń ma internet, tym mniej dróg dla wirusów i włamywaczy.',
      tools: { router: 1, ap: 1, wifi: 1 },
      cables: [['I', 'M']],
      goals: [
        { kind: 'internet', device: 'K', label: 'Komputer ma internet' },
        { kind: 'internet', device: 'L', label: 'Laptop ma internet' },
        { kind: 'link', a: 'L', b: 'P', label: 'Laptop jest połączony z drukarką' },
        { kind: 'offline', device: 'P', label: 'Drukarka NIE może mieć internetu' }
      ],
      map: [
        'IM...#.....K',
        '##.#.#.####.',
        '#..#...#....',
        '#.###.##.##.',
        '#...#....#..',
        '#.#.########',
        '#......#L.P#',
        '##.....#####'
      ]
    },
    {
      title: 'Wielki finał',
      hint: 'Jest tylko gniazdko — zbuduj całą sieć sam: modem, router, kable i Wi-Fi. Komputer i laptop siedzą w dwóch zamkniętych pokojach daleko od siebie. Jeden nadajnik Wi-Fi nie wystarczy.',
      fact: 'Szkoły i duże domy mają wiele access pointów. Telefon sam przełącza się na najsilniejszy sygnał, gdy chodzisz po budynku — tak jak urządzenia w tej grze.',
      tools: { modem: 1, router: 1, ap: 1, apModule: 1, wifi: 1 },
      goals: [
        { kind: 'internet', device: 'K', label: 'Komputer ma internet' },
        { kind: 'internet', device: 'L', label: 'Laptop ma internet' },
        { kind: 'internet', device: 'P', label: 'Drukarka ma internet' }
      ],
      map: [
        'I........###',
        '.##.#....#K#',
        '.#.......###',
        '.#.##.##.#..',
        '###...##.#..',
        '###.##.#.#.#',
        '#L#.#..#.#.#',
        '###........P'
      ]
    }
  ]
};

// Gra „Obrona zamku” (jak Epistory): potwory idą z góry na zamek, gracz pokonuje je, wpisując słowa.
// Każde wpisane słowo to wordPoints pkt. Do slowUntil pkt potwory idą wolniej (slowFactor).
// Boss pojawia się po przekroczeniu bossAt pkt. Wzmocnienia działają przez powerDuration sekund:
// „line” trafia też potwory w tej samej kolumnie (lineWidth px), „radius” — w promieniu radius px.
const typingDefenseGame = {
  type: 'typing',
  id: 'dokumenty-tekstowe/gra-obrona-zamku',
  title: 'Gra: Obrona zamku',
  prompt: 'Obroń zamek, pisząc słowa',
  goal: 200,
  lives: 3,
  wordPoints: 5,
  // Poziomy trudności: nagroda za ukończenie i mnożniki — prędkości potworów (speed),
  // czasu, przez jaki wzmocnienie leży na planszy (powerLife), i czasu działania zebranego wzmocnienia (powerDuration),
  // odstępu między wzmocnieniami (powerEvery) i pola rażenia Pioruna i Wybuchu (powerArea).
  // shortWords — szansa, że cel dostanie słowo z krótszej połowy puli.
  difficulties: [
    { id: 'easy', label: 'Łatwy', icon: '🐢', reward: 20, speed: 0.35, powerLife: 3, powerDuration: 2, powerEvery: 0.5, powerArea: 1.6, shortWords: 0.75, text: 'potwory dużo wolniejsze, krótsze słowa, wzmocnienia częściej, dłużej i z większym zasięgiem' },
    { id: 'normal', label: 'Normalny', icon: '⚔️', reward: 40, speed: 1, powerLife: 1, powerDuration: 1, powerEvery: 1, powerArea: 1, shortWords: 0, text: 'zwykła prędkość potworów' },
    { id: 'hard', label: 'Trudny', icon: '🔥', reward: 80, speed: 1.5, powerLife: 1, powerDuration: 1, powerEvery: 1, powerArea: 1, shortWords: 0, text: 'potwory szybsze, ale 2× więcej punktów' }
  ],
  defaultDifficulty: 'normal',
  slowUntil: 25,
  slowFactor: 0.5,
  bossAt: 120,
  waveBreak: 2.5,
  maxAlive: 7,
  enemies: {
    fast: {
      id: 'fast', label: 'Szybki', words: 1, speed: 46,
      pool: ['kot', 'pies', 'dom', 'las', 'mysz', 'okno', 'druk', 'plik', 'żaba', 'ćma', 'łódź', 'ryż', 'góra', 'jeż', 'wąż', 'miś', 'sowa', 'łoś', 'żółw', 'ser', 'nos', 'ucho', 'ręka', 'noga', 'koń', 'lis', 'rak', 'mak', 'bęben', 'ząb', 'gęś', 'kółko', 'tort', 'zupa', 'mleko', 'ogień', 'woda', 'lód', 'śnieg', 'deszcz', 'wiatr', 'nuta', 'piłka', 'list', 'zamek', 'smok', 'hełm', 'tarcza', 'miecz', 'łuk', 'ławka', 'kreda', 'gumka', 'farba', 'tekst', 'słowo', 'enter', 'spacja']
    },
    slow: {
      id: 'slow', label: 'Wolny', words: 3, speed: 24,
      pool: ['akapit', 'czcionka', 'nagłówek', 'wcięcie', 'margines', 'kursywa', 'dokument', 'edytor', 'schowek', 'drukarka', 'strona', 'tabela', 'obrazek', 'przypis', 'punktor', 'litera', 'zdanie', 'kursor', 'klawisz', 'ołówek', 'książka', 'zeszyt', 'szkoła', 'tablica', 'linijka', 'pędzel', 'ściana', 'chmura', 'słońce', 'jabłko', 'gruszka', 'rycerz', 'wieża', 'źródło', 'żołnierz', 'pióro', 'kartka', 'notatka', 'wydruk', 'odstęp']
    },
    boss: {
      id: 'boss', label: 'Boss', words: 6, speed: 14,
      pool: ['formatowanie', 'wypunktowanie', 'autokorekta', 'pogrubienie', 'podkreślenie', 'przekreślenie', 'wyśrodkowanie', 'klawiatura', 'interlinia', 'numerowanie', 'wyrównanie', 'kopiowanie', 'wklejanie', 'zapisywanie', 'przewijanie', 'ortografia', 'gramatyka', 'dokumentacja']
    }
  },
  // Fala n: firstWave + n potworów (najwyżej maxWave), szansa na wolnego rośnie z każdą falą.
  waves: { first: 2, max: 10, slowChance: 0.1, slowChancePerWave: 0.07, slowChanceMax: 0.45, gap: 2.6, gapPerWave: 0.15, gapMin: 1.2 },
  powerFrom: 25,
  powerEvery: [14, 20],
  powerLife: 6,
  powerDuration: 10,
  lineWidth: 90,
  radius: 160,
  powers: [
    { id: 'line', icon: '⚡', label: 'Piorun', text: 'trafia też potwory nad i pod celem', pool: ['piorun', 'grom', 'błysk'] },
    { id: 'radius', icon: '💥', label: 'Wybuch', text: 'trafia też potwory dookoła celu', pool: ['wybuch', 'bum', 'trach'] }
  ]
};

// Gra „Detektyw Fejków”: gracz ocenia nagłówki — PRAWDA czy FAŁSZ.
// Za dobrą odpowiedź points pkt, za złą traci życie. Po goal pkt może zakończyć grę i odebrać reward.
// Nagłówki losują się z puli; gdy pula się skończy, tasują się od nowa.
const fakeNewsGame = {
  type: 'fakes',
  id: 'wyszukiwanie-informacji/detektyw-fejkow',
  title: 'Gra: Detektyw Fejków',
  prompt: 'Prawda czy fejk?',
  goal: 200,
  points: 10,
  reward: 40,
  lives: 3,
  headlines: [
    { text: 'SZOK!!! Naukowcy odkryli, że koty widzą DUCHY!', fake: true, why: 'Żadne badania tego nie potwierdziły. „SZOK”, wielkie litery i „!!!” mają Cię tylko przestraszyć i skusić do kliknięcia.' },
    { text: 'Wielki Mur Chiński widać z Księżyca gołym okiem!!!', fake: true, why: 'Mur jest bardzo długi, ale wąski — ma kilka metrów szerokości. Z Księżyca nie da się go zobaczyć.' },
    { text: 'Złota rybka pamięta tylko 3 sekundy! Biedne rybki!!!', fake: true, why: 'Rybki pamiętają rzeczy przez wiele miesięcy. Można je nawet nauczyć prostych sztuczek.' },
    { text: 'Piorun NIGDY nie uderza dwa razy w to samo miejsce!', fake: true, why: 'Uderza! Wysokie budynki i wieże dostają piorunami wiele razy w roku.' },
    { text: 'Używasz tylko 10% mózgu! Odblokuj resztę TYM trikiem!', fake: true, why: 'Pracuje cały mózg, tylko różne części w różnym czasie. „TEN trik” to przynęta na kliknięcie.' },
    { text: 'Połknięta guma do żucia zostaje w brzuchu na 7 LAT!!!', fake: true, why: 'Połknięta guma wychodzi z organizmu po kilku dniach. Lepiej jej jednak nie połykać!' },
    { text: 'Byk wpada w SZAŁ na widok czerwieni! Uważaj na czerwoną kurtkę!!!', fake: true, why: 'Byki nie rozróżniają koloru czerwonego. Denerwuje je ruch płachty, a nie jej kolor.' },
    { text: 'Dotkniesz żaby — wyrosną Ci brodawki! Lekarze ostrzegają!!!', fake: true, why: 'Brodawki wywołuje wirus, a nie żaby. „Lekarze ostrzegają”, ale nie wiadomo, którzy — to sygnał fejka.' },
    { text: 'Strusie ze strachu chowają głowę w piasek! Zobacz ZDJĘCIA!', fake: true, why: 'Strusie kładą szyję nisko przy ziemi, gdy się ukrywają albo pilnują jaj, ale głowy w piasek nie chowają.' },
    { text: 'Nietoperze są całkowicie ŚLEPE!!!', fake: true, why: 'Nietoperze widzą. W ciemności pomagają sobie dodatkowo echolokacją, czyli „słuchaniem” odbitego dźwięku.' },
    { text: 'Jedz dużo marchewki, a zobaczysz w CIEMNOŚCI jak kot!', fake: true, why: 'Marchewka jest zdrowa dla oczu, ale nie da Ci kociego wzroku.' },
    { text: 'PILNE!!! Od jutra wakacje przez cały rok! Udostępnij, zanim usuną!', fake: true, why: 'Takiej informacji nie podała szkoła ani żadne oficjalne źródło. „Udostępnij, zanim usuną” to typowy znak fejka.' },
    { text: 'Wygrałeś nowy telefon!!! Kliknij TUTAJ i podaj hasło!', fake: true, why: 'To oszustwo. Nikt nie rozdaje telefonów za kliknięcie. Nigdy nie podawaj nikomu swojego hasła!' },
    { text: 'Dinozaury żyły razem z pierwszymi ludźmi! Mamy DOWÓD!!!', fake: true, why: 'Dinozaury wyginęły około 66 milionów lat temu — bardzo, bardzo długo przed pojawieniem się ludzi.' },
    { text: 'Niesamowite! Słonie panicznie boją się MYSZY!!!', fake: true, why: 'To stary mit z bajek. Słoń może się przestraszyć czegoś nagłego, ale myszy nie są dla niego groźne.' },
    { text: 'Ten filmik usunie wszystkie wirusy z Twojego telefonu! Obejrzyj do końca!!!', fake: true, why: 'Oglądanie filmu nie usuwa wirusów. Do tego służą programy antywirusowe i aktualizacje.' },
    { text: 'Jeśli nie wyślesz tej wiadomości 10 osobom, Twoje konto ZNIKNIE!!!', fake: true, why: 'To łańcuszek. Konta nie znikają przez to, że nie przekażesz wiadomości dalej.' },
    { text: 'Księżyc jest zrobiony z SERA! Naukowcy ukrywali to latami!!!', fake: true, why: 'Księżyc jest zbudowany ze skał. „Ukrywali to latami” to typowe zdanie z wymyślonych historii.' },
    { text: 'Gry komputerowe zamieniają oczy w KWADRATY! Rodzice w szoku!!!', fake: true, why: 'Oczy nie zmieniają kształtu od grania. Warto jednak robić przerwy, żeby oczy odpoczęły.' },
    { text: 'Czekolada sprawia, że rosną piegi! SPRAWDŹ, zanim będzie za późno!!!', fake: true, why: 'Piegi pojawiają się od słońca i zależą od skóry, a nie od czekolady. „Zanim będzie za późno” straszy bez powodu.' },

    { text: 'Ośmiornica ma trzy serca', fake: false, why: 'Prawda! Dwa serca pompują krew do skrzeli, a trzecie do reszty ciała.' },
    { text: 'Miód może przetrwać w słoiku tysiące lat', fake: false, why: 'Prawda! W starożytnych grobowcach w Egipcie znaleziono miód, który wciąż nadawał się do jedzenia.' },
    { text: 'Płetwal błękitny to największe zwierzę, jakie żyło na Ziemi', fake: false, why: 'Prawda! Jest większy nawet od największych dinozaurów.' },
    { text: 'Na Wenus doba trwa dłużej niż rok', fake: false, why: 'Prawda! Wenus obraca się wokół siebie wolniej, niż okrąża Słońce.' },
    { text: 'Rekiny pływały w morzach, zanim na Ziemi pojawiły się drzewa', fake: false, why: 'Prawda! Rekiny żyją na Ziemi od ponad 400 milionów lat — dłużej niż drzewa.' },
    { text: 'Flamingi są różowe dzięki temu, co jedzą', fake: false, why: 'Prawda! W ich jedzeniu (małych skorupiakach i glonach) jest różowy barwnik.' },
    { text: 'Wombaty robią kupę w kształcie kostek', fake: false, why: 'Prawda! Brzmi dziwnie, ale tytuł jest spokojny i łatwo to sprawdzić w encyklopedii.' },
    { text: 'Kolibry potrafią latać do tyłu', fake: false, why: 'Prawda! Kolibry bardzo szybko machają skrzydłami i mogą latać w każdą stronę.' },
    { text: 'Żyrafa ma w szyi tyle samo kręgów co człowiek', fake: false, why: 'Prawda! Obie mają 7 kręgów szyjnych — u żyrafy są po prostu dużo dłuższe.' },
    { text: 'Rysy to najwyższy szczyt w Polsce', fake: false, why: 'Prawda! Rysy w Tatrach mają około 2499 metrów wysokości.' },
    { text: 'Wisła jest najdłuższą rzeką w Polsce', fake: false, why: 'Prawda! Wisła ma ponad 1000 kilometrów długości.' },
    { text: 'Koala potrafi spać nawet 20 godzin na dobę', fake: false, why: 'Prawda! Liście eukaliptusa dają mało energii, więc koala dużo odpoczywa.' },
    { text: 'Delfiny podczas snu odpoczywają tylko połową mózgu', fake: false, why: 'Prawda! Druga połowa czuwa, żeby delfin mógł wypływać po powietrze.' },
    { text: 'Jeden z pierwszych komputerów, ENIAC, ważył około 27 ton', fake: false, why: 'Prawda! Zajmował całą dużą salę i ważył tyle co kilka słoni.' },
    { text: 'Mrówki nie mają płuc', fake: false, why: 'Prawda! Mrówki oddychają przez małe otworki w ciele, które nazywamy przetchlinkami.' },
    { text: 'Banan to jagoda, a truskawka nie', fake: false, why: 'Prawda! Dla botaników banan jest jagodą, a truskawka — nie.' },
    { text: 'Pszczoły potrafią zapamiętywać ludzkie twarze', fake: false, why: 'Prawda! Naukowcy sprawdzili to w doświadczeniach z pszczołami miodnymi.' },
    { text: 'Serce krewetki znajduje się w jej głowie', fake: false, why: 'Prawda! U krewetki serce leży w przedniej części ciała, razem z głową.' }
  ]
};

// Quiz „Ciekawostki z sieci”: 6 pytań A/B/C/D, odpowiedzi uczeń szuka w internecie.
// Żadnej odpowiedzi nie da się znaleźć jednym wklejeniem pytania: trzeba ustalić, o kogo chodzi,
// znaleźć 2 fakty i je połączyć (dodać, odjąć). W pytaniach E i F osobę zna się tylko ze zdjęcia —
// tekst pytania jej nie zdradza, więc AI w wyszukiwarce nie odpowie na samo pytanie.
// Każda dobra odpowiedź to points pkt (pole `points` przy pytaniu). art.photo — zdjęcie bez kołysania.
const searchTriviaQuiz = {
  id: 'wyszukiwanie-informacji/quiz-ciekawostki',
  title: 'Quiz: Ciekawostki z sieci',
  questions: [
    {
      type: 'choices',
      layout: 'abcd',
      label: 'A',
      rewardGif: 'assets/reward-gifs/bird-cute.gif',
      prompt: 'Znajdź odpowiedź w internecie',
      hint: 'Poziom: łatwy ⭐ · To dwa pytania w jednym. Wyszukaj każde zwierzę osobno, a potem dodaj wyniki.',
      art: {
        image: 'assets/quiz-art/pszczola-pajak.svg',
        alt: 'Pszczoła przy kwiatku i pająk krzyżak wiszący na nitce.',
        bubbles: [{ text: 'Bzzz!', tone: 'good' }, { text: 'Policz nasze oczy!', tone: 'maybe' }],
        caption: 'Pszczoła i pająk krzyżak'
      },
      options: [
        { id: 'a', label: '10' },
        { id: 'b', label: '13' },
        { id: 'c', label: '16' },
        { id: 'd', label: '18' }
      ],
      items: [
        {
          text: 'Ile oczu mają razem pszczoła i pająk krzyżak?',
          answer: 'b',
          points: 10,
          explain: 'Pszczoła ma 5 oczu (2 duże złożone i 3 małe przyoczka), a krzyżak — 8. Razem: 5 + 8 = 13.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'B',
      rewardGif: 'assets/reward-gifs/spongebob.gif',
      prompt: 'Znajdź odpowiedź w internecie',
      hint: 'Poziom: łatwy ⭐ · Najpierw sprawdź, gdzie jest ten wodospad. Potem znajdź stolicę tego kraju.',
      art: {
        image: 'assets/quiz-art/wodospad.svg',
        alt: 'Bardzo wysoki wodospad spadający ze stromej góry w dżungli.',
        bubbles: [{ text: 'Szszsz!', tone: 'good' }, { text: 'Gdzie to jest?', tone: 'maybe' }],
        caption: 'Najwyższy wodospad świata spada ze stromej góry w dżungli.'
      },
      options: [
        { id: 'a', label: 'Bogota' },
        { id: 'b', label: 'Lima' },
        { id: 'c', label: 'Quito' },
        { id: 'd', label: 'Caracas' }
      ],
      items: [
        {
          text: 'Jaka jest stolica państwa, w którym znajduje się najwyższy wodospad świata?',
          answer: 'd',
          points: 10,
          explain: 'Najwyższy wodospad świata to Salto Ángel (prawie 1000 m). Leży w Wenezueli, a stolicą Wenezueli jest Caracas.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'C',
      rewardGif: 'assets/reward-gifs/dance-hamster.gif',
      prompt: 'Znajdź odpowiedź w internecie',
      hint: 'Poziom: średni ⭐⭐ · Znajdź datę startu każdego z tych statków i policz, ile dni minęło.',
      art: {
        image: 'assets/quiz-art/sputnik.svg',
        alt: 'Satelita w kształcie kuli z antenami i pies w hełmie kosmicznym nad Ziemią.',
        bubbles: [{ text: 'Hau!', tone: 'good' }, { text: 'Bip-bip!', tone: 'maybe' }],
        caption: 'Sputnik 1 i Łajka'
      },
      options: [
        { id: 'a', label: '30 dni' },
        { id: 'b', label: '7 dni' },
        { id: 'c', label: '100 dni' },
        { id: 'd', label: '1 rok' }
      ],
      items: [
        {
          text: 'Pies Łajka poleciał na orbitę statkiem Sputnik 2. Ile dni wcześniej wystartował Sputnik 1 — pierwszy sztuczny satelita Ziemi?',
          answer: 'a',
          points: 10,
          explain: 'Sputnik 1 wystartował 4 października 1957 r., a Sputnik 2 z Łajką — 3 listopada 1957 r. Minęło 30 dni.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'D',
      rewardGif: 'assets/reward-gifs/jaw-drop-bullet.gif',
      prompt: 'Znajdź odpowiedź w internecie',
      hint: 'Poziom: średni ⭐⭐ · Potrzebujesz dwóch wysokości. Znajdź obie i odejmij.',
      art: {
        image: 'assets/quiz-art/gory-jezioro.svg',
        alt: 'Jezioro w górach, a nad nim wysoki szczyt z flagą.',
        bubbles: [{ text: 'Ile metrów?', tone: 'maybe' }],
        caption: 'Od jeziora na najwyższy szczyt'
      },
      options: [
        { id: 'a', label: '604 m' },
        { id: 'b', label: '804 m' },
        { id: 'c', label: '1104 m' },
        { id: 'd', label: '1504 m' }
      ],
      items: [
        {
          text: 'O ile metrów wyżej od jeziora Morskie Oko leży najwyższy szczyt Polski?',
          answer: 'c',
          points: 10,
          explain: 'Najwyższy szczyt Polski to Rysy (2499 m n.p.m.), a Morskie Oko leży na wysokości 1395 m n.p.m. 2499 − 1395 = 1104 m.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'E',
      rewardGif: 'assets/reward-gifs/shia-labeouf-clapping.gif',
      prompt: 'Znajdź odpowiedź w internecie',
      hint: 'Poziom: trudny ⭐⭐⭐ · Kliknij portret prawym przyciskiem myszy i wybierz „Wyszukaj obraz w Google”. Gdy już wiesz, kto to, znajdź dwie daty i policz.',
      art: {
        image: 'assets/quiz-art/portret-1.jpg',
        photo: true,
        alt: 'Portret mężczyzny w czerwonym stroju.',
        bubbles: [{ text: 'Kim jestem?', tone: 'maybe' }],
        caption: 'Portret z XVI wieku'
      },
      options: [
        { id: 'a', label: '55 lat' },
        { id: 'b', label: '70 lat' },
        { id: 'c', label: '85 lat' },
        { id: 'd', label: '100 lat' }
      ],
      items: [
        {
          text: 'Ile lat miał mężczyzna z portretu, gdy wydrukowano jego najważniejszą książkę?',
          answer: 'b',
          points: 10,
          explain: 'To Mikołaj Kopernik — astronom, który „wstrzymał Słońce, ruszył Ziemię”. Urodził się w 1473 r., a jego dzieło „O obrotach sfer niebieskich” wydrukowano w 1543 r. 1543 − 1473 = 70 lat.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'F',
      rewardGif: 'assets/reward-gifs/ufc.gif',
      prompt: 'Znajdź odpowiedź w internecie',
      hint: 'Poziom: trudny ⭐⭐⭐ · Najpierw dowiedz się, kim jest kobieta ze zdjęcia. Sposób wybierz sam!',
      art: {
        image: 'assets/quiz-art/portret-2.jpg',
        photo: true,
        alt: 'Zdjęcie starszej kobiety w mundurze.',
        bubbles: [{ text: 'Kim jestem?', tone: 'maybe' }],
        caption: 'Zdjęcie z 1984 roku'
      },
      options: [
        { id: 'a', label: 'Kontradmirał' },
        { id: 'b', label: 'Kapral' },
        { id: 'c', label: 'Kapitan' },
        { id: 'd', label: 'Generał' }
      ],
      items: [
        {
          text: 'Jaki najwyższy stopień wojskowy zdobyła kobieta ze zdjęcia?',
          answer: 'a',
          points: 10,
          explain: 'To Grace Hopper — słynna informatyczka. Rozsławiła historię o ćmie znalezionej w 1947 r. w komputerze Mark II, od której błędy w programach nazywamy „bugami”. Służyła w marynarce wojennej USA i doszła do stopnia kontradmirała.'
        }
      ]
    }
  ]
};

const searchDetectiveQuiz = {
  id: 'wyszukiwanie-informacji/quiz-tropiciel',
  title: 'Quiz: Tropiciel informacji',
  questions: [
    {
      type: 'choices',
      layout: 'abcd',
      label: 'A',
      rewardGif: 'assets/reward-gifs/spongebob-meme.gif',
      prompt: 'Znajdź miejsce ze zdjęcia',
      hint: 'Poziom: łatwy ⭐ · Poszukaj na zdjęciu nazwy ulicy i adresu. Znajdź to miejsce w Mapach Google, kliknij je prawym przyciskiem myszy — współrzędne pojawią się na górze menu.',
      art: {
        image: 'assets/quiz-art/mapa-google.png',
        photo: true,
        wide: true,
        alt: 'Zdjęcie z Google Street View: chodnik, trawnik, słup z reklamą apteki i tabliczka z nazwą ulicy.',
        caption: 'Gdzie zrobiono to zdjęcie?'
      },
      options: [
        { id: 'a', label: '52.2297, 21.0122' },
        { id: 'b', label: '50.0168, 19.9506' },
        { id: 'c', label: '54.3520, 18.6466' },
        { id: 'd', label: '49.2992, 19.9496' }
      ],
      items: [
        {
          text: 'Jakie są współrzędne miejsca ze zdjęcia?',
          answer: 'b',
          points: 10,
          explain: 'Na tabliczce widać ulicę Beskidzką, a na reklamie apteki adres „ul. Beskidzka 30/5”. To Kraków-Kurdwanów: 50.0168, 19.9506. Pozostałe współrzędne to Warszawa, Gdańsk i Zakopane — nawet jeśli klikniesz kilka kroków obok, wynik będzie bardzo blisko poprawnej odpowiedzi.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'B',
      rewardGif: 'assets/reward-gifs/kamil.gif',
      prompt: 'Znajdź książkę w bibliotece',
      hint: 'Poziom: średni ⭐⭐ · Wejdź do katalogu Biblioteki Kraków: krakow-biblioteka.sowa.pl. Wpisz tytuł i rozwiń informację o tym, które filie mają książkę. Inne katalogi: katalog.nukat.edu.pl (biblioteki naukowe) i katalogi.bn.org.pl (Biblioteka Narodowa).',
      art: {
        image: 'assets/quiz-art/szpieg-ksiazka.svg',
        alt: 'Regał z kolorowymi książkami, a na środku czarna książka z kapeluszem szpiega i lupą.',
        bubbles: [{ text: 'Ściśle tajne!', tone: 'maybe' }],
        caption: '„Jak zostać szpiegiem. Podręcznik tajnego agenta”'
      },
      options: [
        { id: 'a', label: 'ul. Gołaśka 13, Kraków' },
        { id: 'b', label: 'ul. Por. Halszki 1, Kraków' },
        { id: 'c', label: 'ul. Walerego Sławka 10, Kraków' },
        { id: 'd', label: 'ul. Łużycka 55, Kraków' }
      ],
      items: [
        {
          text: 'W której z tych bibliotek wypożyczysz książkę „Jak zostać szpiegiem. Podręcznik tajnego agenta” (Daniel Nesquens)?',
          answer: 'd',
          points: 10,
          explain: 'Z tych czterech filii Biblioteki Kraków tylko Filia nr 40 przy ul. Łużyckiej 55 ma tę książkę. Katalog online pokazuje, gdzie jest książka, zanim wyjdziesz z domu.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'C',
      rewardGif: 'assets/reward-gifs/spongebob-dancing.gif',
      prompt: 'Znajdź najbliższe schronienie',
      hint: 'Poziom: średni ⭐⭐ · Wejdź na stronę gdziesieukryc.pl. Na mapie znajdź naszą szkołę i sprawdź, który punkt schronienia jest najbliżej.',
      art: {
        image: 'assets/quiz-art/schron.svg',
        alt: 'Wejście do schronu na osiedlu, nad nim pomarańczowy znak z niebieskim trójkątem.',
        bubbles: [{ text: 'Gdzie się ukryć?', tone: 'maybe' }],
        caption: 'Znak obrony cywilnej'
      },
      options: [
        { id: 'a', label: 'ul. Królewska 57, Kraków' },
        { id: 'b', label: 'os. Teatralne 4, Kraków' },
        { id: 'c', label: 'ul. Dobczycka 20, Kraków' },
        { id: 'd', label: 'ul. Mogilska 25, Kraków' }
      ],
      items: [
        {
          text: 'Sprawdź na gdziesieukryc.pl: gdzie jest najbliższy punkt schronienia, licząc od naszej szkoły?',
          answer: 'c',
          points: 10,
          explain: 'Najbliższy punkt schronienia jest przy ul. Dobczyckiej 20. Warto znać takie miejsce w swojej okolicy — w razie zagrożenia nie trzeba go wtedy szukać.'
        }
      ]
    },
    {
      type: 'choices',
      layout: 'abcd',
      label: 'D',
      rewardGif: 'assets/reward-gifs/cat-dance-cat.gif',
      prompt: 'Znajdź badanie naukowe',
      hint: 'Poziom: trudny ⭐⭐⭐ · Wejdź na scholar.google.com. Zwykłe Google szuka wszystkich stron w internecie, a Google Scholar tylko prac naukowych: artykułów, książek i prac dyplomowych. Badanie jest po angielsku — skopiuj jego fragment do translate.google.com, a tłumacz zamieni go na polski.',
      tip: {
        title: 'Jak szukać w Google Scholar?',
        steps: [
          'Prace naukowe są zwykle po angielsku, więc wpisuj słowa po angielsku, np. `bees honey` zamiast „pszczoły miód”.',
          '`author:` — prace danego autora, np. `author:Kowalski`. Dokładniej będzie z inicjałem imienia w cudzysłowie: `author:"J Kowalski"`. Uwaga: piszemy author, a nie autor!',
          'Kilku autorów naraz? Wpisz author: kilka razy, np. `author:Kowalski author:Nowak` — to dobry sposób, gdy wyników jest za dużo.',
          'Temat i autora możesz połączyć: `bees author:Kowalski`.',
          'Cudzysłów szuka dokładnego wyrażenia: `"honey bee"` znajdzie prace, w których te słowa stoją obok siebie.',
          '`intitle:` — słowo musi być w tytule pracy, np. `intitle:panda`.',
          'Minus wyklucza słowo: `panda -red` pominie prace o pandzie rudej.',
          '`OR` — jedno albo drugie słowo (wielkimi literami!): `lion OR tiger`.',
          '`source:` — prace z jednego czasopisma, np. `source:Nature`.',
          'W menu po lewej wybierzesz lata, np. „Od 2010”, albo „Sortuj według daty”.',
          'Pod każdym wynikiem są autorzy, rok i napis „Cytowane przez 120”. To znaczy, że 120 innych prac korzystało z tego badania — im więcej, tym ważniejsze badanie.',
          'Pełny tekst często otworzysz linkiem [HTML] lub [PDF] po prawej stronie wyniku. Kliknięcie tytułu czasem pokazuje tylko streszczenie (abstract).'
        ]
      },
      art: {
        image: 'assets/quiz-art/koala-drzewo.svg',
        alt: 'Koala przytulony do pnia drzewa w gorący dzień, obok termometr.',
        bubbles: [{ text: 'Uff, gorąco!', tone: 'maybe' }],
        caption: 'Badanie z 2014 roku: dlaczego koale przytulają drzewa?'
      },
      options: [
        { id: 'a', label: 'o 1,9 °C' },
        { id: 'b', label: 'o 5,1 °C' },
        { id: 'c', label: 'o 8,9 °C' },
        { id: 'd', label: 'o 15 °C' }
      ],
      items: [
        {
          text: 'Na podstawie badania z 2014 roku autorstwa N. J. Briscoe i M. R. Kearney, które ma ponad 100 cytowań, odpowiedz: o ile stopni chłodniejszy od powietrza był pień akacji (mearnsii), do którego przytulały się koale (podaj największą różnicę)?',
          answer: 'c',
          points: 10,
          explain: 'To praca „Tree-hugging koalas demonstrate a novel thermoregulatory mechanism for arboreal mammals” (Briscoe i in., 2014). W upały koale przytulały się do pni akacji, które były nawet o 8,9 °C chłodniejsze od powietrza (średnio o 6,7 °C). Tak się chłodzą!'
        }
      ]
    }
  ]
};
