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
  rewardGif: 'assets/reward-gifs/corgi.gif',
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
  rewardGif: 'assets/reward-gifs/dicaprio-toast.gif',
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
  reward: 30,
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
  rewardGif: 'assets/reward-gifs/winnie-the-pooh-movie.gif',
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
  rewardGif: 'assets/reward-gifs/dance-tanec.gif',
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
  rewardGif: 'assets/reward-gifs/mr-bean.gif',
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
  rewardGif: 'assets/reward-gifs/tom-jerry.gif',
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
  rewardGif: 'assets/reward-gifs/cat-dance-sofa.gif',
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
  rewardGif: 'assets/reward-gifs/otter.gif',
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
  rewardGif: 'assets/reward-gifs/kevin-dance.gif',
  layout: '<img class="ct-art" src="assets/task-art/hoc-angry-birds.png" width="402" height="406" alt="Labirynt z czerwonym ptakiem Angry Birds i zieloną świnką" />',
  steps: []
};

// Gra „Kod Robota”: dziecko wpisuje program w GDScript (język Godota), a robot wykonuje go na planszy.
// Mapa: # ściana, . podłoga, R robot, G kryształ, F flaga, S tabliczka, ~ most we mgle (gdy poziom ma sign — skarb do wykopania dig()).
// Cel: zebrać wszystkie kryształy (pick()) i stanąć na fladze.
// concept — nowe pojęcie wyjaśnione nad edytorem (name, text w HTML, code — krótki przykład).
// task — jedno krótkie polecenie, hint — podpowiedź (HTML), buttons — polecenia do wstawienia kliknięciem.
// stars — [na 3 gwiazdki, na 2 gwiazdki]: najwięcej niepustych linii kodu (bez komentarzy).
// ready — kod musi być w func _ready():, forbid — polecenia zakazane na poziomie, starter — kod na start.
// solution — wzorcowe rozwiązanie (niewyświetlane, sprawdzane testem), fact — „Czy wiesz?” po przejściu poziomu.
const codeRobotGame = {
  type: 'code',
  id: 'programowanie/gra-kod-robota',
  title: 'Gra: Kod Robota',
  prompt: 'Zaprogramuj robota w GDScript',
  reward: 60,
  levels: [
    {
      title: 'Pierwsze kroki',
      concept: { name: 'Polecenie', text: '<code>move_right()</code> to polecenie: robot robi jeden krok w prawo. Nawiasy <code>()</code> mówią „zrób to teraz”. Robot wykonuje polecenia po kolei, od góry do dołu.', code: 'move_right()\nmove_right()' },
      task: 'Doprowadź robota do flagi.',
      hint: 'Kliknij polecenie pod edytorem albo wpisz je sam. Każde polecenie w osobnej linii, potem ▶ Uruchom.',
      fact: 'Godot to darmowy silnik do tworzenia gier. Programuje się w nim w języku GDScript — właśnie go piszesz!',
      buttons: ['move_right()', 'move_left()', 'move_up()', 'move_down()'],
      stars: [3, 4],
      starter: '',
      map: [
        '########',
        '#......#',
        '#R..F..#',
        '#......#',
        '##....##',
        '########'
      ],
      solution: 'move_right()\nmove_right()\nmove_right()'
    },
    {
      title: 'Zakręt',
      concept: { name: 'Kolejność poleceń', text: 'Program to lista kroków. Robot wykonuje je dokładnie w tej kolejności, w jakiej je napiszesz — najpierw pierwsza linia, potem druga…', code: 'move_right()\nmove_down()' },
      task: 'Doprowadź robota do flagi za zakrętem.',
      hint: 'Do góry to <code>move_up()</code>, w dół to <code>move_down()</code>.',
      buttons: ['move_right()', 'move_left()', 'move_up()', 'move_down()'],
      stars: [6, 8],
      starter: '',
      map: [
        '########',
        '#R...###',
        '####.###',
        '####.###',
        '####F###',
        '########'
      ],
      solution: 'move_right()\nmove_right()\nmove_right()\nmove_down()\nmove_down()\nmove_down()'
    },
    {
      title: 'Funkcja _ready',
      concept: { name: 'Funkcja i wcięcie', text: '<code>func _ready():</code> to funkcja — paczka poleceń z nazwą. Polecenia, które do niej należą, piszemy pod nią z <b>wcięciem</b> (klawisz Tab).', code: 'func _ready():\n\tmove_up()' },
      task: 'Napisz polecenia wewnątrz func _ready():',
      hint: 'W Godocie program zaczyna się od <code>func _ready():</code>. Polecenia pod nią przesuń w prawo klawiszem <b>Tab</b> — to wcięcie.',
      fact: 'Godot sam wywołuje func _ready(), gdy postać pojawia się w grze. Dlatego tam piszemy, co ma zrobić na start.',
      buttons: ['move_right()', 'move_left()', 'move_up()', 'move_down()'],
      stars: [6, 8],
      ready: true,
      starter: 'func _ready():\n',
      map: [
        '########',
        '########',
        '#...F###',
        '#.######',
        '#R######',
        '########'
      ],
      solution: 'func _ready():\n\tmove_up()\n\tmove_up()\n\tmove_right()\n\tmove_right()\n\tmove_right()'
    },
    {
      title: 'Pętla for',
      concept: { name: 'Pętla for', text: 'Pętla powtarza polecenia. <code>for i in 3:</code> wykona 3 razy wszystko, co jest pod nią z wcięciem.', code: 'for i in 3:\n\tmove_right()' },
      task: 'Dojdź do flagi, pisząc move_right() tylko raz.',
      hint: '<code>for i in 5:</code> powtarza 5 razy wszystko, co jest pod nim z wcięciem.',
      fact: 'W GDScript wcięcie to nie ozdoba — pokazuje, które polecenia są w środku pętli.',
      buttons: ['move_right()', 'move_up()', 'for i in 5:'],
      stars: [3, 5],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        '########',
        '#......#',
        '#R....F#',
        '#......#',
        '########',
        '########'
      ],
      solution: 'func _ready():\n\tfor i in 5:\n\t\tmove_right()'
    },
    {
      title: 'Kryształy',
      concept: { name: 'Kilka poleceń w pętli', text: 'W pętli może być więcej poleceń. Wszystkie z tym samym wcięciem powtarzają się razem, po kolei.', code: 'for i in 3:\n\tmove_right()\n\tpick()' },
      task: 'Zbierz wszystkie kryształy i dojdź do flagi.',
      hint: '<code>pick()</code> podnosi kryształ z pola, na którym stoi robot. W pętli może być kilka poleceń.',
      buttons: ['move_right()', 'pick()', 'for i in 5:'],
      stars: [5, 7],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        '########',
        '#......#',
        'RGGGGGF#',
        '#......#',
        '########',
        '########'
      ],
      solution: 'func _ready():\n\tfor i in 5:\n\t\tmove_right()\n\t\tpick()\n\tmove_right()'
    },
    {
      title: 'Schody',
      concept: { name: 'Pętla w pętli', text: 'Pętlę można włożyć do innej pętli. Wewnętrzna wykona się cała przy każdym obrocie zewnętrznej. Dostaje inną nazwę, np. <code>j</code>.', code: 'for i in 2:\n\tfor j in 3:\n\t\tmove_right()' },
      task: 'Wejdź po schodach na flagę.',
      hint: 'Pętla może być w pętli. Wewnętrzna potrzebuje innej nazwy, np. <code>for j in 3:</code>',
      buttons: ['move_right()', 'move_up()', 'for i in 2:'],
      stars: [6, 8],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        '########',
        '######F#',
        '######.#',
        '###....#',
        '###.####',
        'R...####'
      ],
      solution: 'func _ready():\n\tfor i in 2:\n\t\tfor j in 3:\n\t\t\tmove_right()\n\t\tfor j in 2:\n\t\t\tmove_up()'
    },
    {
      title: 'Czy tu jest kryształ?',
      concept: { name: 'Warunek if', text: '<code>if</code> znaczy „jeśli”. Polecenia pod nim wykonają się tylko wtedy, gdy warunek jest prawdziwy.', code: 'if is_gem():\n\tpick()' },
      task: 'Zbierz kryształy, choć nie leżą na każdym polu.',
      hint: '<code>if is_gem():</code> sprawdza, czy pod robotem leży kryształ. Polecenia pod nim wykonają się tylko wtedy.',
      fact: 'Warunek if to podstawa każdej gry: jeśli gracz dotknie monety, dostaje punkt.',
      buttons: ['move_right()', 'pick()', 'for i in 7:', 'if is_gem():'],
      stars: [5, 7],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        '########',
        '#......#',
        'R.GG.G.F',
        '#......#',
        '########'
      ],
      solution: 'func _ready():\n\tfor i in 7:\n\t\tmove_right()\n\t\tif is_gem():\n\t\t\tpick()'
    },
    {
      title: 'Ściana',
      concept: { name: 'if … else', text: '<code>else</code> znaczy „w przeciwnym razie”. Gdy warunek w if nie jest prawdziwy, robot robi to, co jest pod else.', code: 'if is_wall_right():\n\tmove_down()\nelse:\n\tmove_right()' },
      task: 'Dojdź do flagi krętą drogą.',
      hint: 'Jeśli z prawej jest ściana, idź w dół, w przeciwnym razie w prawo: <code>if is_wall_right():</code> … <code>else:</code> …',
      buttons: ['move_right()', 'move_down()', 'if is_wall_right():', 'else:'],
      stars: [6, 9],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        'R..#####',
        '##...###',
        '####.###',
        '####...#',
        '######.#',
        '######.F'
      ],
      solution: 'func _ready():\n\tfor i in 12:\n\t\tif is_wall_right():\n\t\t\tmove_down()\n\t\telse:\n\t\t\tmove_right()'
    },
    {
      title: 'Aż do flagi',
      concept: { name: 'Pętla while', text: '<code>while</code> znaczy „dopóki”. Powtarza polecenia tak długo, jak warunek jest prawdziwy. <code>not</code> odwraca warunek: „dopóki NIE stoisz na fladze”.', code: 'while not is_on_flag():\n\tmove_right()' },
      task: 'Doprowadź robota do flagi bez liczenia kroków.',
      hint: '<code>while not is_on_flag():</code> powtarza polecenia, dopóki robot nie stanie na fladze. Sprawdź też <code>is_wall_down()</code>.',
      fact: 'W grach jest func _process(): — Godot wywołuje ją kilkadziesiąt razy na sekundę, jak pętlę, która działa do końca gry.',
      buttons: ['while not is_on_flag():', 'if is_wall_down():', 'else:'],
      stars: [6, 9],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        'R...######',
        '###.######',
        '###.....##',
        '#######.##',
        '#######.##',
        '#######..F'
      ],
      solution: 'func _ready():\n\twhile not is_on_flag():\n\t\tif is_wall_down():\n\t\t\tmove_right()\n\t\telse:\n\t\t\tmove_down()'
    },
    {
      title: 'Zmienna',
      concept: { name: 'Zmienna', text: 'Zmienna to pudełko z nazwą, w którym robot chowa liczbę na później. <code>var n = read_sign()</code> robi dwie rzeczy: robot czyta tabliczkę 🪧 i wkłada przeczytaną liczbę do pudełka o nazwie <code>n</code>. Gdy dalej w programie napiszesz <code>n</code>, robot zajrzy do pudełka i przypomni sobie tę liczbę — nawet gdy już dawno zszedł z tabliczki.', code: 'var n = read_sign()\nfor i in n:\n\tmove_right()' },
      task: 'Wykop skarb ukryty we mgle.',
      hint: 'Tabliczka mówi, na którym polu mostu jest zakopany skarb, ale robot przeczyta ją tylko wtedy, gdy na niej stoi. Dlatego wejdź na nią i od razu zapamiętaj liczbę: <code>var n = read_sign()</code>. Na moście <code>for i in n:</code> zrobi tyle kroków, ile było na tabliczce, a <code>dig()</code> wykopie skarb. Liczba za każdym razem jest inna, więc nie wpisuj jej na sztywno!',
      fact: 'W grach zmienne pamiętają wszystko, co się zmienia: liczbę żyć, punkty, monety. Bez zmiennych gra niczego by nie pamiętała.',
      buttons: ['var n = read_sign()', 'for i in n:', 'dig()'],
      stars: [9, 11],
      ready: true,
      starter: 'func _ready():\n\t',
      // S — tabliczka z losową liczbą od min do max, ~ — most we mgle, skarb na n-tym polu mostu. Bez flagi: celem jest skarb.
      sign: { min: 2, max: 7 },
      map: [
        'R.S#######',
        '##.#######',
        '##.~~~~~~~'
      ],
      solution: 'func _ready():\n\tmove_right()\n\tmove_right()\n\tvar n = read_sign()\n\tmove_down()\n\tmove_down()\n\tfor i in n:\n\t\tmove_right()\n\tdig()'
    },
    {
      title: 'Własna funkcja',
      concept: { name: 'Własna funkcja', text: 'Możesz wymyślić własne polecenie: <code>func nazwa():</code>, a pod nią kroki z wcięciem. Potem wywołujesz je samą nazwą z nawiasami.', code: 'func skok():\n\tmove_up()\n\tmove_down()' },
      task: 'Przeskocz płotki, zbierz kryształy i dojdź do flagi.',
      hint: 'Pod <code>func _ready():</code> napisz bez wcięcia <code>func skok():</code> z ruchami skoku. Potem w _ready wywołuj <code>skok()</code>.',
      fact: 'Funkcje to Twoje własne polecenia. Postać w grze ma ich wiele, np. skok(), atak(), zbierz().',
      buttons: ['func skok():', 'skok()', 'pick()'],
      stars: [13, 16],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        '##########',
        '#.G.#.G.G.',
        'R.#...#.#F',
        '##########'
      ],
      solution: 'func _ready():\n\tmove_right()\n\tskok()\n\tmove_right()\n\tmove_right()\n\tskok()\n\tskok()\n\nfunc skok():\n\tmove_up()\n\tmove_right()\n\tpick()\n\tmove_right()\n\tmove_down()'
    },
    {
      title: 'Parametr',
      concept: { name: 'Parametr', text: 'Liczba w nawiasach to <b>parametr</b> — dodatkowa informacja dla funkcji. <code>move_right(5)</code> znaczy „idź w prawo 5 kroków”. Puste nawiasy <code>move_right()</code> to jeden krok.', code: 'move_right(5)\nmove_down(2)' },
      task: 'Dojdź do flagi, pisząc każdy prosty odcinek w jednej linii.',
      hint: 'Policz pola każdego prostego odcinka i wpisz tę liczbę w nawiasach, np. <code>move_right(6)</code>. Pomogą Ci numery nad planszą i obok niej.',
      fact: 'W grach parametry są wszędzie: tą samą funkcją postać może skoczyć nisko albo wysoko — zależnie od liczby w nawiasach.',
      buttons: ['move_right(2)', 'move_down(2)', 'move_left(2)'],
      stars: [6, 11],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      map: [
        'R......#',
        '######.#',
        '######.#',
        '##.....#',
        '##.#####',
        '##.....F'
      ],
      solution: 'func _ready():\n\tmove_right(6)\n\tmove_down(3)\n\tmove_left(4)\n\tmove_down(2)\n\tmove_right(5)'
    },
    {
      title: 'Jak w Godocie',
      concept: { name: 'Pozycja', text: 'Polecenia <code>move_right()</code>, <code>move_up()</code> i inne przygotował dla Ciebie robocik. Przez błąd zostały usunięte! W środku zmieniały one <code>position</code> robota: <code>move_right()</code> robiło <code>position.x += 1</code>, a <code>move_up()</code> robiło <code>position.y -= 1</code>. <code>x</code> to kolumna, <code>y</code> to wiersz, a oś y rośnie w dół. Teraz zrób to sam!', code: 'position.x += 1\nposition.y -= 1' },
      task: 'Dojdź do flagi, zmieniając tylko position.x i position.y.',
      hint: 'W Godocie postać ma <code>position</code>. Oś y rośnie w dół, więc w górę to <code>position.y -= 1</code>.',
      fact: 'W prawdziwym Godocie position liczy się w pikselach, więc postać przesuwa się np. o position.x += 64.',
      buttons: ['position.x += 1', 'position.y -= 1'],
      forbid: ['move_right', 'move_left', 'move_up', 'move_down'],
      stars: [4, 6],
      ready: true,
      starter: 'func _ready():\n\t',
      map: [
        '#####F##',
        '####..##',
        '###..###',
        '##..####',
        '#..#####',
        'R.######'
      ],
      solution: 'func _ready():\n\tfor i in 5:\n\t\tposition.x += 1\n\t\tposition.y -= 1'
    }
  ]
};

