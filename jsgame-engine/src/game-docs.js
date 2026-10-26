// Dokumentacja JSGame Engine (menu Pomoc › Dokumentacja): Blueprinty i TypeScript.
//
// Karta „Blueprinty” powstaje sama z GE_NODE_LIST: opis, piny i kod TypeScript każdego węzła liczony tym
// samym stmt/gen/expr, którego używa kompilator — więc nowy węzeł od razu trafia do dokumentacji.
// Karta „TypeScript” opisuje to, z czego korzysta wygenerowany kod: Actor, Widget, G i vec (game-runtime.js).
// Karta „Animacje postaci” to poradnik Anim Source i Animation Blueprintu (game-paperzd-docs.js).

// Przykładowa klasa, na której liczymy tytuły, piny i kod węzłów w dokumentacji.
const GE_DOC_BP = {
  id: 'doc', kind: 'actor', name: 'BP_Gracz',
  components: [{ id: 'c1', type: 'box', name: 'Komponent' }],
  variables: [{ id: 'v1', name: 'Punkty', type: 'int', value: 0 }],
  funcs: [{ id: 'f1', name: 'Obrazenia', inputs: [{ id: 'p1', name: 'Sila', type: 'float' }], outputs: [{ id: 'p2', name: 'Zycie', type: 'float' }], graph: { nodes: [], links: [] } }],
  widget: { elements: [] }
};

// Węzły zmiennych są ukryte w menu (wyciąga się je z panelu Mój Blueprint), więc nie mają własnego opisu.
const GE_DOC_EXTRA = {
  var_get: { title: 'Get (zmienna)', desc: 'Odczytuje zmienną tego Blueprintu. Przeciągnij zmienną z panelu Mój Blueprint na graf i wybierz Get.' },
  var_set: { title: 'Set (zmienna)', desc: 'Zapisuje nową wartość zmiennej tego Blueprintu. Przeciągnij zmienną z panelu Mój Blueprint na graf i wybierz Set.' },
  ev_interface: { title: 'Event (funkcja interfejsu)' },
  call_interface: { title: 'Funkcja interfejsu (Message)' }
};

const GE_DOC_KINDS = {
  event: ['Zdarzenie', 'Czerwony nagłówek. Tu zaczyna się łańcuch białych kabli — w kodzie to metoda klasy.'],
  exec: ['Akcja', 'Niebieski nagłówek. Robi jedną rzecz i idzie dalej białym pinem — w kodzie to jedna instrukcja.'],
  flow: ['Sterowanie', 'Szary nagłówek. Decyduje, którędy i ile razy pójdzie wykonanie (if, for, opóźnienia).'],
  pure: ['Czysty (oblicza)', 'Zielony nagłówek, bez białych pinów. Tylko liczy wynik — w kodzie to wyrażenie wstawione w miejsce kabla.'],
  reroute: ['Pomocniczy', 'Kropka na kablu (dwuklik albo PPM na kablu). Tylko porządkuje połączenia — w kodzie jej nie ma.']
};

// Nazwa pinu jako nazwa w przykładowym kodzie: „First Index” → firstIndex.
function geDocIdent(name, fallback) {
  const words = GE_RT.ident(name || fallback).split('_').filter(Boolean);
  return words.map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w[0].toLowerCase() + w.slice(1))).join('') || fallback;
}

function geDocNode(def) {
  const node = { id: 'n1', type: def.type, x: 0, y: 0, props: {}, values: {} };
  (def.props ?? []).forEach((p) => {
    node.props[p.id] = p.kind === 'component' ? 'c1' : p.kind.startsWith('iface-fn') ? 'Interakcja:Uzyj' : p.kind === 'sprite' ? 'FB_Bieg' : p.def;
  });
  if (def.type === 'var_get' || def.type === 'var_set') node.props.var = 'v1';
  if (def.cat === 'Funkcje') node.props.fn = 'f1';
  return node;
}

// Kod TypeScript węzła: niepodłączone piny to nazwy pinów, a białe wyjścia — komentarze „→ Pin”.
function geDocCode(def, node, pins) {
  const pinName = (list, id) => list.find((p) => p.id === id);
  const c = {
    id: node.id,
    node,
    in: (id) => {
      const pin = pinName(pins.ins, id);
      if (!pin) return 'undefined';
      return pin.self ? 'this' : geDocIdent(pin.name, id);
    },
    exec: (id) => `// → ${pinName(pins.outs, id)?.name || 'dalej'}`,
    prop: (id) => node.props?.[id] ?? def.props?.find((p) => p.id === id)?.def,
    cls: (id, kind = 'actor') => (kind === 'widget' ? 'WBP_Wynik' : 'BP_Moneta'),
    mat: () => `{ color: '${GE_MATERIAL_DEFAULTS.color}', opacity: ${GE_MATERIAL_DEFAULTS.opacity}, glow: ${GE_MATERIAL_DEFAULTS.glow} }`,
    comp: () => '"Komponent"',
    local: (id) => pinName(pins.outs, id)?.local ?? id,
    method: () => ({ name: 'beginPlay', paramList: '' }),
    v: () => 'Punkty',
    fn: () => GE_DOC_BP.funcs[0]
  };
  try {
    if (def.kind === 'reroute') return '';
    if (def.kind === 'event') {
      return geEventMethods(node, GE_DOC_BP).map((m) => `${m.name}(${m.params}) {\n  // → ${pinName(pins.outs, m.pin)?.name || 'dalej'}\n}`).join('\n');
    }
    if (def.kind === 'pure') {
      const outs = pins.outs.filter((p) => p.type !== 'exec');
      if (outs.length === 1) return def.expr(c, outs[0].id);
      return outs.map((p) => `${geDocIdent(p.name, p.id)} = ${def.expr(c, p.id)}`).join('\n');
    }
    if (def.gen) return def.gen(c);
    const next = c.exec('then');
    return `${def.stmt(c)}\n${next}`;
  } catch {
    return '';
  }
}

