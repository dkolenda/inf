// Dokumentacja animacji postaci (menu Pomoc › Dokumentacja › karta „Animacje postaci”): poradnik krok po kroku
// do Anim Source i Animation Blueprintu (game-paperzd.js) ze zrzutami ekranu z src/docs/paperzd/
// i poradami, jak przygotować rysunki albo nagrania do animacji Idle, Run, Jump.

const geZdShot = (file, caption) => `<figure class="ge-doc-shot"><img src="docs/paperzd/${file}" alt="${geEsc(caption)}" loading="lazy" title="Kliknij, żeby powiększyć" /><figcaption>${caption}</figcaption></figure>`;
const geZdTip = (html) => `<p class="ge-doc-tip">💡 ${html}</p>`;
const geZdWarn = (html) => `<p class="ge-doc-warn">⚠ ${html}</p>`;

const GE_DOC_ZD = [
  { cat: 'Wstęp', html: `<h4>Animacje postaci — jak w Paper ZD z Unreal Engine</h4>
    <p>Postać w grze powinna <b>sama</b> zmieniać animację: stoi — oddycha (<i>Idle</i>), biegnie — przebiera łapkami (<i>Run</i>), jest w powietrzu — skacze (<i>Jump</i>). Zamiast przełączać Flipbooki węzłem <i>Set Flipbook</i> w każdym miejscu Blueprintu, budujesz jeden <b>Animation Blueprint</b>, który patrzy na postać i co klatkę wybiera właściwą animację. Tak działa plugin <b>Paper ZD</b> do Unreal Engine i tak samo działa to tutaj.</p>
    ${geZdShot('10-anim-graph.webp', 'Gotowa maszyna stanów kotka: Idle, Run, Jump i Machanie. Po prawej podgląd — Run świeci, bo Speed = 180.')}
    <h4>Trzy klocki</h4>
    <div class="ge-doc-flow">
      <div><b>🎞 Flipbooki</b><span>klatki animacji: FB_Kotek_Idle, FB_Kotek_Run…</span></div><i>→</i>
      <div><b>🎬 Anim Source</b><span>sekwencje postaci z kierunkami i notify</span></div><i>→</i>
      <div><b>🏃 Animation Blueprint</b><span>zmienne + maszyna stanów: kiedy która sekwencja</span></div><i>→</i>
      <div><b>📘 Klasa aktora</b><span>Ustawienia klasy › Animacja (Paper ZD)</span></div>
    </div>
    <ul class="ge-doc-list">
      <li><b>Anim Source (AS_)</b> — „biblioteka” animacji jednej postaci. Każda <b>sekwencja</b> ma Flipbook na każdy kierunek (1, 2, 4 albo 8) i znaczniki <b>notify</b> na klatkach (np. dźwięk kroku).</li>
      <li><b>Animation Blueprint (ABP_)</b> — mózg animacji. W <b>Event Graph</b> co klatkę odczytuje, co robi postać (prędkość, czy stoi na ziemi) i zapisuje to w zmiennych. W <b>Anim Graph</b> rysujesz <b>stany</b> (Idle, Run…) i <b>przejścia</b> między nimi z warunkami na tych zmiennych.</li>
      <li><b>Klasa aktora</b> dostaje Animation Blueprint w Ustawieniach klasy — i to wszystko. Każdy aktor tej klasy ma własną kopię (Anim Instance).</li>
    </ul>
    <h4>Najkrótsza droga (5 minut)</h4>
    <ol class="ge-steps">
      <li>Zaimportuj arkusz klatek i kliknij <b>Podziel na klatki</b> — powstaną sprite'y i Flipbook. Zrób Flipbooki Idle, Run i Jump.</li>
      <li><b>＋ Dodaj › Anim Source</b>, dodaj sekwencje <i>Idle</i>, <i>Run</i>, <i>Jump</i> (2 kierunki) i przypisz Flipbooki do kierunku „Prawo”.</li>
      <li><b>＋ Dodaj › Animation Blueprint</b>, w Ustawieniach klasy wybierz Anim Source i kliknij <b>🏃 Szablon: platformówka</b>.</li>
      <li>W klasie gracza: <b>Ustawienia klasy › Animacja (Paper ZD) › Animation Blueprint</b>.</li>
      <li>▶ Graj.</li>
    </ol>
    <p>Kolejne działy opisują każdy krok dokładnie — zacznij od <b>1. Rysunki i nagrania</b>, bo dobrze przygotowane klatki to połowa sukcesu.</p>` },

  { cat: '1. Rysunki i nagrania', html: `<h4>Jakie animacje przygotować</h4>
    <p>Na start wystarczą trzy: <b>Idle</b>, <b>Run</b> i <b>Jump</b>. Resztę dodasz, gdy gra będzie ich potrzebować.</p>
    <table class="ge-doc-table">
      <tr><th>Animacja</th><th>Co pokazuje</th><th>Klatki</th><th>kl./s</th><th>Pętla</th></tr>
      <tr><td><b>Idle</b></td><td>postać stoi: oddycha, mruga, rusza ogonem</td><td>2–6</td><td>4–8</td><td>tak</td></tr>
      <tr><td><b>Walk</b></td><td>spokojny chód</td><td>6–8</td><td>8–10</td><td>tak</td></tr>
      <tr><td><b>Run</b></td><td>bieg — jeden pełny cykl kroków</td><td>6–8</td><td>10–14</td><td>tak</td></tr>
      <tr><td><b>Jump</b></td><td>wybicie i lot w górę</td><td>1–3</td><td>6–10</td><td>nie</td></tr>
      <tr><td><b>Fall</b></td><td>opadanie (łapki w dół)</td><td>1–2</td><td>6–8</td><td>tak</td></tr>
      <tr><td><b>Land</b></td><td>lądowanie (przysiad)</td><td>2–3</td><td>12</td><td>nie</td></tr>
      <tr><td><b>Machanie, Taniec…</b></td><td>jednorazowe akcje i radość</td><td>4–8</td><td>8–12</td><td>nie</td></tr>
    </table>
    <h4>Zasady, dzięki którym animacja nie „skacze”</h4>
    <ul class="ge-doc-list">
      <li><b>Ta sama wielkość klatki</b> we wszystkich animacjach postaci (np. 48 × 48 albo 64 × 64 px). Inaczej postać rośnie i maleje przy zmianie stanu.</li>
      <li><b>Stopy zawsze w tym samym miejscu klatki</b> (np. 2 px nad dolną krawędzią) — to „punkt zaczepienia”. Gdy w Idle stopy są niżej niż w Run, postać podskakuje przy każdym przejściu.</li>
      <li><b>Postać biegnie w miejscu.</b> Animacja tylko przebiera nogami — do przodu przesuwa ją gra (prędkość aktora). Jeśli na rysunku postać się przesuwa, w grze będzie „ślizgać się” do tyłu.</li>
      <li><b>Pętla bez szwu:</b> ostatnia klatka ma płynnie przechodzić w pierwszą. Nie powtarzaj tej samej pozy na początku i na końcu — wtedy w pętli zatrzymuje się na dwie klatki.</li>
      <li><b>Rysuj tylko w prawo.</b> W Anim Source ustawisz 2 kierunki z <b>odbiciem</b> — w lewo silnik sam odbije obrazek. Mniej pracy, a wygląda tak samo. (Jeśli postać trzyma coś w jednej ręce, odbicie przełoży to do drugiej — zwykle nikt tego nie zauważa.)</li>
      <li><b>Przezroczyste tło</b> (PNG). Czarne albo białe tło będzie widać w grze jako prostokąt.</li>
      <li><b>Klatki w jednym rzędzie</b> albo w siatce (arkusz, ang. <i>sprite sheet</i>) — edytor podzieli go na klatki jednym kliknięciem.</li>
    </ul>
    ${geZdShot('03-arkusz.webp', 'Arkusz 16 klatek kotka (768 × 48 px). Kolumny: 16, Wiersze: 1 → „Podziel na klatki” robi z każdej kratki Sprite.')}
    ${geZdTip('Pixel art? Rysuj w małej rozdzielczości (32–64 px), a w grze powiększaj komponent — edytor nie rozmywa pikseli. Dobre darmowe programy: <b>Piskel</b> (w przeglądarce), <b>LibreSprite</b>, <b>Krita</b>.')}
    <h4>Animacja z nagrania wideo (rotoskopia)</h4>
    <p>Nie umiesz rysować? Nagraj siebie albo kolegę telefonem i użyj <b>＋ Dodaj › Animacja z wideo (rotoskopia)</b>. Edytor wytnie postać z każdej klatki i zrobi z niej Flipbook — z oryginalnymi kolorami, jako kreskówkę albo jako narysowanego ludzika (tryb <i>AI: szkielet → postać</i>).</p>
    <p><b>Jak nagrywać, żeby wyszło dobrze:</b></p>
    <ul class="ge-doc-list">
      <li><b>Telefon na statywie</b> (albo oparty o książki), <b>poziomo</b>, nieruchomo przez całe nagranie. Kamera na wysokości bioder, <b>dokładnie z boku</b> postaci.</li>
      <li><b>Tło:</b> najlepiej jednolita ściana (zielona, niebieska albo biała) — tryb <i>Jednolite tło</i>. Bez ściany: nie ruszaj kamerą i nagraj 1–2 sekundy <b>pustego tła</b> na początku — tryb <i>Nieruchoma kamera</i>. Tryb <i>AI</i> działa przy dowolnym tle, ale wolniej.</li>
      <li><b>Ubranie kontrastowe do tła</b> (nie zielona bluza na zielonej ścianie) i bez luźnych, powiewających części.</li>
      <li><b>Dużo światła</b>, bez cienia na ścianie za postacią. Światło z przodu albo z góry.</li>
      <li><b>Cała postać w kadrze</b> — od czubka głowy do stóp, z zapasem. Ręce przy skoku też.</li>
      <li><b>30 albo 60 kl./s</b> (zwykłe ustawienie telefonu). W edytorze i tak wybierzesz 8–14 kl./s animacji.</li>
      <li>Zapisz jako <b>MP4</b> albo <b>WebM</b>.</li>
    </ul>
    <p><b>Co nagrać dla każdej animacji:</b></p>
    <table class="ge-doc-table">
      <tr><th>Animacja</th><th>Jak nagrać</th><th>W oknie rotoskopii</th></tr>
      <tr><td><b>Idle</b></td><td>Stój bokiem 3–4 s, spokojnie oddychaj, raz lekko przenieś ciężar ciała. Nie stój jak posąg — wtedy animacja wygląda jak zdjęcie.</td><td>Wybierz ~1–2 s, kl./s 6–8, Zapętlona ✓.</td></tr>
      <tr><td><b>Walk / Run</b></td><td>Przejdź / przebiegnij przez cały kadr z lewej do prawej, 2–3 razy. Albo biegnij <b>w miejscu</b> (bieg w miejscu wygląda trochę sztucznie, ale łatwiej go nagrać).</td><td>Zaznacz <b>dokładnie jeden cykl</b>: od chwili, gdy prawa stopa dotyka ziemi, do następnego dotknięcia prawej stopy. Włącz <b>Postać w miejscu</b> ✓ — wtedy postać przestaje przesuwać się w kadrze. Zapętlona ✓.</td></tr>
      <tr><td><b>Jump</b></td><td>Skocz w miejscu, z ugiętymi kolanami. Nagraj 3 skoki i wybierz najładniejszy.</td><td>Najlepiej zrób <b>trzy</b> krótkie animacje z jednego nagrania: wybicie (Jump), szczyt i opadanie (Fall), lądowanie (Land). Zapętlona ✗.</td></tr>
      <tr><td><b>Machanie, Taniec</b></td><td>Pomachaj ręką albo zatańcz przez 2 s, zacznij i skończ w tej samej pozie co Idle.</td><td>Zapętlona ✗ — po końcu wraca Idle.</td></tr>
      <tr><td><b>4 kierunki</b> (gra z góry)</td><td>Nagraj chód <b>przodem</b>, <b>tyłem</b> i <b>bokiem</b> do kamery (bok wystarczy jeden — drugi to odbicie).</td><td>Każdy kierunek to osobny Flipbook.</td></tr>
    </table>
    ${geZdTip('Wszystkie nagrania jednej postaci rób z <b>tej samej odległości</b> i z tym samym kadrem. Wtedy Idle, Run i Jump mają tę samą wielkość i stopy w tym samym miejscu.')}
    ${geZdWarn('Skacz w bezpiecznym miejscu (miękkie podłoże, nic wokół), a gdy nagrywasz inne osoby — zapytaj, czy się zgadzają.')}` },

  { cat: '2. Flipbooki', html: `<h4>Z klatek robisz Flipbooki</h4>
    <p>Flipbook (<b>Animacja</b>, przedrostek FB_) to sprite'y pokazywane po kolei. Każda sekwencja w Anim Source to jeden Flipbook na kierunek.</p>
    <ol class="ge-steps">
      <li><b>⤓ Importuj</b> arkusz PNG (albo przeciągnij plik na Przeglądarkę zawartości).</li>
      <li>Otwórz teksturę, wpisz <b>Kolumny</b> i <b>Wiersze</b> siatki, kliknij <b>🎞 Podziel na klatki</b>. Powstaną sprite'y i jeden Flipbook ze wszystkimi klatkami.</li>
      <li>Utwórz osobne Flipbooki: <b>＋ Dodaj › Animacja (Flipbook)</b>, np. <i>FB_Kotek_Run</i>, i w Szczegółach dodaj do niego klatki (sprite'y) po kolei.</li>
      <li>Ustaw <b>Klatki na sekundę</b> (tabela w dziale 1) i <b>Zapętlona</b>.</li>
    </ol>
    ${geZdShot('04-flipbook.webp', 'Flipbook FB_Kotek_Run: 6 klatek, 12 kl./s, zapętlony. Podgląd gra animację na żywo.')}
    ${geZdTip('Nazywaj Flipbooki tak samo jak sekwencje: <i>FB_Kotek_Idle</i>, <i>FB_Kotek_Run</i>… Szablon platformówki dobiera sekwencje po słowach <i>Idle</i>, <i>Run</i> i <i>Jump</i> w nazwie.')}
    <p>Zapętlenie i tempo Flipbooka to wartości domyślne — w Animation Blueprincie każdy stan może je zmienić (pole <b>Zapętlona</b> i <b>Play Rate</b>).</p>` },

  { cat: '3. Anim Source', html: `<h4>Biblioteka animacji postaci</h4>
    ${geZdShot('02-menu-dodaj.webp', 'Nowe zasoby na dole menu „＋ Dodaj”: Anim Source i Animation Blueprint.')}
    <ol class="ge-steps">
      <li><b>＋ Dodaj › Anim Source (Paper ZD)</b>, np. <i>AS_Kotek</i>. Kliknij go dwukrotnie.</li>
      <li>Po lewej <b>＋</b> dodaje sekwencję. Kolejne dostają nazwy Idle, Run, Jump, Fall… — zmienisz je w polu <b>Nazwa</b>.</li>
      <li>Wybierz liczbę <b>Kierunków</b> i do każdego kierunku przypisz Flipbook.</li>
    </ol>
    ${geZdShot('05-anim-source.webp', 'AS_Kotek: sekwencja Run z 2 kierunkami. Koło pokazuje kierunki: zielony — ma Flipbook, niebieski ↔ — weźmie odbicie.')}
    <h4>Kierunki i odbicie</h4>
    <ul class="ge-doc-list">
      <li><b>1</b> — jeden Flipbook na wszystko (np. wybuch, moneta).</li>
      <li><b>2 (prawo, lewo)</b> — platformówka. Wystarczy „Prawo” + <b>Odbicie pustych kierunków</b> ✓.</li>
      <li><b>4</b> — gra z góry (RPG): prawo, dół, lewo, góra. Narysuj dół, górę i prawo — lewo zrobi odbicie.</li>
      <li><b>8</b> — także skosy. Wystarczy prawa połowa koła i góra/dół.</li>
    </ul>
    <p>Kliknij kawałek koła albo strzałkę przy kierunku, żeby zobaczyć go w podglądzie. Pusty kierunek z odbiciem jest niebieski (<b>↔</b>), a podgląd pokazuje go już odbitego.</p>
    ${geZdShot('06-kierunki.webp', 'Kierunek „Lewo” jest pusty — w grze i w podglądzie to odbity „Prawo”.')}
    <h4>Notify — znaczniki na klatkach</h4>
    <p>Pod podglądem są klatki wybranego kierunku. <b>＋ notify</b> pod klatką dodaje znacznik: gdy animacja dojdzie do tej klatki, w Animation Blueprincie (i w klasie aktora) uruchomi się zdarzenie <b>AnimNotify_Nazwa</b>. Notify może też od razu zagrać <b>dźwięk</b> — bez żadnego bloczka.</p>
    ${geZdShot('07-notify.webp', 'Notify „Krok” na klatkach 2 i 5 biegu — w tych klatkach łapka dotyka ziemi. Każdy gra dźwięk „Pik”.')}
    <ul class="ge-doc-list">
      <li>Nazwy notify zapisujesz w Szczegółach (<b>Notify (zarejestrowane nazwy)</b>). Zmiana nazwy zmienia ją też w sekwencjach, stanach i węzłach AnimNotify.</li>
      <li>Notify bez nazwy, tylko z dźwiękiem, jest najprostszym sposobem na dźwięk kroków.</li>
      <li>Klatki liczą się od 1, tak jak na pasku klatek.</li>
    </ul>` },

  { cat: '4. Animation Blueprint', html: `<h4>Mózg animacji</h4>
    <ol class="ge-steps">
      <li><b>＋ Dodaj › Animation Blueprint (Paper ZD)</b>, np. <i>ABP_Kotek</i>. Ma dwie karty: <b>Anim Graph</b> i <b>Event Graph</b>.</li>
      <li>Kliknij <b>⚙ Ustawienia klasy</b> i wybierz <b>Anim Source</b>.</li>
      <li>Kliknij <b>🏃 Szablon: platformówka</b> — powstaną zmienne, ich ustawianie w Event Graph oraz stany Idle, Run, Jump z przejściami.</li>
    </ol>
    ${geZdShot('08-abp-ustawienia.webp', 'Ustawienia klasy Animation Blueprintu: Anim Source, szybki start i lista klas, które go używają.')}
    <h4>Event Graph: skąd ABP wie, co robi postać</h4>
    <p>Zdarzenie <b>Event Blueprint Update Animation</b> działa w każdej klatce, zaraz po ruchu postaci. Węzeł <b>Try Get Pawn Owner</b> daje aktora, którego animujesz. Z niego bierzesz to, co potrzebne, i zapisujesz w zmiennych Animation Blueprintu:</p>
    ${geZdShot('09-event-graph.webp', 'Event Graph z szablonu: Speed = długość prędkości właściciela, IsFalling = NOT (stoi na ziemi).')}
    <pre>${geHighlight(`// Event Blueprint Update Animation
animUpdate(deltaTimeX: number) {
  this.vars.Speed = this.tryGetPawnOwner().velocity.length();
  this.vars.IsFalling = !this.tryGetPawnOwner().isOnGround();
}`)}</pre>
    <ul class="ge-doc-list">
      <li><b>Speed</b> (Float) — jak szybko porusza się postać (piksele na sekundę). 0 — stoi.</li>
      <li><b>IsFalling</b> (Boolean) — czy jest w powietrzu.</li>
      <li>Możesz dodać własne, np. <b>IsSwimming</b> z klasy gracza: <i>Try Get Pawn Owner → Get IsSwimming (BP_Gracz)</i>.</li>
      <li><b>Event Blueprint Initialize Animation</b> działa raz, na początku — dobre miejsce, żeby zapamiętać coś na start.</li>
    </ul>
    ${geZdTip('W Animation Blueprincie nie ma <i>Event BeginPlay</i>, <i>Event Tick</i> ani zdarzeń klawiszy — Anim Instance nie stoi na poziomie. Klawisze obsługuj w klasie gracza, a ABP niech tylko patrzy na postać.')}` },

  { cat: '5. Anim Graph', html: `<h4>Stany i przejścia</h4>
    <p><b>Stan</b> (prostokąt) gra jedną sekwencję. <b>Przejście</b> (strzałka) mówi, kiedy przejść do innego stanu. Maszyna stanów zaczyna od <b>Entry</b> i co klatkę sprawdza przejścia z obecnego stanu.</p>
    ${geZdShot('10-anim-graph.webp', 'Anim Graph kotka. Strzałka z ⏱ — przejście „po końcu sekwencji”, przerywana fioletowa — Jump Node.')}
    <table class="ge-doc-table">
      <tr><th>Co zrobić</th><th>Jak</th></tr>
      <tr><td>Dodać stan</td><td>Prawy przycisk w pustym miejscu › <b>＋ Dodaj stan</b> albo od razu <b>Stan z sekwencji</b>.</td></tr>
      <tr><td>Dodać przejście</td><td>Chwyć stan za <b>brzeg</b> (szara ramka, kursor ✛) i przeciągnij do innego stanu. Puszczone w pustym miejscu — tworzy nowy stan.</td></tr>
      <tr><td>Przesunąć stan</td><td>Przeciągnij za środek (ciemne pole z nazwą).</td></tr>
      <tr><td>Zmienić stan startowy</td><td>Przeciągnij z brzegu <b>Entry</b> do stanu albo PPM na stanie › <i>Ustaw jako wejście</i>.</td></tr>
      <tr><td>Usunąć / duplikować</td><td>Zaznacz i <b>Delete</b> / <b>Ctrl+D</b>. <b>Home</b> — pokaż cały graf.</td></tr>
      <tr><td>Przesunąć widok / zoom</td><td>Przeciągnij puste miejsce, kółko myszy.</td></tr>
    </table>
    <h4>Szczegóły stanu</h4>
    <div class="ge-doc-row">${geZdShot('11-stan.webp', 'Stan Run.')}<div>
      <ul class="ge-doc-list">
        <li><b>Sekwencja</b> z Anim Source.</li>
        <li><b>Zapętlona</b> — bez pętli sekwencja staje na ostatniej klatce (Jump, Land, Machanie).</li>
        <li><b>Play Rate</b> — tempo: 2 = dwa razy szybciej.</li>
        <li><b>× zmienna</b> — tempo mnożone przez zmienną (dział <i>Tempo zależne od prędkości</i>).</li>
        <li><b>Kierunek</b> — skąd brać kąt do wyboru Flipbooka: z prędkości właściciela (domyślnie — postać patrzy tam, dokąd idzie i zostaje tak, gdy stanie), ze zmiennej albo stały.</li>
        <li><b>Notify stanu</b> — nazwa notify przy wejściu albo wyjściu ze stanu (np. dźwięk skoku przy wejściu do Jump).</li>
      </ul></div></div>
    <h4>Reguła przejścia</h4>
    <div class="ge-doc-row">${geZdShot('12-przejscie.webp', 'Przejście Idle → Run: Speed > 10.')}<div>
      <ul class="ge-doc-list">
        <li><b>Warunki</b> — zmienna, porównanie i liczba. Wszystkie warunki muszą być spełnione naraz.</li>
        <li><b>Automatycznie po końcu</b> — przejście czeka, aż sekwencja dojdzie do ostatniej klatki (Land → Idle, Machanie → Idle).</li>
        <li>Przejście bez warunku i bez „po końcu” jest <b>pomarańczowe, przerywane</b> — nigdy się nie wykona.</li>
        <li><b>Kolejność</b> — przejścia z jednego stanu są sprawdzane po kolei, wygrywa pierwsze spełnione. ▲ / ▼ zmienia kolejność.</li>
      </ul></div></div>
    <h4>Przejścia platformówki</h4>
    <table class="ge-doc-table">
      <tr><th>Z</th><th>Do</th><th>Warunek</th></tr>
      <tr><td>Idle</td><td>Run</td><td>Speed &gt; 10</td></tr>
      <tr><td>Run</td><td>Idle</td><td>Speed ≤ 10</td></tr>
      <tr><td>Idle, Run</td><td>Jump</td><td>IsFalling = prawda</td></tr>
      <tr><td>Jump</td><td>Fall</td><td>Automatycznie po końcu</td></tr>
      <tr><td>Jump, Fall</td><td>Land</td><td>IsFalling = fałsz</td></tr>
      <tr><td>Land</td><td>Idle</td><td>Automatycznie po końcu</td></tr>
    </table>
    ${geZdTip('Postać miga między Idle i Run, gdy prędkość jest blisko granicy? Daj dwie różne granice: <b>Idle → Run: Speed &gt; 20</b>, ale <b>Run → Idle: Speed &lt; 5</b>. Pomiędzy postać zostaje w tym stanie, w którym jest.')}` },

  { cat: '6. Podgląd', html: `<h4>Sprawdź bez grania</h4>
    <p>W prawym górnym rogu Anim Graph jest <b>Podgląd</b>. Działa w nim ta sama maszyna stanów co w grze, tylko zmienne ustawiasz suwakami (Event Graph w podglądzie się nie wykonuje).</p>
    <ul class="ge-doc-list">
      <li>Przesuń <b>Speed</b> — gdy przekroczy 10, stan <b>Run</b> zaświeci się na żółto, a strzałka przejścia mignie.</li>
      <li>Zaznacz <b>IsFalling</b> — postać skacze.</li>
      <li><b>Prędkość właściciela X / Y</b> — kierunek postaci: X ujemne → postać odwraca się w lewo.</li>
      <li>Przyciski <b>Jump Nodes</b> sprawdzają skoki do stanów, a pod nimi widać notify i dźwięki, które właśnie zagrały.</li>
      <li><b>⟲</b> — od nowa, od stanu Entry. <b>▾</b> — zwiń podgląd.</li>
    </ul>` },

  { cat: '7. Podłącz do postaci', html: `<h4>Klasa aktora</h4>
    <div class="ge-doc-row">${geZdShot('14-klasa-aktora.webp', 'BP_Gracz › Ustawienia klasy › Animacja (Paper ZD).')}<div>
      <ol class="ge-steps">
        <li>Otwórz klasę postaci i kliknij <b>⚙ Ustawienia klasy</b>.</li>
        <li>W kategorii <b>Animacja (Paper ZD)</b> wybierz <b>Animation Blueprint</b> (albo <b>＋ Nowy Animation Blueprint</b>).</li>
        <li><b>Komponent renderu</b> — który komponent pokazuje animację. <i>Automatycznie</i> bierze pierwszy komponent Sprite / Animacja. Dobrze, żeby klasa miała komponent <b>Sprite / Animacja</b> w rozmiarze klatki (albo jej wielokrotności).</li>
      </ol></div></div>
    ${geZdShot('16-gra.webp', 'W grze kotek sam przełącza Idle, Run i Jump i odwraca się w stronę ruchu.')}
    ${geZdTip('Na Widoku poziomu postać od razu pokazuje pierwszą klatkę stanu Entry — widać, jak będzie wyglądać w grze.')}
    ${geZdWarn('Węzeł <i>Set Flipbook</i> na tym samym komponencie nic nie da — Animation Blueprint co klatkę ustawia własną animację. Do jednorazowych animacji służy <b>Play Animation Override</b>.')}` },

  { cat: 'Notify i dźwięki', html: `<h4>Dźwięk kroków</h4>
    <p><b>Sposób 1 — bez bloczków:</b> w Anim Source dodaj notify na klatkach, w których stopa dotyka ziemi, i wybierz mu dźwięk.</p>
    <p><b>Sposób 2 — zdarzenie:</b> nazwij notify <i>Krok</i>. W Event Graph Animation Blueprintu (albo klasy gracza) PPM › <b>AnimNotify_Krok</b> i podłącz, co chcesz:</p>
    <pre>${geHighlight(`// AnimNotify_Krok → Play Sound 2D (SFX_Krok)
onNotify_Krok() {
  G.playSound("SFX_Krok");
}`)}</pre>
    <ul class="ge-doc-list">
      <li>Zdarzenie AnimNotify działa i w Animation Blueprincie, i w klasie aktora — wybierz, gdzie wygodniej (np. kurz spod łap w klasie gracza).</li>
      <li><b>Notify stanu</b> (Szczegóły stanu › Przy wejściu / Przy wyjściu) uruchamia się raz, przy zmianie stanu — np. <i>Hop</i> przy wejściu do Jump.</li>
      <li>W zapętlonej sekwencji notify działa w każdym obrocie pętli.</li>
    </ul>` },

  { cat: 'Jump Nodes', html: `<h4>Skok do stanu z dowolnego miejsca</h4>
    <p>Niektóre stany mogą zacząć się w każdej chwili — np. <i>Radość</i> po zebraniu gwiazdki albo <i>Potknięcie</i>. Zamiast rysować strzałki ze wszystkich stanów, dodaj <b>Jump Node</b>: PPM › <b>⤳ Dodaj Jump Node</b>, nazwij go i przeciągnij z jego brzegu strzałkę do stanu.</p>
    <div class="ge-doc-row">${geZdShot('13-jump-node.webp', 'Jump Node „Radosc” prowadzi do stanu Machanie.')}<div>
      <p>W Blueprincie (w klasie gracza albo w ABP) węzeł <b>Jump to Node (Radosc)</b> od razu przełącza maszynę na ten stan:</p>
      <pre>${geHighlight(`// BP_Gracz: Event ActorBeginOverlap → Cast To BP_Gwiazdka → Jump to Node (Radosc)
onBeginOverlap(otherActor: Actor | null) {
  if (G.isA(otherActor, BP_Gwiazdka)) {
    this.jumpToAnimNode("Radosc");
  }
}`)}</pre>
      <p>Stan <i>Machanie</i> ma wyłączone <b>Zapętlona</b> i przejście <b>Automatycznie po końcu</b> do Idle — po pomachaniu postać sama wraca.</p></div></div>` },

  { cat: 'Animacje jednorazowe', html: `<h4>Play Animation Override</h4>
    <p>Override gra sekwencję <b>raz</b>, <b>przykrywając</b> maszynę stanów — ta działa dalej pod spodem. Po końcu animacja wraca do obecnego stanu, a wykonanie idzie pinem <b>On Completed</b>. Dobre do akcji na klawisz: machanie, ukłon, podniesienie przedmiotu.</p>
    ${geZdShot('15-override.webp', 'BP_Gracz: klawisz E → Play Animation Override (AS_Kotek › Machanie) → po końcu Print String.')}
    <pre>${geHighlight(`onKeyPressed_E() {
  // "bp50:q4" — id Anim Source i id sekwencji (AS_Kotek › Machanie); wstawia je węzeł.
  this.playAnimationOverride("bp50:q4", 1, () => {
    G.print("Pomachałem!");
  });
}`)}</pre>
    <ul class="ge-doc-list">
      <li><b>Play Rate</b> — tempo override'u.</li>
      <li>Nowy override przerywa poprzedni (bez jego On Completed). <b>Stop All Animation Overrides</b> przerywa od razu.</li>
      <li>Override czy stan z Jump Node? Override — gdy animacja nie zmienia „stanu” postaci i ma potem wrócić tam, gdzie była. Jump Node — gdy to nowy stan z własnymi przejściami.</li>
    </ul>` },

  { cat: 'Widok z góry (4 / 8 kierunków)', html: `<h4>Postać RPG chodząca w 4 strony</h4>
    <ol class="ge-steps">
      <li>Przygotuj Flipbooki chodu: <b>przodem</b> (w dół ekranu), <b>tyłem</b> (w górę) i <b>bokiem</b> (w prawo). To samo dla Idle.</li>
      <li>W Anim Source sekwencje <i>Idle</i> i <i>Walk</i> z <b>4 kierunkami</b>: Prawo — bok, Dół — przód, Góra — tył, Lewo — puste (odbicie).</li>
      <li>W ABP stany Idle i Walk z kierunkiem <b>Z prędkości właściciela</b>. Przejścia: Speed &gt; 10 / Speed ≤ 10. IsFalling nie jest potrzebne.</li>
    </ol>
    <p>Postać patrzy w stronę ostatniego ruchu także, gdy stanie — Idle pokaże ją w tym samym kierunku. Na starcie patrzy w dół (przodem do gracza).</p>
    <p><b>Kierunek ze zmiennej:</b> gdy postać ma patrzeć gdzie indziej niż idzie (np. na kursor), ustaw w stanie <b>Kierunek: Ze zmiennej</b> i w Event Graph licz kąt w stopniach: 0 — prawo, 90 — dół, 180 — lewo, 270 — góra. Przy 8 kierunkach skosy są co 45°.</p>` },

  { cat: 'Tempo zależne od prędkości', html: `<h4>Koniec ze „ślizganiem się”</h4>
    <p>Gdy postać idzie wolno, a nogi przebierają jak w biegu, wygląda to, jakby ślizgała się po lodzie. Rozwiązanie: tempo animacji zależne od prędkości.</p>
    <ol class="ge-steps">
      <li>W stanie Run ustaw <b>× zmienna: Speed</b>.</li>
      <li><b>Play Rate</b> = 1 ÷ prędkość, przy której animacja wygląda dobrze. Np. bieg narysowany dla 250 px/s → Play Rate <b>0.004</b>.</li>
    </ol>
    <p>Teraz przy 125 px/s nogi ruszają się dwa razy wolniej, a przy 500 px/s dwa razy szybciej. Sprawdź to w Podglądzie suwakiem Speed.</p>` },

  { cat: 'Kod TypeScript', html: `<h4>Co powstaje z Animation Blueprintu</h4>
    <p>Animation Blueprint to klasa dziedzicząca po <code>AnimInstance</code>. Maszyna stanów trafia do <code>static animGraph</code>, a Event Graph — do metod <code>animInit</code>, <code>animUpdate</code> i <code>onNotify_…</code>:</p>
    <pre>${geHighlight(`class ABP_Kotek extends AnimInstance {
  static animGraph = { entry: "s1", states: [/* Idle, Run, Jump… */], transitions: [/* warunki */], jumps: { Radosc: "s50" } };

  constructor(game: Game, data: ActorData) {
    super(game, data);
    this.vars.Speed = 0;
    this.vars.IsFalling = false;
  }

  // Event Blueprint Update Animation
  animUpdate(deltaTimeX: number) {
    this.vars.Speed = this.tryGetPawnOwner().velocity.length();
    this.vars.IsFalling = !this.tryGetPawnOwner().isOnGround();
  }
}`)}</pre>
    <table class="ge-doc-table">
      <tr><th>W kodzie</th><th>Co robi</th></tr>
      <tr><td><code>this.tryGetPawnOwner()</code></td><td>aktor, którego animuje ABP</td></tr>
      <tr><td><code>actor.animInstance()</code></td><td>Anim Instance aktora (węzeł Get Anim Instance)</td></tr>
      <tr><td><code>actor.jumpToAnimNode("Nazwa")</code></td><td>Jump to Node</td></tr>
      <tr><td><code>actor.playAnimationOverride(sekwencja, tempo, poKoncu)</code></td><td>Play Animation Override</td></tr>
      <tr><td><code>actor.stopAllAnimationOverrides()</code></td><td>Stop All Animation Overrides</td></tr>
      <tr><td><code>actor.animStateName()</code></td><td>nazwa obecnego stanu</td></tr>
      <tr><td><code>actor.setAnimBlueprint(ABP_Inny)</code></td><td>Set Anim Blueprint</td></tr>
    </table>
    <p>Kolejność w każdej klatce: ruch i kolizje aktorów → <i>Update Animation</i> → przejścia (najwyżej jedno) → odtwarzanie sekwencji i notify → ustawienie klatki na komponencie.</p>` },

  { cat: 'Gdy coś nie działa', html: `<h4>Najczęstsze problemy</h4>
    <table class="ge-doc-table">
      <tr><th>Objaw</th><th>Przyczyna i rozwiązanie</th></tr>
      <tr><td>Postać się nie animuje</td><td>Klasa nie ma Animation Blueprintu (Ustawienia klasy › Animacja), ABP nie ma Anim Source albo stan nie ma sekwencji. Kliknij <b>Kompiluj</b> — Wyniki kompilatora powiedzą, czego brakuje.</td></tr>
      <tr><td>Animacja pokazuje się na złym komponencie</td><td>Ustaw <b>Komponent renderu</b> w Ustawieniach klasy aktora.</td></tr>
      <tr><td>Stan nigdy się nie zmienia</td><td>Zmienne nie są ustawiane — sprawdź Event Graph (Update Animation). W Podglądzie przesuń suwak: jeśli tam działa, problem jest w Event Graph.</td></tr>
      <tr><td>Strzałka jest pomarańczowa i przerywana</td><td>Przejście nie ma warunku ani „Automatycznie po końcu”.</td></tr>
      <tr><td>Postać miga między stanami</td><td>Dwie różne granice (np. &gt; 20 i &lt; 5) albo warunki, które wykluczają się nawzajem.</td></tr>
      <tr><td>Skok „zacina się” na ostatniej klatce</td><td>To dobrze, gdy stan Jump nie jest zapętlony — dodaj Fall albo zapętl ostatnią sekwencję lotu.</td></tr>
      <tr><td>„Automatycznie po końcu” nie działa</td><td>Sekwencja w stanie jest zapętlona albo jej Flipbook ma 1 klatkę z 0 kl./s — wyłącz Zapętlona i ustaw kl./s.</td></tr>
      <tr><td>Postać podskakuje przy zmianie animacji</td><td>Klatki mają różne rozmiary albo stopy w różnych miejscach (dział 1).</td></tr>
      <tr><td>Postać ślizga się po ziemi</td><td>Na rysunku przesuwa się w kadrze (włącz „Postać w miejscu” w rotoskopii) albo tempo nie pasuje do prędkości (dział <i>Tempo zależne od prędkości</i>).</td></tr>
      <tr><td>Patrzy w złą stronę</td><td>Flipbook „Prawo” jest narysowany w lewo — narysuj w prawo albo przypisz go do „Lewo”.</td></tr>
      <tr><td>Notify nie działa</td><td>Nazwa zdarzenia AnimNotify_… musi być taka sama jak nazwa notify. Klatka notify liczy się od 1.</td></tr>
    </table>` }
];

function geDocZdEntries() {
  return GE_DOC_ZD.map((sec) => ({ cat: sec.cat, search: (sec.cat + ' ' + sec.html.replace(/<[^>]+>/g, ' ')).toLowerCase(), html: `<section class="ge-doc-sec ge-doc-zd">${sec.html}</section>` }));
}