// Gra „Algorytmy Robota”: dalszy ciąg „Kodu Robota” — ten sam GDScript, ale zagadki to sławne algorytmy:
// sortowanie bąbelkowe, szukanie minimum, wyszukiwanie liniowe i binarne (dziel i rządź), najkrótsza droga (fala).
// Mapa jak w „Kodzie Robota”, plus B — skrzynka z liczbą (leży rząd pod drogą robota), S — tabliczka z liczbą do znalezienia.
// boxes — liczby na skrzynkach: tablica albo { max, sorted } (losowe różne od 1 do max, za każdym razem inne).
// goal — 'sorted', 'maxLast', 'min' albo 'sign'; hidden + maxOpen — zamknięte skrzynki, najwyżej tyle otwarć.
// maxMoves — najwięcej kroków robota, wave — na polach widać odległość od startu (algorytm fali).
// Pozostałe pola jak w codeRobotGame. Program z losowymi liczbami jest sprawdzany na wielu ułożeniach.
// explain — rozwijane wyjaśnienie algorytmu krok po kroku ({ title, html }).
// algoRow — rządek skrzynek do wyjaśnień: hot — zielone (właśnie porównywane albo na swoim miejscu), out — szare (odpadły).
const algoRow = (values, hot = [], out = []) => `<span class="cg-explain-row">${values.map((value, i) =>
  `<span${hot.includes(i) ? ' class="is-hot"' : out.includes(i) ? ' class="is-out"' : ''}>${value}</span>`).join('')}</span>`;
const algoBinary = [3, 5, 6, 9, 11, 12, 15, 17, 20, 23, 25, 28, 30, 34, 39];
const algoRange = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