function geDocPins(list, dir) {
  if (!list.length) return '';
  return `<div class="ge-doc-pins"><b>${dir}</b>${list.map((p) => {
    const t = GE_TYPES[p.type] ?? GE_TYPES.exec;
    const name = p.name || (p.type === 'exec' ? (dir === 'Wejścia' ? 'wykonanie' : 'dalej') : 'wartość');
    const def = dir !== 'Wejścia' || p.type === 'exec' || p.def === undefined || p.def === null ? '' : ` = ${geEsc(geLiteral(p.def, p))}`;
    const self = p.self ? ' <i>(puste = ten aktor)</i>' : '';
    return `<span class="ge-doc-pin"><span class="ge-doc-dot" style="--c:${t.color}"></span>${geEsc(name)} <small>${geEsc(t.label)}${def}</small>${self}</span>`;
  }).join('')}</div>`;
}

function geDocBlueprintEntries() {
  return GE_NODE_LIST.filter((def) => !def.legacy).map((def) => {
    const node = geDocNode(def);
    let pins;
    let title;
    try {
      pins = gePins(node, GE_DOC_BP);
      title = GE_DOC_EXTRA[def.type]?.title ?? geNodeTitle(node, GE_DOC_BP);
    } catch {
      pins = { ins: def.ins ?? [], outs: def.outs ?? [] };
      title = def.pl;
    }
    const desc = def.desc ?? GE_DOC_EXTRA[def.type]?.desc ?? '';
    const notes = [];
    if (def.actorOnly) notes.push('Tylko w klasie Blueprint aktora.');
    if (def.widgetOnly) notes.push('Tylko w Widget Blueprincie.');
    if (def.classOnly) notes.push('Nie działa w Level Blueprincie.');
    if (def.childOnly) notes.push('Tylko w klasie, która ma klasę nadrzędną.');
    if (GE_NO_CONSTRUCTION.has(def.type)) notes.push('Nie działa w Construction Script.');
    const props = (def.props ?? []).map((p) => p.name);
    const code = geDocCode(def, node, pins);
    const html = `<article class="ge-doc-entry ge-k-${def.kind}">
      <header><span class="ge-doc-head">${geEsc(title)}</span><span class="ge-doc-pl">${geEsc(def.pl)}</span><span class="ge-doc-kind">${geEsc(GE_DOC_KINDS[def.kind][0])}</span></header>
      <p>${geEsc(desc)}</p>
      ${props.length ? `<p class="ge-doc-note">Ustawienia w węźle: <b>${geEsc(props.join(', '))}</b></p>` : ''}
      ${geDocPins(pins.ins, 'Wejścia')}${geDocPins(pins.outs, 'Wyjścia')}
      ${notes.length ? `<p class="ge-doc-note">⚠ ${geEsc(notes.join(' '))}</p>` : ''}
      ${code ? `<div class="ge-doc-js"><b>TypeScript</b><pre>${geHighlight(code)}</pre></div>` : ''}
    </article>`;
    return { cat: def.cat, search: `${title} ${def.pl} ${desc} ${def.type} ${code}`.toLowerCase(), html };
  });
}

function geDocBlueprintIntro() {
  const types = Object.values(GE_TYPES).map((t) => `<li><span class="ge-doc-dot" style="--c:${t.color}"></span>${geEsc(t.label)}</li>`).join('');
  const kinds = Object.entries(GE_DOC_KINDS).map(([k, [name, text]]) => `<li><span class="ge-doc-swatch ge-k-${k}"></span><b>${name}</b> — ${geEsc(text)}</li>`).join('');
  return `<section class="ge-doc-intro" data-cat="Wstęp"><h4>Jak czytać węzeł</h4>
    <p>Blueprint to graf węzłów. Wykonanie zaczyna się od <b>zdarzenia</b> i biegnie <b>białymi kablami</b> od lewej do prawej. <b>Kolorowe kable</b> niosą dane: liczby, teksty, wektory i aktorów. Kabel puszczony w pustym miejscu otwiera menu z pasującymi węzłami.</p>
    <ul class="ge-doc-list">${kinds}</ul>
    <h4>Kolory pinów (typy danych)</h4>
    <ul class="ge-doc-list ge-doc-cols">${types}</ul>
    <p>Liczba całkowita i ułamkowa łączą się ze sobą same, a każdą wartość można podłączyć do pinu tekstu. Niepodłączony pin <b>Target</b> oznacza „ten aktor” (<code>this</code>).</p>
    <h4>Rodzaje grafów</h4>
    <ul class="ge-doc-list">
      <li><b>Event Graph</b> — zdarzenia i logika gry. Każdy Blueprint ma własny.</li>
      <li><b>Construction Script</b> — wykonuje się, gdy aktor powstaje (także w edytorze, przy każdej zmianie). Nie ma tu opóźnień, sterowania ani dźwięków.</li>
      <li><b>Funkcja</b> — Twój własny węzeł (Mój Blueprint › Funkcje ＋). Ma wejścia, wyjścia i własny graf, który kończy <i>Return Node</i>. Nie może czekać (bez Delay).</li>
      <li><b>Level Blueprint</b> — logika całego poziomu (Blueprinty › Otwórz Level Blueprint).</li>
      <li><b>Widget Blueprint</b> — napisy i przyciski na ekranie, ma własne zdarzenia <i>Event Construct</i> i <i>On Clicked</i>.</li>
    </ul>
    <h4>Zmienne</h4>
    <p>Dodajesz je w panelu <b>Mój Blueprint</b> (＋ Zmienna). Przeciągnij zmienną na graf, żeby dostać węzeł <b>Get</b> albo <b>Set</b>. Zaznaczona jako <i>edytowalna</i> pojawia się w Szczegółach aktora na poziomie, więc każda kopia może mieć inną wartość.</p>
    <p>Obok typu w Szczegółach zmiennej wybierasz <b>kontener</b>, jak w Unreal Engine: <b>Single</b> (jedna wartość), <b>Array</b> (tablica, <code>[...]</code>), <b>Set</b> (zbiór bez powtórzeń, <code>new Set()</code>) albo <b>Map</b> (pary klucz → wartość, <code>new Map()</code>). Węzły For Each Loop, Length i Get dopasowują się do typu podłączonej tablicy.</p>
  </section>`;
}