const algorithmRobotGame = {
  type: 'code',
  id: 'programowanie/gra-algorytmy-robota',
  title: 'Gra: Algorytmy Robota',
  prompt: 'Naucz robota sławnych algorytmów',
  doneHint: 'Znasz już prawdziwe algorytmy: sortowanie bąbelkowe, szukanie minimum, wyszukiwanie liniowe i binarne oraz najkrótszą drogę.',
  reward: 60,
  legend: [
    { icon: '📦', name: 'Skrzynka', text: 'value() czyta jej liczbę' },
    { icon: '🪧', name: 'Tabliczka', text: 'read_sign() mówi, czego szukać' },
    { icon: '🚩', name: 'Flaga', text: 'dojdź najkrótszą drogą' }
  ],
  levels: [
    {
      title: 'Zamiana miejscami',
      explain: {
        title: 'Co to jest sortowanie? 🤔',
        html: `<ol>
          <li>Masz rząd liczb: ${algoRow([1, 2, 4, 3, 5])}</li>
          <li>Posortowane znaczy: każda następna liczba jest większa od poprzedniej — jak schody w górę.</li>
          <li>Tu schodek się psuje: 4 stoi przed 3. ${algoRow([1, 2, 4, 3, 5], [2, 3])}</li>
          <li>Zamień je miejscami i gotowe! ${algoRow([1, 2, 3, 4, 5])}</li>
        </ol>`
      },
      concept: { name: 'Sortowanie', text: '<b>Sortowanie</b> to układanie rzeczy po kolei, np. liczb od najmniejszej do największej. <code>swap()</code> zamienia miejscami skrzynkę pod robotem z sąsiadką z prawej.', code: 'move_right(2)\nswap()' },
      task: 'Ułóż skrzynki od najmniejszej do największej.',
      hint: 'Stań nad skrzynką, która jest nie na swoim miejscu, i zamień ją z sąsiadką: <code>swap()</code>.',
      fact: 'Sortowanie jest wszędzie: telefon układa kontakty alfabetycznie, a sklep internetowy — produkty od najtańszego.',
      buttons: ['move_right()', 'swap()'],
      stars: [3, 4],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      boxes: [1, 2, 4, 3, 5],
      goal: 'sorted',
      map: [
        'R....',
        'BBBBB'
      ],
      solution: 'func _ready():\n\tmove_right(2)\n\tswap()'
    },
    {
      title: 'Porównaj i zamień',
      explain: {
        title: 'Jak porównać dwie skrzynki? 🤔',
        html: `<ol>
          <li>Robot patrzy na skrzynkę pod sobą — <code>value()</code> — i na tę obok z prawej — <code>value_right()</code>.</li>
          <li>Lewa jest większa? Są źle ułożone, więc zamień: ${algoRow([7, 3], [0, 1])} → ${algoRow([3, 7])}</li>
          <li>Lewa jest mniejsza? Jest dobrze, nic nie rób: ${algoRow([2, 8])}</li>
          <li>Nie wiesz, jakie liczby wylosuje gra. Dlatego robot musi sam sprawdzić — do tego służy <code>if</code>.</li>
        </ol>`
      },
      concept: { name: 'Porównanie', text: '<code>value()</code> to liczba na skrzynce pod robotem, a <code>value_right()</code> — na skrzynce obok z prawej. Znak <code>&gt;</code> znaczy „większe niż”. Algorytm musi działać dla <b>każdych</b> liczb!', code: 'if value() > value_right():\n\tswap()' },
      task: 'Ułóż dwie skrzynki od mniejszej do większej.',
      hint: 'Liczby są za każdym razem inne. Zamień skrzynki tylko wtedy, gdy lewa jest większa niż prawa.',
      fact: 'Porównanie dwóch liczb i ewentualna zamiana to najmniejszy kawałek każdego algorytmu sortowania.',
      buttons: ['swap()', 'if value() > value_right():'],
      stars: [3, 4],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      boxes: { max: 9 },
      goal: 'sorted',
      map: [
        '##R.##',
        '##BB##'
      ],
      solution: 'func _ready():\n\tif value() > value_right():\n\t\tswap()'
    },
    {
      title: 'Bąbelek',
      explain: {
        title: 'Jak działa bąbelek? 🫧',
        html: `<ol>
          <li>Rząd na start: ${algoRow([5, 2, 8, 1])}</li>
          <li>Porównaj 5 i 2. Lewa większa — zamień: ${algoRow([5, 2, 8, 1], [0, 1])} → ${algoRow([2, 5, 8, 1])}</li>
          <li>Krok w prawo. Porównaj 5 i 8. Jest dobrze — nic nie rób: ${algoRow([2, 5, 8, 1], [1, 2])}</li>
          <li>Krok w prawo. Porównaj 8 i 1. Zamień: ${algoRow([2, 5, 8, 1], [2, 3])} → ${algoRow([2, 5, 1, 8])}</li>
          <li>Największa liczba 8 dojechała na koniec — jak bąbelek powietrza, który zawsze wypływa na górę.</li>
          <li>Przy 4 skrzynkach są 3 porównania. Przy 6 skrzynkach — 5.</li>
        </ol>`
      },
      concept: { name: 'Przejście przez rząd', text: 'Idź wzdłuż rzędu i porównuj sąsiadów. Gdy lewa liczba jest większa, zamień je. Największa liczba jedzie z robotem aż na koniec — jak bąbelek, który wypływa na powierzchnię. A czy da się tak samo przepchnąć <b>najmniejszą</b> liczbę na początek?', code: 'if value() > value_right():\n\tswap()' },
      task: 'Przesuń najmniejszą liczbę na początek rzędu. Uwaga: robot stoi na końcu!',
      hint: 'Robot zaczyna nad ostatnią skrzynką, a <code>swap()</code> zamienia tylko z sąsiadką z prawej. Pomyśl, w którą stronę ma iść robot i co zrobić najpierw: krok czy porównanie?',
      buttons: ['for i in 5:', 'if value() > value_right():', 'swap()', 'move_left()'],
      stars: [5, 7],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      boxes: { max: 9 },
      goal: 'minFirst',
      map: [
        '.....R',
        'BBBBBB'
      ],
      solution: 'func _ready():\n\tfor i in 5:\n\t\tmove_left()\n\t\tif value() > value_right():\n\t\t\tswap()'
    },
    {
      title: 'Sortowanie bąbelkowe',
      explain: {
        title: 'Jak działa sortowanie bąbelkowe? 🫧',
        html: `<ol>
          <li>Rząd na start: ${algoRow([4, 3, 2, 1])}</li>
          <li>1. przejście w prawo (jak bąbelek): 4 jedzie na koniec. ${algoRow([3, 2, 1, 4], [3])}</li>
          <li>Wróć na początek. 2. przejście: 3 jedzie aż do czwórki. ${algoRow([2, 1, 3, 4], [2, 3])}</li>
          <li>Wróć na początek. 3. przejście: 2 staje przed trójką. ${algoRow([1, 2, 3, 4], [0, 1, 2, 3])}</li>
          <li>Każde przejście stawia na miejscu jedną liczbę (zielone). Przy 4 skrzynkach wystarczą 3 przejścia, przy 6 — 5.</li>
          <li>W kodzie: jedno przejście to pętla <code>for i in 5:</code>, a powtarzanie przejść to druga pętla <code>for j in 5:</code> dookoła niej.</li>
        </ol>`
      },
      concept: { name: 'Sortowanie bąbelkowe', text: 'Jedno przejście stawia na końcu jedną największą liczbę. Wróć na początek i powtórz przejście — za każdym razem kolejna liczba trafia na swoje miejsce. Tak działa <b>sortowanie bąbelkowe</b>.', code: 'for j in 5:\n\t# jedno przejście\n\tmove_left(5)' },
      task: 'Ułóż wszystkie skrzynki od najmniejszej do największej.',
      hint: 'Włóż przejście z poprzedniego poziomu do drugiej pętli. Po każdym przejściu wróć na początek: <code>move_left(5)</code>.',
      fact: 'Sortowanie bąbelkowe jest proste, ale wolne. Komputery sortują szybciej, np. dzieląc rząd na połówki — to sortowanie przez scalanie.',
      buttons: ['for j in 5:', 'for i in 5:', 'if value() > value_right():', 'swap()', 'move_right()', 'move_left(5)'],
      stars: [7, 9],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      boxes: { max: 9 },
      goal: 'sorted',
      map: [
        'R.....',
        'BBBBBB'
      ],
      solution: 'func _ready():\n\tfor j in 5:\n\t\tfor i in 5:\n\t\t\tif value() > value_right():\n\t\t\t\tswap()\n\t\t\tmove_right()\n\t\tmove_left(5)'
    },
    {
      title: 'Najmniejsza liczba',
      explain: {
        title: 'Jak znaleźć najmniejszą liczbę? 🔍',
        html: `<ol>
          <li>To jak zabawa w króla: pierwsza liczba zostaje królem. <code>best</code> = 6 ${algoRow([6, 9, 3, 7, 2, 8], [0])}</li>
          <li>Idź dalej. 9 jest większe od króla — król zostaje.</li>
          <li>3 jest mniejsze! Nowy król: <code>best</code> = 3. Zapamiętaj też, gdzie stoi: <code>where</code>. ${algoRow([6, 9, 3, 7, 2, 8], [2])}</li>
          <li>7 — nie. 2 — mniejsze! Nowy król: <code>best</code> = 2. ${algoRow([6, 9, 3, 7, 2, 8], [4])}</li>
          <li>8 — nie. Koniec rzędu. Królem jest 2, a <code>where</code> mówi, gdzie stoi.</li>
          <li>Wróć tam: <code>go_to(where)</code> i wybierz skrzynkę: <code>choose()</code>.</li>
        </ol>`
      },
      concept: { name: 'Szukanie minimum', text: 'Zapamiętaj pierwszą liczbę w zmiennej <code>best</code> — na razie to najmniejsza. Idź dalej: gdy trafisz na mniejszą, zapamiętaj ją i jej miejsce <code>position.x</code>. Na końcu wróć tam: <code>go_to(where)</code> idzie do kolumny o tym numerze.', code: 'if value() < best:\n\tbest = value()\n\twhere = position.x' },
      task: 'Wybierz skrzynkę z najmniejszą liczbą.',
      hint: 'Zacznij od <code>var best = value()</code> i <code>var where = 0</code>. Po przejściu całego rzędu idź do <code>where</code> i napisz <code>choose()</code>.',
      fact: 'Sortowanie przez wybieranie: znajdź najmniejszą, połóż ją na początku i powtórz z resztą.',
      buttons: ['var best = value()', 'var where = 0', 'for i in 6:', 'move_right()', 'if value() < best:', 'go_to(where)', 'choose()'],
      stars: [10, 12],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      boxes: { max: 20 },
      goal: 'min',
      map: [
        'R......',
        'BBBBBBB'
      ],
      solution: 'func _ready():\n\tvar best = value()\n\tvar where = 0\n\tfor i in 6:\n\t\tmove_right()\n\t\tif value() < best:\n\t\t\tbest = value()\n\t\t\twhere = position.x\n\tgo_to(where)\n\tchoose()'
    },
    {
      title: 'Szukanie po kolei',
      explain: {
        title: 'Jak działa szukanie po kolei? 🔍',
        html: `<ol>
          <li>Tabliczka mówi: szukaj 7. Rząd: ${algoRow([4, 9, 7, 1, 5])}</li>
          <li>Czy to 7? Nie, to 4. Krok dalej. ${algoRow([4, 9, 7, 1, 5], [0])}</li>
          <li>Czy to 7? Nie, to 9. Krok dalej. ${algoRow([4, 9, 7, 1, 5], [1], [0])}</li>
          <li>Czy to 7? Tak! Stój i wybierz: <code>choose()</code>. ${algoRow([4, 9, 7, 1, 5], [2], [0, 1])}</li>
          <li>Czasem trafisz od razu, a czasem musisz przejść cały rząd — jak gdy szukasz skarpetki, zaglądając do szuflad po kolei.</li>
        </ol>`
      },
      concept: { name: 'Wyszukiwanie liniowe', text: 'Sprawdzaj skrzynki jedna po drugiej, aż trafisz na szukaną liczbę. Znak <code>!=</code> znaczy „różne od”: <code>while value() != n:</code> — idź dalej, dopóki to nie ta liczba.', code: 'while value() != n:\n\tmove_right()' },
      task: 'Wybierz skrzynkę z liczbą z tabliczki.',
      hint: 'Wejdź na tabliczkę i zapamiętaj liczbę: <code>var n = read_sign()</code>. Potem idź w prawo, dopóki <code>value() != n</code>, i wybierz skrzynkę: <code>choose()</code>.',
      fact: 'Tak szukasz zgubionej skarpetki: sprawdzasz szuflady po kolei. Gdy szuflad jest milion, trwa to bardzo długo!',
      buttons: ['move_right()', 'var n = read_sign()', 'while value() != n:', 'choose()'],
      stars: [6, 8],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\t',
      boxes: { max: 20 },
      sign: { box: true },
      goal: 'sign',
      map: [
        'RS.......',
        '#BBBBBBBB'
      ],
      solution: 'func _ready():\n\tmove_right()\n\tvar n = read_sign()\n\twhile value() != n:\n\t\tmove_right()\n\tchoose()'
    },
    {
      title: 'Dziel i rządź',
      explain: {
        title: 'Jak działa dziel i rządź? ✂️',
        html: `<ol>
          <li>To jak zgadywanka „Pomyślałem liczbę od 1 do 100. Więcej czy mniej?”. Najlepiej zawsze strzelać w środek!</li>
          <li>Szukasz 23. Skrzynki są ułożone od najmniejszej (tu widzisz liczby, robot ich nie widzi): ${algoRow(algoBinary)}</li>
          <li>Otwórz środkową — 8. skrzynkę. Jest 17. Szukasz 23, a to więcej, więc wszystko na lewo odpada! ${algoRow(algoBinary, [7], algoRange(0, 6))}</li>
          <li>Zostały skrzynki od 9. do 15. Ich środek to 12. skrzynka. Jest 28 — za dużo, więc prawa strona odpada. ${algoRow(algoBinary, [11], [...algoRange(0, 7), ...algoRange(12, 14)])}</li>
          <li>Zostały skrzynki od 9. do 11. Środek to 10. skrzynka. Jest 23 — znalezione po 3 otwarciach! ${algoRow(algoBinary, [9], [...algoRange(0, 8), ...algoRange(10, 14)])}</li>
          <li>W kodzie: <code>left</code> i <code>right</code> to granice części, w której jeszcze może być liczba. Środek to <code>(left + right) / 2</code>. Gdy liczba w środku jest za mała: <code>left = mid + 1</code>. Gdy za duża: <code>right = mid - 1</code>.</li>
        </ol>`
      },
      concept: { name: 'Wyszukiwanie binarne', text: 'Skrzynki są zamknięte, ale ułożone od najmniejszej. Otwórz <b>środkową</b>. Jeśli szukana liczba jest większa, cała lewa połowa odpada; jeśli mniejsza — prawa. Za każdym razem zostaje połowa! To metoda <b>dziel i rządź</b>.', code: 'var mid = (left + right) / 2\ngo_to(mid)\nif value() < n:\n\tleft = mid + 1' },
      task: 'Znajdź liczbę z tabliczki, otwierając najwyżej 4 skrzynki.',
      hint: 'Pamiętaj w zmiennych, gdzie zaczyna się i kończy część, w której może być liczba: <code>var left = 1</code>, <code>var right = 15</code>. W pętli <code>while true:</code> otwieraj środkową. Gdy trafisz, <code>choose()</code> i <code>break</code>.',
      fact: 'Wyszukiwanie binarne znajdzie słowo w słowniku z milionem słów w 20 krokach. Szukanie po kolei potrzebowałoby nawet miliona!',
      buttons: ['var left = 1', 'var right = 15', 'while true:', 'var mid = (left + right) / 2', 'go_to(mid)', 'if value() == n:', 'elif value() < n:', 'else:', 'choose()', 'break'],
      stars: [15, 18],
      ready: true,
      moveSteps: true,
      starter: 'func _ready():\n\tmove_right()\n\tvar n = read_sign()\n\t',
      boxes: { max: 40, sorted: true },
      sign: { box: true },
      goal: 'sign',
      hidden: true,
      maxOpen: 4,
      map: [
        'RS..............',
        '#BBBBBBBBBBBBBBB'
      ],
      solution: 'func _ready():\n\tmove_right()\n\tvar n = read_sign()\n\tvar left = 1\n\tvar right = 15\n\twhile true:\n\t\tvar mid = (left + right) / 2\n\t\tgo_to(mid)\n\t\tif value() == n:\n\t\t\tchoose()\n\t\t\tbreak\n\t\telif value() < n:\n\t\t\tleft = mid + 1\n\t\telse:\n\t\t\tright = mid - 1'
    },
    {
      title: 'Fala',
      explain: {
        title: 'Jak działa algorytm fali? 🌊',
        html: `<ol>
          <li>Wylej wiadro wody na pole, gdzie stoi robot. Tam piszemy 0.</li>
          <li>Po chwili woda zalewa pola obok (w górę, w dół, w lewo, w prawo). Piszemy na nich 1.</li>
          <li>Po następnej chwili woda płynie dalej — nowe pola dostają 2, potem 3, 4…</li>
          <li>Ściany zatrzymują wodę. A na każde pole woda dopływa najpierw najkrótszą drogą.</li>
          <li>Gdy woda dotrze do flagi, liczba pod flagą mówi, ile najmniej kroków potrzeba.</li>
          <li>Jak znaleźć tę drogę? Idź od flagi wstecz, zawsze na pole z liczbą o 1 mniejszą, aż dojdziesz do robota. Potem napisz te kroki od robota do flagi.</li>
        </ol>`
      },
      concept: { name: 'Najkrótsza droga', text: 'Jak znaleźć najkrótszą drogę? Wylej wodę na start! Fala zalewa najpierw pola o 1 krok dalej, potem o 2 kroki… Liczba na polu mówi, po ilu najmniej krokach robot tam dojdzie. To <b>algorytm fali</b> (BFS).', code: 'move_down(4)\nmove_right(3)' },
      task: 'Dojdź do flagi najkrótszą drogą.',
      hint: 'Zobacz, jaka liczba jest pod flagą. Idź od flagi wstecz po coraz mniejszych liczbach aż do startu — tak wygląda najkrótsza droga.',
      fact: 'Nawigacja w telefonie szuka najkrótszej drogi podobnym sposobem — tylko jej „pola” to skrzyżowania, a kroki to kilometry.',
      buttons: ['move_right()', 'move_left()', 'move_up()', 'move_down()'],
      stars: [6, 8],
      ready: true,
      moveSteps: true,
      wave: true,
      maxMoves: 12,
      starter: 'func _ready():\n\t',
      map: [
        'R....#...',
        '.###.#.#.',
        '.#.....#.',
        '.#.###.#.',
        '...#....F',
        '##.#.###.',
        '.....#...'
      ],
      solution: 'func _ready():\n\tmove_right(4)\n\tmove_down(2)\n\tmove_right(2)\n\tmove_down(2)\n\tmove_right(2)'
    },
    {
      title: 'Najkrótsza droga',
      explain: {
        title: 'Jak policzyć falę w głowie? 🌊',
        html: `<ol>
          <li>Poprowadź palcem po planszy wszystkie drogi od robota do flagi.</li>
          <li>Policz kroki każdej drogi. Pomogą numery: z kolumny 2 do kolumny 8 to 8 − 2 = 6 kroków.</li>
          <li>Wybierz drogę, w której kroków jest najmniej.</li>
          <li>Możesz też w myślach pisać liczby fali jak na poprzednim poziomie: 1, 2, 3… aż do flagi.</li>
        </ol>`
      },
      concept: { name: 'Fala w głowie', text: 'Tym razem liczb nie widać. Wyobraź sobie falę, która rozlewa się ze startu, albo policz kroki każdej drogi. Wygrywa ta, w której kroków jest najmniej.' },
      task: 'Dojdź do flagi najkrótszą drogą.',
      hint: 'Liczby nad planszą i obok niej pomogą policzyć kroki. Krótsza droga nie zawsze jest tą, która na pierwszy rzut oka idzie prosto do flagi.',
      buttons: ['move_right()', 'move_left()', 'move_up()', 'move_down()'],
      stars: [6, 8],
      ready: true,
      moveSteps: true,
      maxMoves: 12,
      starter: 'func _ready():\n\t',
      map: [
        '.....#....',
        '.###.#.##.',
        'R..#...#..',
        '##.#####.#',
        '.........#',
        '.#####.#.F',
        '.......#..'
      ],
      solution: 'func _ready():\n\tmove_right(2)\n\tmove_down(2)\n\tmove_right(6)\n\tmove_down()\n\tmove_right()'
    }
  ]
};

// Zadanie „Programowanie”: w programie Godot ikonka Godota chodzi strzałkami. Zalicza kod nauczyciela.
const godotTask = {
  type: 'task',
  id: 'programowanie/zadanie-godot',
  title: 'Programowanie',
  prompt: 'Godot — postać chodzi strzałkami',
  hint: 'Otwórz program <b>Godot</b> i spraw, żeby ikonka Godota chodziła po ekranie <b>strzałkami</b>.',
  doneHint: 'Twoja ikonka Godota chodzi po ekranie strzałkami.',
  reward: 40,
  layout: '<img class="ct-art" src="assets/task-art/godot-strzalki.png" width="400" height="400" alt="Niebieski robot Godota idzie po ekranie gry, obok klawisze strzałek" />',
  steps: []
};

// Gotowe skrypty gry „Kod Planszy” (board-code-game.js). Robot chodzi dzięki robot.gd — tak jak w Godocie.
const boardRobotScript = [
  'extends CharacterBody2D',
  '',
  'var gems = 0',
  'var has_key = false',
  'var direction = Vector2.RIGHT',
  '',
  '# Godot woła _input przy każdym klawiszu.',
  'func _input(event):',
  '\tif event.is_action_pressed("ui_right"):',
  '\t\twalk(Vector2.RIGHT)',
  '\telif event.is_action_pressed("ui_left"):',
  '\t\twalk(Vector2.LEFT)',
  '\telif event.is_action_pressed("ui_up"):',
  '\t\twalk(Vector2.UP)',
  '\telif event.is_action_pressed("ui_down"):',
  '\t\twalk(Vector2.DOWN)',
  '',
  'func walk(dir):',
  '\tdirection = dir',
  '\tmove_and_collide(dir)'
].join('\n');
const boardRobotJumpLines = [
  '\telif event.is_action_pressed("ui_accept"):',
  '\t\tposition += direction * 2'
];
const boardRobotJumpScript = boardRobotScript.replace('\t\twalk(Vector2.DOWN)\n', `\t\twalk(Vector2.DOWN)\n${boardRobotJumpLines.join('\n')}\n`);
const boardDoorScript = [
  'extends StaticBody2D',
  '',
  '# Zamknięte drzwi zatrzymują robota.',
  'var is_open = false',
  '',
  'func open():',
  '\tis_open = true',
  '',
  'func close():',
  '\tis_open = false'
].join('\n');
const boardGoalScript = [
  'extends Area2D',
  '',
  'func _on_body_entered(body):',
  '\tget_tree().change_scene_to_file("res://next_level.tscn")'
].join('\n');
const boardGoalGemsScript = (count) => [
  'extends Area2D',
  '',
  'func _on_body_entered(body):',
  `\tif $Robot.gems < ${count}:`,
  '\t\tprint("Najpierw zbierz wszystkie klejnoty!")',
  '\t\treturn',
  '\tget_tree().change_scene_to_file("res://next_level.tscn")'
].join('\n');
const boardGemScript = [
  'extends Area2D',
  '',
  'func _on_body_entered(body):',
  '\t$Robot.gems += 1',
  '\tqueue_free()'
].join('\n');
const boardAreaStarter = (comment) => [
  'extends Area2D',
  '',
  `# ${comment}`,
  'func _on_body_entered(body):',
  '\tpass'
].join('\n');