// ---------- TypeScript ----------

const geDocFn = (sig, desc) => ({ sig, desc });

const GE_DOC_JS = [
  { cat: 'Wstęp', html: `<h4>Skąd się bierze kod</h4>
    <p>JSGame Engine zamienia każdy Blueprint w <b>klasę TypeScript</b>. Kod widzisz na żywo w panelu <b>Kod TypeScript</b>; do wyeksportowanej gry trafia ten sam kod bez typów (przeglądarka wykonuje JavaScript). Kodu Blueprintów nie wpisuje się ręcznie — zmieniasz węzły, a kod zmienia się sam. Własny kod piszesz w <b>klasach TypeScript</b> (Przeglądarka zawartości › Utwórz klasę TypeScript). Ta karta tłumaczy, co oznacza każda linijka.</p>
    <pre>${geHighlight(`// Kod TypeScript wygenerowany z Blueprintów przez JSGame Engine.
const { Actor, Widget, G, vec } = runtime;

// Blueprint: BP_Gracz
class BP_Gracz extends Actor {
  static bpId = "bp1";

  constructor(game: Game, data: ActorData) {
    super(game, data);
    this.vars.Punkty = 0;          // zmienna z panelu Mój Blueprint
  }

  // Event BeginPlay
  beginPlay() {
    G.print("Start!");
  }

  // Event Tick
  tick(deltaSeconds: number) {
    this.addMovementInput(vec(1, 0), G.axis('horizontal'));
  }

  // Space Bar
  onKeyPressed_Space() {
    this.jump();
    G.playSound("jump");
  }
}`)}</pre>
    <ul class="ge-doc-list">
      <li><code>class BP_Gracz extends Actor</code> — klasa Blueprint dziedziczy po <b>Actor</b>, Widget Blueprint po <b>Widget</b>, Level Blueprint to klasa <code>LevelBlueprint</code>. Klasa z wybraną <b>klasą nadrzędną</b> dziedziczy po niej: <code>class BP_Boss extends BP_Wrog</code>.</li>
      <li>Każde <b>zdarzenie</b> to metoda klasy, a łańcuch białych kabli za nim to jej treść.</li>
      <li><code>this</code> — ten aktor (pin Self / pusty Target). <code>G</code> — cała gra. <code>vec(x, y)</code> — wektor.</li>
      <li>Zmienne Blueprintu żyją w <code>this.vars</code>, wyniki węzłów (np. Spawn Actor) — w zmiennych lokalnych <code>let</code> z typem, np. <code>let actor3: Actor | null</code>.</li>
      <li>Parametry zdarzeń i funkcji mają typy pinów: <code>tick(deltaSeconds: number)</code>, <code>onHit(otherActor: Actor | null)</code>.</li>
      <li>Nazwy tracą polskie znaki i spacje: zmienna „Życia gracza” to <code>this.vars.Zycia_gracza</code>.</li>
    </ul>` },
  { cat: 'Zdarzenia → metody', html: `<h4>Zdarzenia → metody</h4>
    <p>Silnik sam wywołuje te metody we właściwym momencie. Metoda, której nie ma w klasie, jest po prostu pomijana.</p>`,
    fns: [
      geDocFn('construct()', 'Construction Script — gdy aktor powstaje, przed beginPlay (w edytorze po każdej zmianie).'),
      geDocFn('beginPlay()', 'Event BeginPlay / Event Construct — raz, na start aktora albo widgetu.'),
      geDocFn('tick(deltaSeconds)', 'Event Tick — co klatkę; deltaSeconds to czas od poprzedniej klatki w sekundach.'),
      geDocFn('onKeyPressed_Space() / onKeyReleased_Space()', 'Zdarzenie klawisza: naciśnięcie / puszczenie. Zamiast Space: Enter, Left, Right, Up, Down, Shift, Ctrl, A–Z, 0–9, LeftMouseButton, RightMouseButton, MiddleMouseButton, MouseWheelUp, MouseWheelDown.'),
      geDocFn('onAnyKeyPressed(anyKey) / onAnyKeyReleased(anyKey)', 'Any Key — dowolny klawisz albo przycisk myszy; anyKey to jego nazwa.'),
      geDocFn('onBeginOverlap(otherActor) / onEndOverlap(otherActor)', 'Inny aktor zaczął / przestał na mnie nachodzić (kolizja „Nakłada się”).'),
      geDocFn('onCompOverlap_Nazwa(otherActor) / onCompEndOverlap_Nazwa(otherActor)', 'To samo, ale dla jednego komponentu o tej nazwie.'),
      geDocFn('onHit(otherActor)', 'Zderzenie z blokującym aktorem.'),
      geDocFn('onClicked(touchedActor, buttonPressed) / onReleased(touchedActor, buttonReleased)', "Wciśnięcie / puszczenie przycisku myszy nad aktorem (buttonPressed np. 'LeftMouseButton'). Działa przy Enable Click Events Player Controllera."),
      geDocFn('onBeginCursorOver(touchedActor) / onEndCursorOver(touchedActor)', 'Kursor wjechał na aktora / zjechał z niego. Działa przy Enable Mouse Over Events Player Controllera.'),
      geDocFn('onDestroyed()', 'Aktor został zniszczony (także po spadnięciu poniżej Kill Y).'),
      geDocFn('onButton_Nazwa()', 'Kliknięto przycisk widgetu o tej nazwie (puszczono go na nim).'),
      geDocFn('onButtonPressed_Nazwa() / onButtonReleased_Nazwa()', 'Przycisk widgetu wciśnięty / puszczony.'),
      geDocFn('onButtonHovered_Nazwa() / onButtonUnhovered_Nazwa()', 'Kursor najechał na przycisk widgetu / zjechał z niego.'),
      geDocFn('ev_Nazwa(arg_1, arg_2…)', 'Zdarzenie własne (Custom Event) — uruchamia je callEvent albo timer. Parametry (Inputs) dodasz w Szczegółach węzła.'),
      geDocFn('if_Interfejs_Funkcja()', 'Funkcja Blueprint Interface — uruchamia ją G.callInterface.'),
      geDocFn('fn_Nazwa(wejście_1: typ, …): { Wynik: typ }', 'Funkcja z panelu Mój Blueprint › Funkcje. Wywołuje ją węzeł funkcji (this.fn_Nazwa(…)), a Return Node zwraca obiekt z wynikami, np. { Wynik: 5 }.')
    ] },
  { cat: 'Actor — pola', html: `<h4>Actor — pola</h4><p>Każdy aktor (<code>this</code>, <code>otherActor</code>, wynik <code>G.spawn</code>…) ma te pola. Pozycja to <b>środek</b> aktora, oś Y rośnie <b>w dół</b>, jednostka to piksel.</p>`,
    fns: [
      geDocFn('x, y', 'Położenie w świecie gry.'),
      geDocFn('location', 'Położenie jako wektor (tylko do odczytu — zmieniaj przez setLocation).'),
      geDocFn('rotation', 'Obrót w stopniach.'),
      geDocFn('scaleX, scaleY', 'Skala (1 = normalny rozmiar).'),
      geDocFn('w, h', 'Szerokość i wysokość kształtu w pikselach.'),
      geDocFn('vx, vy / velocity', 'Prędkość w pikselach na sekundę; velocity to ten sam wektor.'),
      geDocFn('onGround', 'true, gdy aktor z grawitacją stoi na czymś.'),
      geDocFn('color, text, emoji, opacity, visible', 'Wygląd aktora.'),
      geDocFn("collision", "'block' (blokuje), 'overlap' (nakłada się) albo 'none' (bez kolizji)."),
      geDocFn('gravity, moveSpeed, jumpSpeed', 'Ustawienia ruchu z panelu Szczegóły klasy.'),
      geDocFn('name, className', 'Nazwa aktora na poziomie i nazwa jego klasy.'),
      geDocFn('vars', 'Zmienne Blueprintu: this.vars.Punkty.'),
      geDocFn('dead', 'true po zniszczeniu — sprawdzaj przez G.isValid(aktor).'),
      geDocFn('game', 'Gra, w której żyje aktor (to samo co G).')
    ] },
  { cat: 'Actor — metody', html: '<h4>Actor — metody</h4><p>Wywołujesz je na aktorze: <code>this.jump()</code>, <code>otherActor.destroy()</code>.</p>',
    fns: [
      geDocFn('setLocation(v)', 'Przenosi aktora w punkt v (wektor), bez sprawdzania kolizji.'),
      geDocFn('addOffset(v)', 'Przesuwa o v, zatrzymując się na blokujących aktorach.'),
      geDocFn('setRotation(deg) / addRotation(deg)', 'Ustawia / dodaje obrót w stopniach.'),
      geDocFn('setScale(v)', 'Skala: v.x poziomo, v.y pionowo.'),
      geDocFn('setVelocity(v) / launch(v)', 'Ustawia prędkość / dodaje do niej (wyrzut, odrzut).'),
      geDocFn('addMovementInput(direction, scale = 1)', 'Ruch w danym kierunku z prędkością moveSpeed — wywołuj co klatkę w tick.'),
      geDocFn('jump()', 'Skok z prędkością jumpSpeed (z grawitacją — tylko z ziemi).'),
      geDocFn('isOnGround()', 'Czy aktor stoi na ziemi.'),
      geDocFn('destroy()', 'Niszczy aktora (wywoła onDestroyed).'),
      geDocFn('setColor(color) / setText(text) / setVisible(visible)', 'Zmienia kolor (np. "#ff0000"), napis albo widoczność.'),
      geDocFn('setMaterial({ color, opacity, glow })', 'Nakłada wygląd z Materiału.'),
      geDocFn('setSprite(id)', 'Zmienia Sprite albo Animację (Flipbook) aktora.'),
      geDocFn('distanceTo(other)', 'Odległość do innego aktora w pikselach.'),
      geDocFn('callEvent(name, ...args)', 'Uruchamia zdarzenie własne o tej nazwie (metoda ev_Nazwa) i przekazuje mu parametry.'),
      geDocFn('bindEvent(key, delegate(name)) / unbindEvent(key, delegate(name)) / unbindAllEvents(key)', 'Event Dispatcher: podpina / odpina zdarzenie własne ev_Nazwa (także innego aktora) / odpina wszystkie.'),
      geDocFn('dispatch(key, ...args)', 'Event Dispatcher (Call): uruchamia wszystkie podpięte zdarzenia z tymi parametrami.'),
      geDocFn('setTimer(name, seconds, looping) / clearTimer(name)', 'Uruchamia zdarzenie własne po czasie (w kółko, gdy looping) / zatrzymuje timer.'),
      geDocFn('delay(key, seconds, fn)', 'Węzeł Delay: wywoła fn po czasie. Drugie wywołanie w trakcie odliczania jest pomijane.'),
      geDocFn('doOnce(key) / flipFlop(key)', 'Węzły Do Once i FlipFlop: true tylko za pierwszym razem / na przemian true i false.'),
      geDocFn('timeline(key)', 'Węzeł Timeline (ustawienia w static timelines klasy): play(), reverse(), stop(), playFromStart(), reverseFromEnd(), setNewTime(t), setPlayRate(r), setLooping(on), setTimelineLength(s); pola position, playing, reversed, direction ("Forward" / "Backward"), timelineLength i value(idŚcieżki).')
    ] },
  { cat: 'Komponenty', html: '<h4>Komponenty</h4><p>Komponenty z zakładki Viewport znajdziesz po nazwie. Położenie i obrót komponentu liczą się względem środka aktora.</p>',
    fns: [
      geDocFn('comp(name)', 'Komponent o tej nazwie: pola x, y, w, h, rotation, color, text, visible, collisionEnabled, active.'),
      geDocFn('components', 'Lista wszystkich komponentów aktora (każdy aktor ma własne kopie).'),
      geDocFn('componentLocation(name)', 'Położenie komponentu jako wektor.'),
      geDocFn('setComponentLocation(name, v) / setComponentSize(name, v)', 'Przesuwa komponent / zmienia jego rozmiar (v.x = szerokość, v.y = wysokość).'),
      geDocFn('setComponentActive(name, active)', 'Włącza / wyłącza komponent ruchu (Obracanie, Pocisk). Włączony Pocisk od razu leci.')
    ] },
  { cat: 'Widget', html: '<h4>Widget</h4><p>Widget Blueprint dziedziczy po <code>Widget</code> (a ten po Actor, więc ma zdarzenia, zmienne i timery). Na ekranie jest dopiero po <code>addToViewport()</code>.</p>',
    fns: [
      geDocFn('addToViewport() / removeFromParent()', 'Pokazuje widget na ekranie / chowa go.'),
      geDocFn('element(name)', 'Element z Projektanta o tej nazwie: pola x, y, w, h, text, color, bg, size, hidden.'),
      geDocFn('elements', 'Lista wszystkich elementów widgetu.'),
      geDocFn('setWidgetText(name, text)', 'Zmienia napis elementu (np. wynik).'),
      geDocFn('setWidgetVisible(name, visible)', 'Pokazuje / chowa element.'),
      geDocFn('inViewport', 'true, gdy widget jest na ekranie.'),
      geDocFn('childWidget(name)', 'Zagnieżdżony widget (element „Widget” z Projektanta) o tej nazwie — osobna instancja z własnymi zdarzeniami i zmiennymi. Węzeł „Get <nazwa>”.'),
      geDocFn('parentWidget', 'U zagnieżdżonego widgetu: widget, w który jest wstawiony.')
    ] },
  { cat: 'G — gra', html: '<h4>G — gra</h4><p><code>G</code> to cała gra: aktorzy, klawisze, punkty, dźwięki i kamera.</p>',
    fns: [
      geDocFn('G.spawn(Klasa, location)', 'Tworzy nowego aktora klasy w punkcie location i zwraca go.'),
      geDocFn('G.findActor(Klasa) / G.allOf(Klasa) / G.countOf(Klasa)', 'Pierwszy żywy aktor tej klasy (albo null) / tablica wszystkich (węzeł Get All Actors Of Class) / ile ich jest.'),
      geDocFn('G.isA(aktor, Klasa) / G.isValid(aktor)', 'Czy aktor jest tej klasy / czy istnieje i nie jest zniszczony.'),
      geDocFn('G.getPlayerPawn() / G.getGameMode() / G.getPlayerController() / G.getHudWidget()', 'Aktor gracza (Default Pawn), GameMode, Player Controller i HUD z Ustawień świata.'),
      geDocFn('G.getGameInstance()', 'Game Instance z Ustawień świata: jeden obiekt na całą grę, przetrwa Open Level. Jego zmienne: G.getGameInstance().vars.Punkty.'),
      geDocFn('G.createWidget(KlasaWidgetu)', 'Tworzy widget (potem addToViewport()).'),
      geDocFn('G.callInterface(aktor, metoda) / G.implements(aktor, id)', 'Wywołuje funkcję interfejsu, jeśli aktor ją ma / czy klasa implementuje interfejs.'),
      geDocFn("G.isKeyDown('Space')", 'Czy klawisz jest wciśnięty w tej chwili.'),
      geDocFn("G.axis('horizontal' | 'vertical')", 'Oś ruchu: −1, 0 albo 1 (A/D i ←/→ albo W/S i ↑/↓; w dół to +1).'),
      geDocFn('G.mouse', 'Położenie myszy w świecie gry (wektor).'),
      geDocFn('G.mouseScreen', 'Położenie myszy na ekranie gry (wektor, lewy górny róg to 0, 0).'),
      geDocFn('G.actorUnderCursor()', 'Aktor pod kursorem myszy albo null.'),
      geDocFn("G.setMouseInterface(pc, 'showMouseCursor', true)", "Mouse Interface Player Controllera: showMouseCursor, enableClickEvents, enableMouseOverEvents albo defaultMouseCursor ('Hand', 'Crosshairs'…). pc = null — Player Controller z Ustawień świata."),
      geDocFn("G.setInputMode('game' | 'ui' | 'gameui')", 'Set Input Mode: tylko gra, tylko przyciski widgetów albo jedno i drugie (domyślnie).'),
      geDocFn('G.time', 'Czas gry w sekundach od startu.'),
      geDocFn('G.randomFloat(min, max) / G.randomInt(min, max)', 'Losowa liczba ułamkowa / całkowita (z min i max włącznie).'),
      geDocFn('G.getVar(name) / G.setVar(name, value) / G.addVar(name, amount)', 'Stare zmienne gry po nazwie (np. "Punkty"; brak zmiennej = 0). W Blueprintach zamiast nich: zmienne Game Instance albo GameMode.'),
      geDocFn('G.setHud(slot, text)', 'Napis w rogu ekranu w miejscu slot; pusty tekst go usuwa.'),
      geDocFn('G.showMessage(text)', 'Duży komunikat na środku ekranu (pusty tekst go chowa).'),
      geDocFn('G.print(text)', 'Napis na ekranie na 3 sekundy i w Dzienniku wyjścia — do sprawdzania gry.'),
      geDocFn('G.playSound(name)', "Dźwięk wbudowany ('coin', 'jump', 'hit', 'explosion', 'blip', 'win', 'lose') albo zaimportowany."),
      geDocFn('G.cameraFollow(aktor)', 'Kamera śledzi aktora.'),
      geDocFn('G.setPaused(paused) / G.restart()', 'Pauza gry / zaczęcie poziomu od nowa (w Blueprintach: Open Level z Get Current Level Name).'),
      geDocFn('G.openLevel(name) / G.getLevelName()', 'Przejście na poziom o podanej nazwie (zmienne gry i Bazy danych zostają) / nazwa poziomu, który trwa.')
    ] },
  { cat: 'Wektor (vec)', html: '<h4>Wektor (vec)</h4><p>Wektor to para liczb X i Y — położenie, kierunek albo prędkość. Metody zwracają <b>nowy</b> wektor.</p>',
    fns: [
      geDocFn('vec(x, y)', 'Nowy wektor (węzeł Make Vector).'),
      geDocFn('v.x, v.y', 'Składowe (węzeł Break Vector).'),
      geDocFn('a.add(b) / a.sub(b)', 'Suma / różnica wektorów.'),
      geDocFn('a.scale(s)', 'Wektor pomnożony przez liczbę.'),
      geDocFn('a.length()', 'Długość wektora.'),
      geDocFn('a.lengthSquared()', 'Długość wektora do kwadratu (węzeł Vector Length Squared).'),
      geDocFn('a.dot(b)', 'Iloczyn skalarny (węzeł Dot Product).'),
      geDocFn('a.normalize()', 'Ten sam kierunek, długość 1.'),
      geDocFn('String(v)', 'Tekst „X=10 Y=20”.')
    ] },
  { cat: 'Dziedziczenie', html: `<h4>Dziedziczenie klas</h4>
    <p>Klasę nadrzędną wybierasz przy tworzeniu klasy albo klikając <b>Klasa nadrzędna</b> na pasku edytora. Klasa podrzędna dostaje zdarzenia, zmienne, komponenty i interfejsy rodzica, a w kodzie <code>extends</code> wskazuje rodzica.</p>
    <pre>${geHighlight(`class BP_Boss extends BP_Wrog {
  // Event BeginPlay
  beginPlay() {
    super.beginPlay?.();   // węzeł Call Parent Event — najpierw BeginPlay z BP_Wrog
    this.vars.Zycie = 10;  // zmienna odziedziczona z BP_Wrog
  }
}`)}</pre>
    <ul class="ge-doc-list">
      <li>Zdarzenie zdefiniowane w klasie podrzędnej <b>zastępuje</b> zdarzenie rodzica. Węzeł <b>Call Parent Event</b> (<code>super.metoda()</code>) uruchamia też wersję rodzica — nowa klasa podrzędna ma go od razu w BeginPlay, Tick i Construction Script.</li>
      <li>Zdarzenia, których klasa podrzędna nie ma, działają tak jak u rodzica.</li>
      <li>Odziedziczone zmienne i komponenty są w panelach kursywą; zmieniasz je w klasie nadrzędnej.</li>
      <li><code>G.isA(aktor, BP_Wrog)</code> i <code>G.findActor(BP_Wrog)</code> obejmują też aktorów klas podrzędnych.</li>
    </ul>` },
  { cat: 'Dekoratory (UCLASS)', html: `<h4>Klasa Blueprint dziedzicząca po klasie TypeScript</h4>
    <p>Tak jak w Unreal Engine klasa Blueprint dziedziczy po klasie C++, tu może dziedziczyć po <b>klasie TypeScript</b>. Dekoratory — odpowiedniki makr <code>UCLASS</code>, <code>UPROPERTY</code> i <code>UFUNCTION</code> — mówią, co z klasy widać w Blueprintach. Pola i metody bez dekoratora zostają tylko w kodzie.</p>
    <pre>${geHighlight(`@UCLASS(Blueprintable)
class Wrog extends Actor {
  @UPROPERTY(EditAnywhere, BlueprintReadWrite, { Category: 'Walka' })
  zycie = 3;

  @UFUNCTION(BlueprintCallable, { Category: 'Walka' })
  zadajObrazenia(ile: number): void {
    this.zycie -= ile;
    if (this.zycie <= 0) this.naSmierc();
  }

  @UFUNCTION(BlueprintImplementableEvent)
  naSmierc(): void {}
}

// Wygenerowane z Blueprintu BP_Wrog (Klasa nadrzędna: Wrog):
class BP_Wrog extends Wrog {
  constructor(game, data) {
    super(game, data);
    this.zycie = 5;                                // Ustawienia klasy
    this.zycie = data.vars["ts:zycie"] ?? this.zycie; // Szczegóły aktora
  }
  // Event naSmierc
  naSmierc() {
    this.destroy();
  }
}`)}</pre>
    <ul class="ge-doc-list">
      <li><code>@UCLASS(Blueprintable)</code> — klasa trafia na listę <b>Klasa nadrzędna</b>. Musi dziedziczyć po <code>Actor</code> (sama albo przez inną klasę TypeScript) i nie mieć konstruktora albo mieć <code>constructor(game: Game, data: ActorData)</code> z <code>super(game, data)</code>. Aktorów tworzy silnik (poziom, Spawn Actor), więc węzła Construct nie ma.</li>
      <li><code>@UPROPERTY</code>: <code>BlueprintReadWrite</code> — węzły Get i Set, <code>BlueprintReadOnly</code> — tylko Get; <code>EditAnywhere</code> — wartość w Ustawieniach klasy i w Szczegółach aktora, <code>EditDefaultsOnly</code> — tylko w Ustawieniach klasy, <code>EditInstanceOnly</code> — tylko w Szczegółach aktora, <code>VisibleAnywhere</code> — podgląd bez zmiany. Edytować da się pola <code>number</code>, <code>string</code> i <code>boolean</code>.</li>
      <li><code>@UFUNCTION</code>: <code>BlueprintCallable</code> — węzeł z białymi pinami, <code>BlueprintPure</code> — czysty węzeł z wynikiem, <code>BlueprintImplementableEvent</code> — zdarzenie, któremu treść daje Blueprint, <code>BlueprintNativeEvent</code> — to samo, ale z treścią w TypeScripcie (węzeł <b>Call Parent Event</b> ją uruchamia).</li>
      <li>Metadane w obiekcie: <code>{ Category: 'Walka', DisplayName: 'Zadaj obrażenia', ToolTip: '…' }</code> — grupa w menu i w Szczegółach, nazwa węzła i podpowiedź.</li>
      <li>Zdarzenia aktora (<code>beginPlay</code>, <code>tick</code>…) z klasy TypeScript działają w Blueprincie; jego własne Event BeginPlay / Tick je zastępują, a <b>Call Parent Event</b> uruchamia wersję z TypeScriptu.</li>
      <li>Dekoratory są tylko dla edytora — z kodu gry znikają przy kompilacji. Klasa bez żadnego dekoratora działa jak dawniej: wszystkie publiczne metody są węzłami.</li>
    </ul>` },
  { cat: 'Typy danych', html: `<h4>Typy danych</h4>
    <ul class="ge-doc-list">
      <li><span class="ge-doc-dot" style="--c:${GE_TYPES.bool.color}"></span><b>Boolean</b> → <code>boolean</code>: <code>true</code> / <code>false</code></li>
      <li><span class="ge-doc-dot" style="--c:${GE_TYPES.int.color}"></span><b>Integer</b> → <code>number</code>, liczba całkowita, np. <code>3</code> (z Float: <code>Math.trunc(x)</code>)</li>
      <li><span class="ge-doc-dot" style="--c:${GE_TYPES.float.color}"></span><b>Float</b> → <code>number</code>, np. <code>2.5</code></li>
      <li><span class="ge-doc-dot" style="--c:${GE_TYPES.string.color}"></span><b>String</b> → <code>string</code>, np. <code>"Wynik: "</code> (inne typy: <code>String(x)</code>)</li>
      <li><span class="ge-doc-dot" style="--c:${GE_TYPES.vector.color}"></span><b>Vector</b> → <code>Vec</code>: <code>vec(x, y)</code></li>
      <li><span class="ge-doc-dot" style="--c:${GE_TYPES.actor.color}"></span><b>Actor</b> → <code>Actor | null</code>: obiekt aktora albo <code>null</code> (pusty Target = <code>this</code>)</li>
    </ul>
    <h4>Błędy w grze</h4>
    <p>Gdy metoda rzuci błąd, gra działa dalej, a komunikat z nazwą klasy i zdarzenia pojawia się w <b>Dzienniku wyjścia</b>. Najczęstsza przyczyna to użycie zniszczonego albo pustego aktora — sprawdź go najpierw węzłem <b>Is Valid</b>.</p>` }
];