// Gra „Kod Planszy”: robotem steruje się klawiszami W A S D, a dziecko programuje elementy planszy w GDScript.
// Mapa: # ściana, . podłoga, ~ woda, R robot, F meta, B przycisk, D drzwi, G klejnot, K klucz, L zamek,
// P portal, E wyjście portalu, = ukryty most na wodzie. Powtórzona litera to kolejne węzły: Gem, Gem2, Gem3.
// scripts — skrypty węzłów (<typ>.gd): code — kod na start, edit — dziecko może go zmieniać. open — skrypt otwarty na start.
// checks — sytuacje sprawdzane po dojściu do mety: keys (w a s d, spacja) od startu, potem node.prop musi być równe is;
// prop 'exists' — czy węzeł nie został usunięty, prop 'won' (bez node) — czy robot wygrał. fail — co powiedzieć, gdy jest inaczej.
// jump — pokazuje klawisz Spacja, countGems: false — bez licznika klejnotów w celach.
// goals — dodatkowe cele na liście: text i when — wszystkie warunki naraz: node.prop równe is (liczba, true/false, [x, y])
// albo min / max (co najmniej / co najwyżej). Spełniony cel zostaje odhaczony do końca sceny.
// unless — gdy te warunki choć raz zajdą naraz (np. drzwi otwarte bez klucza), cel nie odhaczy się w tej scenie.
// solution i path — wzorcowe skrypty i klawisze do mety (niewyświetlane, sprawdzane testem).
const boardCodeGame = {
  type: 'board',
  id: 'programowanie/gra-kod-planszy',
  title: 'Gra: Kod Planszy',
  prompt: 'Zaprogramuj planszę dla robota',
  reward: 60,
  levels: [
    {
      title: 'Przycisk',
      concept: {
        name: 'Sygnał',
        text: 'W Godocie każdy element gry to <b>węzeł</b>: robot, przycisk, drzwi, meta. Wszystkie węzły widać w panelu <b>Scena</b> — każdy ma swoją nazwę i może mieć własny skrypt. Gdy robot wejdzie na przycisk, Godot sam wywoła funkcję <code>_on_body_entered(body)</code> — to sygnał „ktoś wszedł”. <code>$Door</code> to węzeł o nazwie Door, a <code>$Door.open()</code> każe drzwiom wykonać ich funkcję <code>open()</code>.',
        code: 'func _on_body_entered(body):\n\t$Door.open()'
      },
      task: 'Zaprogramuj przycisk, żeby otwierał drzwi.',
      hint: 'Kliknij przycisk na planszy, żeby otworzyć jego skrypt. Zamiast <code>pass</code> wpisz <code>$Door.open()</code>. Potem ▶ Uruchom scenę i idź robotem po przycisku klawiszem <b>D</b>.',
      fact: 'W Godocie sygnał łączy się z funkcją w zakładce Węzeł → Sygnały. Godot sam nazywa ją wtedy _on_..._body_entered.',
      buttons: ['$Door.open()'],
      open: 'button.gd',
      map: [
        '#########',
        '#.....#..',
        '#R.B..D.F',
        '#.....#..',
        '#########'
      ],
      scripts: {
        'button.gd': { code: boardAreaStarter('Robot (body) wszedł na przycisk:'), edit: true },
        'door.gd': { code: boardDoorScript },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Przycisk otwiera drzwi 🚪', when: [{ node: 'Door', prop: 'is_open', is: true }] }
      ],
      checks: [
        { keys: '', node: 'Door', prop: 'is_open', is: false, fail: 'Drzwi otwierają się same, zanim robot stanie na przycisku. Otwieraj je w _on_body_entered(body).' }
      ],
      solution: { 'button.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\t$Door.open()' },
      path: 'ddddddd'
    },
    {
      title: 'Klejnoty',
      concept: {
        name: 'Jeden skrypt, wiele węzłów',
        text: 'Wszystkie klejnoty mają ten sam skrypt <code>gem.gd</code> — piszesz go raz, a działa w każdym. <code>$Robot</code> to węzeł robota, a <code>$Robot.gems</code> to jego licznik klejnotów (zmienna z robot.gd). <code>queue_free()</code> usuwa węzeł ze sceny — klejnot znika.',
        code: 'func _on_body_entered(body):\n\t$Robot.gems += 1\n\tqueue_free()'
      },
      task: 'Zaprogramuj klejnot, żeby robot mógł go zebrać.',
      hint: 'W <code>gem.gd</code>: <code>$Robot.gems += 1</code> dodaje robotowi klejnot, a <code>queue_free()</code> usuwa klejnot z planszy. Zajrzyj też do <code>goal.gd</code> — meta wpuści robota dopiero z trzema klejnotami.',
      fact: 'W prawdziwej grze monety i klejnoty to jedna scena wstawiona wiele razy. Poprawiasz skrypt raz — działają wszystkie.',
      buttons: ['$Robot.gems += 1', 'queue_free()'],
      open: 'gem.gd',
      map: [
        '##########',
        '#..G...G.#',
        '#R...G...F',
        '##########'
      ],
      scripts: {
        'gem.gd': { code: boardAreaStarter('Ten skrypt mają wszystkie klejnoty.'), edit: true },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalGemsScript(3) }
      },
      goals: [
        { text: 'Zebrane klejnoty znikają z planszy', when: [{ node: 'Gem', prop: 'exists', is: false }, { node: 'Gem2', prop: 'exists', is: false }, { node: 'Gem3', prop: 'exists', is: false }] }
      ],
      checks: [
        { keys: 'dddd', node: 'Robot', prop: 'gems', is: 1, fail: 'Za jeden klejnot robot dostał inną liczbę niż 1. Jeden klejnot to jeden punkt: $Robot.gems += 1' },
        { keys: 'ddddad', node: 'Robot', prop: 'gems', is: 1, fail: 'Robot wszedł dwa razy na ten sam klejnot i dostał go dwa razy. Po zebraniu klejnot musi zniknąć: queue_free()' }
      ],
      solution: { 'gem.gd': boardGemScript },
      path: 'ddwdsdddwsdd'
    },
    {
      title: 'Skarbiec',
      concept: {
        name: 'Warunek if',
        text: '<code>if</code> znaczy „jeśli”. Polecenia pod nim wykonają się tylko wtedy, gdy warunek jest prawdziwy. <code>$Robot.gems >= 3</code> znaczy „robot ma 3 klejnoty albo więcej”.',
        code: 'if $Robot.gems >= 3:\n\t$Door.open()'
      },
      task: 'Niech przycisk otwiera skarbiec tylko robotowi z 3 klejnotami.',
      hint: 'Przycisk już otwiera drzwi, ale każdemu. Dopisz nad <code>$Door.open()</code> warunek <code>if $Robot.gems >= 3:</code>, a <code>$Door.open()</code> przesuń pod niego klawiszem <b>Tab</b>.',
      fact: 'Tak działają drzwi w wielu grach: otwierają się dopiero, gdy gracz zbierze wszystkie gwiazdki.',
      buttons: ['if $Robot.gems >= 3:', '$Door.open()'],
      open: 'button.gd',
      map: [
        '###########',
        '#G......G##',
        '#R.....B.DF',
        '#...G....##',
        '###########'
      ],
      scripts: {
        'button.gd': { code: 'extends Area2D\n\nfunc _on_body_entered(body):\n\t$Door.open()', edit: true },
        'door.gd': { code: boardDoorScript },
        'gem.gd': { code: boardGemScript },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Przycisk otwiera drzwi 🚪 tylko z 3 💎', when: [{ node: 'Robot', prop: 'gems', is: 3 }, { node: 'Door', prop: 'is_open', is: true }], unless: [{ node: 'Door', prop: 'is_open', is: true }, { node: 'Robot', prop: 'gems', max: 2 }] }
      ],
      checks: [
        { keys: 'dddddd', node: 'Door', prop: 'is_open', is: false, fail: 'Robot stanął na przycisku bez klejnotów, a drzwi i tak się otworzyły. Sprawdź warunek: if $Robot.gems >= 3:' }
      ],
      solution: { 'button.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\tif $Robot.gems >= 3:\n\t\t$Door.open()' },
      path: 'wsdddswddddwsaddd'
    },
    {
      title: 'Klucz',
      concept: {
        name: 'Prawda i fałsz',
        text: '<code>has_key</code> to zmienna robota, która może być <code>true</code> (prawda) albo <code>false</code> (fałsz). Na początku robot nie ma klucza. <code>$Robot.has_key = true</code> daje mu klucz, a <code>if $Robot.has_key:</code> sprawdza, czy go ma.',
        code: '$Robot.has_key = true\nif $Robot.has_key:\n\t$Door.open()'
      },
      task: 'Zaprogramuj klucz i zamek przy drzwiach.',
      hint: 'Kliknij klucz 🔑: w <code>key.gd</code> daj robotowi klucz i usuń go z planszy. Potem kliknij zamek 🔒: w <code>lock.gd</code> otwórz drzwi tylko wtedy, gdy <code>$Robot.has_key</code>.',
      fact: 'true i false to typ bool. W grach pamiętają, czy gracz ma klucz, czy drzwi są otwarte, czy gra jest w pauzie.',
      buttons: ['$Robot.has_key = true', 'queue_free()', 'if $Robot.has_key:', '$Door.open()'],
      open: 'key.gd',
      map: [
        '###########',
        '#....K..#..',
        '#R.....LD.F',
        '#.......#..',
        '###########'
      ],
      scripts: {
        'key.gd': { code: boardAreaStarter('Klucz: daj go robotowi i zniknij.'), edit: true },
        'lock.gd': { code: boardAreaStarter('Zamek: otwórz drzwi robotowi z kluczem.'), edit: true },
        'door.gd': { code: boardDoorScript },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Robot podnosi klucz 🔑', when: [{ node: 'Robot', prop: 'has_key', is: true }, { node: 'Key', prop: 'exists', is: false }] },
        { text: 'Zamek 🔒 otwiera drzwi 🚪 tylko z kluczem', when: [{ node: 'Robot', prop: 'has_key', is: true }, { node: 'Door', prop: 'is_open', is: true }], unless: [{ node: 'Door', prop: 'is_open', is: true }, { node: 'Robot', prop: 'has_key', is: false }] }
      ],
      checks: [
        { keys: 'dddddd', node: 'Door', prop: 'is_open', is: false, fail: 'Robot bez klucza stanął przy zamku, a drzwi się otworzyły. W lock.gd sprawdź: if $Robot.has_key:' },
        { keys: 'ddddw', node: 'Key', prop: 'exists', is: false, fail: 'Klucz został na podłodze, choć robot go podniósł. Po podniesieniu usuń go: queue_free()' }
      ],
      solution: {
        'key.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\t$Robot.has_key = true\n\tqueue_free()',
        'lock.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\tif $Robot.has_key:\n\t\t$Door.open()'
      },
      path: 'ddddwsddddd'
    },
    {
      title: 'Trzy przyciski',
      concept: {
        name: 'Zmienna węzła',
        text: '<code>var pressed = false</code> napisane na górze skryptu, poza funkcją, to zmienna węzła. Każdy przycisk ma własną kopię i pamięta, czy już go naciśnięto. Gdy <code>pressed</code> jest <code>true</code>, przycisk świeci na zielono. <code>$Button2.pressed</code> to zmienna innego przycisku. <code>if</code> można wstawić w <code>if</code> — wtedy wewnętrzny sprawdza się tylko, gdy zewnętrzny jest prawdziwy.',
        code: 'var pressed = false\n\nfunc _on_body_entered(body):\n\tpressed = true'
      },
      task: 'Niech most pojawi się, gdy wszystkie trzy przyciski są naciśnięte.',
      hint: 'Przy wejściu robota ustaw <code>pressed = true</code> — przycisk zrobi się zielony. Potem sprawdź po kolei każdy przycisk: pod <code>if $Button.pressed:</code> wstaw <code>if $Button2.pressed:</code>, pod nim <code>if $Button3.pressed:</code>, a na samym dole <code>$Bridge.show()</code>. Każde kolejne polecenie wcinaj o jeden <b>Tab</b> więcej.',
      fact: 'Zmienne z góry skryptu Godot pokazuje w Inspektorze. Kliknij przycisk podczas gry i patrz, jak pressed zmienia się na true!',
      buttons: ['pressed = true', 'if $Button.pressed:', 'if $Button2.pressed:', 'if $Button3.pressed:', '$Bridge.show()'],
      open: 'button.gd',
      map: [
        '##########',
        '#B...~...#',
        '#R..B=...F',
        '#B...~...#',
        '##########'
      ],
      scripts: {
        'button.gd': { code: 'extends Area2D\n\n# Ten skrypt mają wszystkie trzy przyciski.\nvar pressed = false\n\nfunc _on_body_entered(body):\n\tpass', edit: true },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Naciśnięty przycisk zostaje zielony', when: [{ node: 'Button', prop: 'pressed', is: true }, { node: 'Button2', prop: 'pressed', is: true }, { node: 'Button3', prop: 'pressed', is: true }] },
        {
          text: 'Most 🌉 pojawia się po naciśnięciu wszystkich 3',
          when: [{ node: 'Button', prop: 'pressed', is: true }, { node: 'Button2', prop: 'pressed', is: true }, { node: 'Button3', prop: 'pressed', is: true }, { node: 'Bridge', prop: 'visible', is: true }],
          unless: ['Button', 'Button2', 'Button3'].map((node) => [{ node: 'Bridge', prop: 'visible', is: true }, { node, prop: 'pressed', is: false }])
        }
      ],
      checks: [
        { keys: 'ddd', node: 'Bridge', prop: 'visible', is: false, fail: 'Most pojawił się po jednym przycisku. Pokaż go dopiero, gdy wszystkie trzy mają pressed == true.' },
        { keys: 'dddadadad', node: 'Bridge', prop: 'visible', is: false, fail: 'Robot naciskał w kółko ten sam przycisk i most się pojawił. Sprawdź pressed każdego przycisku: $Button, $Button2 i $Button3.' }
      ],
      solution: { 'button.gd': 'extends Area2D\n\nvar pressed = false\n\nfunc _on_body_entered(body):\n\tpressed = true\n\tif $Button.pressed:\n\t\tif $Button2.pressed:\n\t\t\tif $Button3.pressed:\n\t\t\t\t$Bridge.show()' },
      path: 'wsswdddddddd'
    },
    {
      title: 'Wielki skarbiec',
      concept: {
        name: 'Wszystko razem',
        text: 'Ta plansza sprawdza wszystko, czego już się nauczyłeś: sygnał <code>_on_body_entered(body)</code>, zbieranie klejnotów z <code>queue_free()</code>, warunek <code>if</code>, klucz <code>has_key</code> i zmienną węzła <code>pressed</code>. Każdy element planszy trzeba zaprogramować sam — kliknij go, żeby otworzyć jego skrypt.'
      },
      task: 'Zbuduj most, zdobądź klucz, otwórz skarbiec i wejdź na metę z 3 klejnotami.',
      hint: 'Po kolei: <code>button.gd</code> — na górze skryptu dodaj zmienną <code>var pressed = false</code>, przy wejściu robota ustaw <code>pressed = true</code> i pokaż most <code>$Bridge.show()</code>, gdy oba przyciski są naciśnięte. <code>gem.gd</code> — dodaj robotowi klejnot i usuń klejnot. <code>key.gd</code> — daj robotowi klucz i usuń klucz. <code>lock.gd</code> — otwórz drzwi skarbca tylko robotowi z kluczem. <code>goal.gd</code> — wpuść na metę tylko robota z 3 klejnotami: dopisz <code>if</code>, a linię pod nim wetnij klawiszem <b>Tab</b>.',
      fact: 'Prawdziwe poziomy gier składają się z wielu małych skryptów. Każdy robi jedną rzecz, a razem tworzą zagadkę.',
      buttons: ['var pressed = false', 'pressed = true', 'if $Button.pressed:', 'if $Button2.pressed:', '$Bridge.show()', '$Robot.gems += 1', 'queue_free()', '$Robot.has_key = true', 'if $Robot.has_key:', '$Door.open()', 'if $Robot.gems >= 3:'],
      open: 'button.gd',
      map: [
        '#############',
        '#B..G.~.K.#G.',
        '#R....=...LDF',
        '#B..G.~...#..',
        '#############'
      ],
      scripts: {
        'button.gd': { code: boardAreaStarter('Ten skrypt mają oba przyciski.'), edit: true },
        'gem.gd': { code: boardAreaStarter('Ten skrypt mają wszystkie klejnoty.'), edit: true },
        'key.gd': { code: boardAreaStarter('Klucz: daj go robotowi i zniknij.'), edit: true },
        'lock.gd': { code: boardAreaStarter('Zamek: otwórz skarbiec robotowi z kluczem.'), edit: true },
        'goal.gd': { code: 'extends Area2D\n\n# Meta: wpuść tylko robota z 3 klejnotami.\nfunc _on_body_entered(body):\n\tget_tree().change_scene_to_file("res://next_level.tscn")', edit: true },
        'door.gd': { code: boardDoorScript },
        'robot.gd': { code: boardRobotScript }
      },
      goals: [
        {
          text: 'Most 🌉 pojawia się po naciśnięciu obu przycisków',
          when: [{ node: 'Button', prop: 'pressed', is: true }, { node: 'Button2', prop: 'pressed', is: true }, { node: 'Bridge', prop: 'visible', is: true }],
          unless: ['Button', 'Button2'].map((node) => [{ node: 'Bridge', prop: 'visible', is: true }, { node, prop: 'pressed', is: false }])
        },
        { text: 'Robot podnosi klucz 🔑', when: [{ node: 'Robot', prop: 'has_key', is: true }, { node: 'Key', prop: 'exists', is: false }] },
        { text: 'Zamek 🔒 otwiera skarbiec 🚪 tylko z kluczem', when: [{ node: 'Robot', prop: 'has_key', is: true }, { node: 'Door', prop: 'is_open', is: true }], unless: [{ node: 'Door', prop: 'is_open', is: true }, { node: 'Robot', prop: 'has_key', is: false }] },
        { text: 'Zebrane klejnoty 💎 znikają z planszy', when: [{ node: 'Gem', prop: 'exists', is: false }, { node: 'Gem2', prop: 'exists', is: false }, { node: 'Gem3', prop: 'exists', is: false }] }
      ],
      checks: [
        { keys: 'w', node: 'Bridge', prop: 'visible', is: false, fail: 'Most pojawił się po jednym przycisku. Pokaż go dopiero, gdy oba przyciski mają pressed == true.' },
        { keys: 'wsw', node: 'Bridge', prop: 'visible', is: false, fail: 'Robot nacisnął dwa razy ten sam przycisk i most się pojawił. Sprawdź pressed obu przycisków: $Button i $Button2.' },
        { keys: 'wdddad', node: 'Robot', prop: 'gems', is: 1, fail: 'Robot wszedł dwa razy na ten sam klejnot i dostał go dwa razy. Jeden klejnot to $Robot.gems += 1, a potem queue_free()' },
        { keys: 'wsswddddddwd', node: 'Key', prop: 'exists', is: false, fail: 'Klucz został na podłodze, choć robot go podniósł. Po podniesieniu usuń go: queue_free()' },
        { keys: 'wsswddddddddd', node: 'Door', prop: 'is_open', is: false, fail: 'Robot bez klucza stanął przy zamku, a skarbiec się otworzył. W lock.gd sprawdź: if $Robot.has_key:' },
        { keys: 'wsswddddddwdsdddd', prop: 'won', is: false, fail: 'Robot wszedł na metę bez klejnotów i wygrał. W goal.gd sprawdź: if $Robot.gems >= 3:' }
      ],
      solution: {
        'button.gd': 'extends Area2D\n\nvar pressed = false\n\nfunc _on_body_entered(body):\n\tpressed = true\n\tif $Button.pressed:\n\t\tif $Button2.pressed:\n\t\t\t$Bridge.show()',
        'gem.gd': boardGemScript,
        'key.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\t$Robot.has_key = true\n\tqueue_free()',
        'lock.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\tif $Robot.has_key:\n\t\t$Door.open()',
        'goal.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\tif $Robot.gems >= 3:\n\t\tget_tree().change_scene_to_file("res://next_level.tscn")'
      },
      path: 'wssdddwwsddddwdsddwsd'
    },
    {
      title: 'Teleport',
      concept: {
        name: 'Pozycja',
        text: '<code>position</code> to miejsce węzła na planszy: <code>Vector2</code>, czyli dwie liczby — <code>x</code> (kolumna) i <code>y</code> (wiersz). Liczby widać przy brzegach planszy. <code>$Robot.position = $Exit.position</code> przenosi robota tam, gdzie stoi wyjście portalu.',
        code: '$Robot.position = $Exit.position'
      },
      task: 'Zaprogramuj portal, żeby przenosił robota do wyjścia ✨.',
      hint: 'W <code>portal.gd</code> ustaw pozycję robota (<code>$Robot.position</code>) na pozycję wyjścia (<code>$Exit.position</code>). Kliknij wyjście ✨ i spójrz w Inspektor — zobaczysz jego position.',
      fact: 'W prawdziwym Godocie position liczy się w pikselach, a nie w kratkach — np. Vector2(320, 128).',
      buttons: ['$Robot.position = $Exit.position'],
      open: 'portal.gd',
      map: [
        '##########',
        '#R...#.E.#',
        '#...P#...F',
        '##########'
      ],
      scripts: {
        'portal.gd': { code: boardAreaStarter('Portal: przenieś robota do Exit.'), edit: true },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Portal 🌀 przenosi robota do wyjścia ✨', when: [{ node: 'Robot', prop: 'position', is: [7, 1] }] }
      ],
      solution: { 'portal.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\t$Robot.position = $Exit.position' },
      path: 'dddsdsd'
    },
    {
      title: 'Dwa przyciski',
      concept: {
        name: 'Funkcja innego węzła',
        text: 'W skrypcie drzwi możesz dopisać własną funkcję, np. <code>unlock()</code>. Inne węzły wołają ją tak samo jak <code>open()</code>: <code>$Door.unlock()</code>. Wewnątrz door.gd piszesz samo <code>open()</code>, bo to funkcja tego samego węzła.',
        code: 'func unlock():\n\tlocks -= 1\n\tif locks == 0:\n\t\topen()'
      },
      task: 'Niech drzwi otworzą się dopiero po naciśnięciu obu przycisków.',
      hint: 'W <code>door.gd</code> uzupełnij <code>unlock()</code>: zmniejsz <code>locks</code> o 1 i otwórz drzwi, gdy <code>locks == 0</code>. W <code>button.gd</code> wołaj <code>$Door.unlock()</code> i usuń przycisk <code>queue_free()</code>, żeby nie dało się go nacisnąć dwa razy.',
      fact: 'Węzły w Godocie rozmawiają ze sobą, wołając swoje funkcje — jak wiadomość: „Drzwi, odblokuj jeden zamek!”',
      buttons: ['locks -= 1', 'if locks == 0:', 'open()', '$Door.unlock()', 'queue_free()'],
      open: 'door.gd',
      map: [
        '##########',
        '#B......#.',
        '#R......D.',
        '#......B#F',
        '##########'
      ],
      scripts: {
        'door.gd': { code: `${boardDoorScript}\n\nvar locks = 2\n\n# Każdy przycisk zdejmuje jeden zamek.\nfunc unlock():\n\tpass`, edit: true },
        'button.gd': { code: boardAreaStarter('Ten skrypt mają oba przyciski.'), edit: true },
        'robot.gd': { code: boardRobotScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Każdy przycisk zdejmuje 1 zamek i znika', when: [{ node: 'Button', prop: 'exists', is: false }, { node: 'Button2', prop: 'exists', is: false }, { node: 'Door', prop: 'locks', is: 0 }] },
        { text: 'Drzwi 🚪 otwierają się po obu przyciskach', when: [{ node: 'Door', prop: 'locks', is: 0 }, { node: 'Door', prop: 'is_open', is: true }], unless: [{ node: 'Door', prop: 'is_open', is: true }, { node: 'Door', prop: 'locks', min: 1 }] }
      ],
      checks: [
        { keys: 'w', node: 'Door', prop: 'is_open', is: false, fail: 'Drzwi otworzyły się już po jednym przycisku. Każdy przycisk zmniejsza locks o 1, a open() wołamy dopiero, gdy locks == 0.' },
        { keys: 'wsw', node: 'Door', prop: 'is_open', is: false, fail: 'Robot nacisnął dwa razy ten sam przycisk i drzwi się otworzyły. Po naciśnięciu przycisk ma zniknąć: queue_free()' }
      ],
      solution: {
        'door.gd': `${boardDoorScript}\n\nvar locks = 2\n\nfunc unlock():\n\tlocks -= 1\n\tif locks == 0:\n\t\topen()`,
        'button.gd': 'extends Area2D\n\nfunc _on_body_entered(body):\n\t$Door.unlock()\n\tqueue_free()'
      },
      path: 'wsdddddsdwdds'
    },
    {
      title: 'Skok',
      concept: {
        name: 'Klawisze: _input(event)',
        text: 'Teraz programujesz robota! Godot woła <code>_input(event)</code> przy każdym klawiszu. <code>event.is_action_pressed("ui_accept")</code> sprawdza, czy to <b>Spacja</b>. <code>direction</code> to strona, w którą patrzy robot, więc <code>direction * 2</code> to dwa pola przed nim.',
        code: 'elif event.is_action_pressed("ui_accept"):\n\tposition += direction * 2'
      },
      task: 'Naucz robota skakać nad wodą Spacją.',
      hint: 'Otwórz <code>robot.gd</code>. Pod ostatnim <code>elif</code> w <code>_input(event)</code> dopisz nowy <code>elif</code> dla <code>"ui_accept"</code>, a w nim <code>position += direction * 2</code>. Robot skoczy o dwa pola tam, gdzie ostatnio szedł.',
      fact: 'Akcje takie jak ui_accept ustawia się w Godocie w Ustawieniach projektu → Mapa wejścia. Jedna akcja może mieć kilka klawiszy.',
      buttons: boardRobotJumpLines.map((line) => line.trim()),
      jump: true,
      open: 'robot.gd',
      map: [
        '###########',
        '#...~..~...',
        '#R..~..~..F',
        '#...~..~...',
        '###########'
      ],
      scripts: {
        'robot.gd': { code: boardRobotScript, edit: true },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Przeskocz Spacją pierwszą wodę 🌊', when: [{ node: 'Robot', prop: 'x', min: 5 }] },
        { text: 'Przeskocz drugą wodę 🌊', when: [{ node: 'Robot', prop: 'x', min: 8 }] }
      ],
      solution: { 'robot.gd': boardRobotJumpScript },
      path: 'dd d dd'
    },
    {
      title: 'Sterowanie',
      concept: {
        name: 'elif',
        text: '<code>elif</code> znaczy „a jeśli nie, to może…”. Godot sprawdza warunki po kolei, aż któryś będzie prawdziwy. Akcje klawiszy: <code>"ui_right"</code> (D), <code>"ui_left"</code> (A), <code>"ui_up"</code> (W), <code>"ui_down"</code> (S).',
        code: 'if event.is_action_pressed("ui_right"):\n\twalk(Vector2.RIGHT)\nelif event.is_action_pressed("ui_up"):\n\twalk(Vector2.UP)'
      },
      task: 'Napisz robotowi sterowanie od nowa.',
      hint: 'Napisz <code>func _input(event):</code>, a w niej cztery warunki — po jednym na każdy kierunek. Kierunki to <code>Vector2.RIGHT</code>, <code>Vector2.LEFT</code>, <code>Vector2.UP</code> i <code>Vector2.DOWN</code>. Funkcja <code>walk(dir)</code> jest już gotowa.',
      fact: 'Każda gra w Godocie ma swój skrypt sterowania. Teraz wiesz, jak go napisać od zera!',
      buttons: ['func _input(event):', 'if event.is_action_pressed("ui_right"):', 'elif event.is_action_pressed("ui_up"):', 'walk(Vector2.RIGHT)', 'walk(Vector2.UP)'],
      open: 'robot.gd',
      map: [
        '#########',
        '#R..#...#',
        '###.#.#.#',
        '#...#.#.#',
        '#.###.#.#',
        '#.....#.F',
        '#########'
      ],
      scripts: {
        'robot.gd': {
          code: [
            'extends CharacterBody2D',
            '',
            'var gems = 0',
            'var has_key = false',
            'var direction = Vector2.RIGHT',
            '',
            '# Ups! Błąd usunął _input(event).',
            '# Robot nie słucha klawiszy.',
            '',
            'func walk(dir):',
            '\tdirection = dir',
            '\tmove_and_collide(dir)'
          ].join('\n'),
          edit: true
        },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'D idzie w prawo ➡️', when: [{ node: 'Robot', prop: 'direction', is: [1, 0] }, { node: 'Robot', prop: 'x', min: 2 }] },
        { text: 'S idzie w dół ⬇️', when: [{ node: 'Robot', prop: 'direction', is: [0, 1] }] },
        { text: 'A idzie w lewo ⬅️', when: [{ node: 'Robot', prop: 'direction', is: [-1, 0] }] },
        { text: 'W idzie w górę ⬆️', when: [{ node: 'Robot', prop: 'direction', is: [0, -1] }] }
      ],
      solution: { 'robot.gd': boardRobotScript },
      path: 'ddssaassddddwwwwddssssd'
    },
    {
      title: 'Skok za klejnot',
      concept: {
        name: 'Dwa warunki: and',
        text: '<code>and</code> łączy dwa warunki — oba muszą być prawdziwe. <code>event.is_action_pressed("ui_accept") and gems > 0</code> znaczy: wciśnięto Spację <b>i</b> robot ma klejnot. <code>gems -= 1</code> zabiera jeden klejnot.',
        code: 'elif event.is_action_pressed("ui_accept") and gems > 0:\n\tgems -= 1\n\tposition += direction * 2'
      },
      task: 'Niech każdy skok kosztuje robota jeden klejnot.',
      hint: 'W <code>robot.gd</code> zmień warunek skoku: dopisz <code>and gems > 0</code>. Pod nim, przed skokiem, zabierz klejnot: <code>gems -= 1</code>. Bez klejnotu Spacja nic nie robi.',
      fact: 'Tak tworzy się zasady gry: skok kosztuje energię, strzał kosztuje amunicję. To zwykłe zmienne i warunki.',
      buttons: ['elif event.is_action_pressed("ui_accept") and gems > 0:', 'gems -= 1'],
      jump: true,
      countGems: false,
      open: 'robot.gd',
      map: [
        '############',
        '#R.G.~.G.~.F',
        '############'
      ],
      scripts: {
        'robot.gd': { code: boardRobotJumpScript, edit: true },
        'gem.gd': { code: boardGemScript },
        'goal.gd': { code: boardGoalScript }
      },
      goals: [
        { text: 'Skok nad wodą 🌊 zabiera 1 💎', when: [{ node: 'Robot', prop: 'x', min: 6 }, { node: 'Robot', prop: 'gems', is: 0 }] },
        { text: 'Drugi skok też kosztuje 1 💎', when: [{ node: 'Robot', prop: 'x', min: 10 }, { node: 'Robot', prop: 'gems', is: 0 }] }
      ],
      checks: [
        { keys: ' ', node: 'Robot', prop: 'position', is: [1, 1], fail: 'Robot skoczył, choć nie miał żadnego klejnotu. Skacz tylko wtedy, gdy gems > 0.' },
        { keys: 'ddd  ', node: 'Robot', prop: 'position', is: [6, 1], fail: 'Robot skoczył drugi raz, choć wydał już swój jedyny klejnot. Każdy skok zabiera jeden klejnot: gems -= 1' }
      ],
      solution: {
        'robot.gd': boardRobotJumpScript.replace(boardRobotJumpLines.join('\n'), '\telif event.is_action_pressed("ui_accept") and gems > 0:\n\t\tgems -= 1\n\t\tposition += direction * 2')
      },
      path: 'ddd dd d'
    }
  ]
};

// Plansza do pytania „Gdzie skończy robot?”: R robot (start), . trawa, # ściana, ~ woda, T skarb.
// Rysowana jako inline SVG i podawana jako obrazek (data URI), bez osobnego pliku.
const robotBoardMap = ['R...#', '~.#..', '...T~', '#.~..'];
const robotBoardCell = (ch, x, y) => {
  const base = `<rect x="${x}" y="${y}" width="40" height="40" fill="#f1f8e9" stroke="#c5e1a5"/>`;
  if (ch === '#') return base + `<rect x="${x + 2}" y="${y + 2}" width="36" height="36" rx="3" fill="#8d6e63"/><path d="M${x + 2} ${y + 14}h36M${x + 2} ${y + 26}h36M${x + 20} ${y + 2}v12M${x + 11} ${y + 14}v12M${x + 29} ${y + 14}v12M${x + 20} ${y + 26}v12" stroke="#5d4037" stroke-width="2"/>`;
  if (ch === '~') return base + `<rect x="${x + 1}" y="${y + 1}" width="38" height="38" fill="#4fc3f7"/><path d="M${x + 5} ${y + 15}q5 -5 10 0t10 0t10 0M${x + 5} ${y + 27}q5 -5 10 0t10 0t10 0" fill="none" stroke="#fff" stroke-width="2"/>`;
  if (ch === 'T') return base + `<path d="M${x + 8} ${y + 18}q12 -12 24 0z" fill="#ffca28" stroke="#8d6e00" stroke-width="1.5"/><rect x="${x + 8}" y="${y + 18}" width="24" height="14" rx="2" fill="#ffb300" stroke="#8d6e00" stroke-width="1.5"/><rect x="${x + 18}" y="${y + 20}" width="4" height="5" fill="#6d4c41"/>`;
  if (ch === 'R') return base + `<path d="M${x + 20} ${y + 12}v-5" stroke="#455a64" stroke-width="2"/><circle cx="${x + 20}" cy="${y + 6}" r="2.5" fill="#ff5252"/><rect x="${x + 10}" y="${y + 12}" width="20" height="18" rx="4" fill="#78909c" stroke="#455a64" stroke-width="1.5"/><circle cx="${x + 16}" cy="${y + 19}" r="3" fill="#fff"/><circle cx="${x + 24}" cy="${y + 19}" r="3" fill="#fff"/><rect x="${x + 15}" y="${y + 24}" width="10" height="2.5" rx="1" fill="#263238"/><rect x="${x + 13}" y="${y + 30}" width="14" height="6" rx="1.5" fill="#546e7a"/>`;
  return base;
};
const robotBoardImage = 'data:image/svg+xml,' + encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 208 168">${robotBoardMap
    .map((row, y) => [...row].map((ch, x) => robotBoardCell(ch, 4 + x * 40, 4 + y * 40)).join(''))
    .join('')}</svg>`
);

// Quiz „Programowanie”: podstawowe pojęcia, kolejność kroków, plansza robota i pętle.
const programmingQuiz = {
  id: 'programowanie/quiz-jezyk-robotow',
  title: 'Quiz: Język robotów',
  questions: [
    {
      type: 'buckets',
      label: 'A',
      rewardGif: 'assets/reward-gifs/cat-67.gif',
      match: true,
      prompt: 'Dopasuj pojęcie do opisu.',
      hint: 'Kliknij pojęcie, a potem pole obok pasującego opisu.',
      buckets: [
        { id: 'algorithm', label: 'Przepis krok po kroku, jak wykonać zadanie.' },
        { id: 'program', label: 'Algorytm zapisany w języku, który rozumie komputer.' },
        { id: 'loop', label: 'Powtarza te same polecenia kilka razy.' },
        { id: 'condition', label: 'Sprawdza, czy coś jest prawdą, np. „jeśli przed tobą ściana, skręć”.' },
        { id: 'bug', label: 'Pomyłka w programie, przez którą działa on źle.' },
        { id: 'variable', label: 'Pudełko z nazwą, w którym program pamięta wartość, np. liczbę punktów.' }
      ],
      items: [
        { text: 'Algorytm', answer: 'algorithm' },
        { text: 'Program', answer: 'program' },
        { text: 'Pętla', answer: 'loop' },
        { text: 'Warunek', answer: 'condition' },
        { text: 'Błąd (bug)', answer: 'bug' },
        { text: 'Zmienna', answer: 'variable' }
      ]
    },
    {
      // answer = numer kroku; kroki z tym samym numerem można zamienić miejscami.
      type: 'order',
      label: 'B',
      rewardGif: 'assets/reward-gifs/dance.gif',
      prompt: 'Robię kanapkę. Kiedy robisz każdy krok?',
      hint: 'Klikaj kroki po kolei albo przeciągnij je na listę. Kliknij krok na liście, aby go cofnąć.',
      items: [
        { text: 'Wyjmij chleb', icon: '🍞', answer: 1 },
        { text: 'Ukrój dwie kromki', icon: '🔪', answer: 2 },
        { text: 'Posmaruj kromkę masłem', icon: '🧈', answer: 3 },
        { text: 'Połóż ser', icon: '🧀', answer: 4 },
        { text: 'Połóż pomidora', icon: '🍅', answer: 4 },
        { text: 'Przykryj drugą kromką', icon: '🥪', answer: 6 },
        { text: 'Zjedz kanapkę', icon: '😋', answer: 7 }
      ]
    },
    {
      type: 'choices',
      label: 'C',
      rewardGif: 'assets/reward-gifs/spongebob.gif',
      prompt: 'Prawda czy fałsz?',
      hint: 'Przeczytaj uważnie każde zdanie.',
      options: [
        { id: 'true', label: 'Prawda' },
        { id: 'false', label: 'Fałsz' }
      ],
      items: [
        {
          text: 'Komputer sam domyśla się, o co nam chodzi.',
          answer: 'false',
          explain: 'Komputer robi dokładnie to, co mu każemy — nic więcej.'
        },
        { text: 'Pętla powtarza polecenia.', answer: 'true' },
        {
          text: 'Kolejność poleceń nie ma znaczenia.',
          answer: 'false',
          explain: 'Ma znaczenie! Nie zjesz kanapki, zanim jej nie zrobisz.'
        },
        { text: 'Program to zapis algorytmu w języku zrozumiałym dla komputera.', answer: 'true' },
        {
          text: 'Błąd w programie trzeba znaleźć i poprawić.',
          answer: 'true',
          explain: 'Szukanie i poprawianie błędów to debugowanie.'
        },
        {
          text: 'To samo zadanie można rozwiązać tylko jednym algorytmem.',
          answer: 'false',
          explain: 'Często jest kilka dobrych sposobów na to samo zadanie.'
        }
      ]
    },
    {
      type: 'choices',
      label: 'D',
      rewardGif: 'assets/reward-gifs/kamil.gif',
      prompt: 'Gdzie skończy robot?',
      hint: 'Robot zaczyna w lewym górnym rogu. Każda strzałka to jeden krok o jedno pole.',
      art: {
        photo: true,
        image: robotBoardImage,
        alt: 'Plansza 5 na 4 pola: robot w lewym górnym rogu, skrzynia ze skarbem, ściany i woda.',
        caption: 'Plansza robota'
      },
      options: [
        { id: 'treasure', label: 'Przy skarbie' },
        { id: 'wall', label: 'W ścianie' },
        { id: 'water', label: 'W wodzie' }
      ],
      items: [
        { text: '→ → → ↓ ↓', answer: 'treasure' },
        { text: '→ → ↓', answer: 'wall' },
        { text: '→ ↓ ↓ ↓ →', answer: 'water' },
        { text: '→ ↓ ↓ → →', answer: 'treasure' },
        { text: '→ ↓ ↓ ← ↓', answer: 'wall' },
        { text: '→ → → ↓ ↓ →', answer: 'water', explain: 'Robot doszedł do skarbu, ale zrobił o jeden krok za dużo.' }
      ]
    },
    {
      type: 'choices',
      label: 'E',
      rewardGif: 'assets/reward-gifs/pikachu-clap.gif',
      prompt: 'Który algorytm zadziała szybciej?',
      hint: 'Oba algorytmy prowadzą do tego samego celu. Policz, ile czynności trzeba naprawdę wykonać.',
      options: [
        { id: 'first', label: 'Algorytm 1' },
        { id: 'second', label: 'Algorytm 2' },
        { id: 'same', label: 'Tak samo' }
      ],
      items: [
        {
          text: '🤖 Robot ma dojść do skarbu, który leży 3 pola przed nim.',
          algorithms: [
            ['Skręć w lewo.', 'Skręć w prawo.', 'Powtórz 3 razy: idź naprzód.'],
            ['Powtórz 3 razy: idź naprzód.']
          ],
          answer: 'second',
          explain: 'W algorytmie 1 robot niepotrzebnie kręci się w miejscu.'
        },
        {
          text: '🍵 Chcesz zrobić herbatę.',
          algorithms: [
            ['Włącz czajnik.', 'Gdy woda się gotuje, włóż torebkę do kubka.', 'Zalej herbatę wrzątkiem.'],
            ['Włącz czajnik.', 'Poczekaj, aż woda się zagotuje.', 'Dopiero teraz włóż torebkę do kubka.', 'Zalej herbatę wrzątkiem.']
          ],
          answer: 'first',
          explain: 'W algorytmie 1 torebkę wkładasz, zanim woda się zagotuje — nie tracisz czasu na czekanie.'
        },
        {
          text: '🚶 Robot ma zrobić 5 kroków naprzód.',
          algorithms: [
            ['Idź naprzód.', 'Idź naprzód.', 'Idź naprzód.', 'Idź naprzód.', 'Idź naprzód.'],
            ['Powtórz 5 razy: idź naprzód.']
          ],
          answer: 'same',
          explain: 'Pętla skraca zapis, ale robot i tak robi 5 kroków.'
        },
        {
          text: '📖 Szukasz w słowniku słowa „zebra”.',
          algorithms: [
            ['Otwórz słownik na pierwszej stronie.', 'Przeglądaj strony po kolei, aż znajdziesz „zebra”.'],
            ['Otwórz słownik blisko końca, bo „z” to jedna z ostatnich liter.', 'Przewróć kilka stron, aż znajdziesz „zebra”.']
          ],
          answer: 'second',
          explain: 'Słowa w słowniku są ułożone alfabetycznie, więc od razu wiesz, gdzie szukać.'
        },
        {
          text: '🎒 Musisz zanieść do plecaka 3 zeszyty leżące na biurku.',
          algorithms: [
            ['Powtórz 3 razy: weź jeden zeszyt, zanieś go do plecaka, wróć do biurka.'],
            ['Weź wszystkie 3 zeszyty naraz.', 'Zanieś je do plecaka.']
          ],
          answer: 'second',
          explain: 'W algorytmie 1 chodzisz między biurkiem a plecakiem trzy razy.'
        }
      ]
    }
  ]
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