function geDocJsEntries() {
  return GE_DOC_JS.map((sec) => {
    const rows = (sec.fns ?? []).map((f) => `<div class="ge-doc-fn"><code>${geEsc(f.sig)}</code><span>${geEsc(f.desc)}</span></div>`).join('');
    const text = (sec.fns ?? []).map((f) => f.sig + ' ' + f.desc).join(' ');
    return { cat: sec.cat, search: (sec.cat + ' ' + sec.html.replace(/<[^>]+>/g, ' ') + ' ' + text).toLowerCase(), html: `<section class="ge-doc-sec">${sec.html}${rows ? `<div class="ge-doc-fns">${rows}</div>` : ''}</section>` };
  });
}

// ---------- Okno dokumentacji ----------

function geShowDocs(tab = 'bp') {
  if (ge.modal) ge.modal.remove();
  const wrap = document.createElement('div');
  wrap.className = 'ge-modal';
  wrap.innerHTML = `<div class="ge-modal-card ge-docs" role="dialog" aria-modal="true" aria-label="Dokumentacja">
    <div class="ge-docs-top">
      <h3>📖 Dokumentacja</h3>
      <div class="ge-docs-tabs" role="tablist">
        <button type="button" role="tab" data-tab="bp">📘 Blueprinty</button>
        <button type="button" role="tab" data-tab="js">🔷 TypeScript</button>
        <button type="button" role="tab" data-tab="zd">🏃 Animacje postaci</button>
      </div>
      <input type="search" class="ge-docs-search" placeholder="Szukaj (np. skok, timer, spawn)…" aria-label="Szukaj w dokumentacji" />
      <button type="button" class="ge-docs-close" aria-label="Zamknij">✕</button>
    </div>
    <div class="ge-docs-body">
      <nav class="ge-docs-nav" aria-label="Działy"></nav>
      <div class="ge-docs-main" tabindex="0"></div>
    </div>
  </div>`;
  const nav = wrap.querySelector('.ge-docs-nav');
  const main = wrap.querySelector('.ge-docs-main');
  const search = wrap.querySelector('.ge-docs-search');
  const cache = {};

  const render = () => {
    wrap.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === tab)));
    cache[tab] = cache[tab] ?? (tab === 'bp' ? geDocBlueprintEntries() : tab === 'zd' ? geDocZdEntries() : geDocJsEntries());
    const q = search.value.trim().toLowerCase();
    const entries = cache[tab].filter((e) => !q || q.split(/\s+/).every((w) => e.search.includes(w)));
    const cats = tab === 'bp' ? GE_CATS.filter((cat) => entries.some((e) => e.cat === cat)) : [...new Set(entries.map((e) => e.cat))];
    let html = tab === 'bp' && !q ? geDocBlueprintIntro() : '';
    html += cats.map((cat, i) => {
      const items = entries.filter((e) => e.cat === cat).map((e) => e.html).join('');
      return tab === 'bp' ? `<section data-cat="${geEsc(cat)}"><h4 class="ge-doc-cat">${geEsc(cat)}</h4>${items}</section>` : `<div data-cat="${geEsc(cat)}">${items}</div>`;
    }).join('');
    main.innerHTML = html || '<p class="ge-doc-empty">Nic nie znaleziono. Spróbuj innego słowa.</p>';
    const navCats = (tab === 'bp' && !q ? ['Wstęp'] : []).concat(cats);
    nav.innerHTML = navCats.map((cat) => {
      const n = entries.filter((e) => e.cat === cat).length;
      return `<button type="button" data-cat="${geEsc(cat)}">${geEsc(cat)}${tab === 'bp' && n ? `<small>${n}</small>` : ''}</button>`;
    }).join('');
    main.scrollTop = 0;
  };

  const close = () => {
    wrap.remove();
    if (ge) ge.modal = null;
  };
  wrap.addEventListener('click', (event) => {
    // Zrzut ekranu w poradniku: kliknięcie pokazuje go w pełnym rozmiarze, drugie kliknięcie zamyka.
    const zoomed = event.target.closest('.ge-doc-zoom');
    if (zoomed) {
      zoomed.remove();
      return;
    }
    const shot = event.target.closest('.ge-doc-shot img');
    if (shot) {
      const view = document.createElement('div');
      view.className = 'ge-doc-zoom';
      view.innerHTML = `<img src="${geEsc(shot.getAttribute('src'))}" alt="${geEsc(shot.alt)}" />`;
      wrap.querySelector('.ge-docs').append(view);
      return;
    }
    if (event.target === wrap || event.target.closest('.ge-docs-close')) return close();
    const tabBtn = event.target.closest('[data-tab]');
    if (tabBtn && tabBtn.dataset.tab !== tab) {
      tab = tabBtn.dataset.tab;
      render();
      return;
    }
    const catBtn = event.target.closest('.ge-docs-nav [data-cat]');
    if (catBtn) main.querySelector(`[data-cat="${CSS.escape(catBtn.dataset.cat)}"]`)?.scrollIntoView({ block: 'start' });
  });
  wrap.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      const zoomed = wrap.querySelector('.ge-doc-zoom');
      if (zoomed) zoomed.remove();
      else close();
    }
  });
  search.addEventListener('input', render);
  ge.root.append(wrap);
  ge.modal = wrap;
  render();
  search.focus();
}
