// Animacje postaci w JSGame Engine — jak plugin Paper ZD do Unreal Engine.
//
// anim_source — Anim Source (AS_): wszystkie animacje jednej postaci,
//   bp.animSource = { sequences, notifies, nextId }. Sekwencja (Animation Sequence) to { id, name, dirs, frames, mirror,
//   notifies: [{ id, name, frame, sound }] }: frames — Flipbook (albo Sprite) na każdy kierunek (GE_ZD_DIRS),
//   mirror — pusty kierunek bierze Flipbook z lustrzanej strony, frame notify liczy się od 0. notifies — zarejestrowane nazwy.
// anim_bp — Animation Blueprint (ABP_): Event Graph ze zmiennymi (Event Blueprint Update Animation) i Anim Graph,
//   czyli maszyna stanów bp.anim = { source, entry, entryX, entryY, states, transitions, jumps, nextId }:
//   stan { id, name, x, y, seq, loop, rate, rateVar, dir, dirVar, enter, exit },
//   przejście { id, from, to, auto, conds: [{ var, op, value }] }, Jump Node { id, name, x, y, to }.
// Klasa aktora wskazuje Animation Blueprint w Ustawieniach klasy (defaults.animBp) i komponent, który go
// pokazuje (defaults.animComp). W grze działa to jako AnimInstance (game-runtime.js).

Object.assign(GE_KINDS, {
  anim_source: { label: 'Anim Source (Paper ZD)', icon: '🎬', prefix: 'AS_', color: '#c4582d' },
  anim_bp: { label: 'Animation Blueprint (Paper ZD)', icon: '🏃', prefix: 'ABP_', color: '#e0702a' }
});
Object.assign(GE_BP_DEFAULTS, { animBp: null, animComp: '' });
GE_CATS.push('Animacja');

// Kierunki sekwencji: [strzałka, nazwa]. Kąt kierunku i to kąt w stopniach (0 — prawo, 90 — dół), jak w grze.
const GE_ZD_DIRS = {
  1: [['●', 'Wszystkie kierunki']],
  2: [['→', 'Prawo'], ['←', 'Lewo']],
  4: [['→', 'Prawo'], ['↓', 'Dół'], ['←', 'Lewo'], ['↑', 'Góra']],
  8: [['→', 'Prawo'], ['↘', 'Prawo-dół'], ['↓', 'Dół'], ['↙', 'Lewo-dół'], ['←', 'Lewo'], ['↖', 'Lewo-góra'], ['↑', 'Góra'], ['↗', 'Prawo-góra']]
};
const GE_ZD_MIRROR = { 2: [1, 0], 4: [2, 1, 0, 3], 8: [4, 3, 2, 1, 0, 7, 6, 5] };
const geZdSlotAngle = (dirs, i) => (i * 360) / dirs;
const GE_ZD_OPS = [['==', '='], ['!=', '≠'], ['>', '>'], ['<', '<'], ['>=', '≥'], ['<=', '≤']];
const GE_ZD_DIR_MODES = [['velocity', 'Z prędkości właściciela'], ['var', 'Ze zmiennej (kąt w °)'], ['none', 'Stały (pierwszy kierunek)']];
const geZdUi = () => (ge.zd ??= { seq: {}, dir: {}, pv: {} });

// ---------- Dane: domyślne wartości, dane dla gry, kompilacja maszyny stanów ----------

const geZdMaxId = (list) => Math.max(0, ...list.map((x) => Number(String(x?.id ?? '').replace(/^\D+/, '')) || 0));
const geZdId = (owner, prefix) => prefix + owner.nextId++;

// Nowy zasób i wczytany projekt: brakujące pola, poprawne kierunki i odwołania (geAddBlueprint, geNormalizeProject).
function geZdAssetDefaults(bp) {
  if (bp.kind === 'anim_source') {
    const s = bp.animSource ?? {};
    const sequences = (Array.isArray(s.sequences) ? s.sequences : []).filter((q) => q && q.id).map((q) => {
      const dirs = [1, 2, 4, 8].includes(Number(q.dirs)) ? Number(q.dirs) : 1;
      return {
        id: q.id, name: String(q.name || 'Sekwencja'), dirs, mirror: q.mirror !== false,
        frames: Array.from({ length: dirs }, (_, i) => q.frames?.[i] || null),
        notifies: (Array.isArray(q.notifies) ? q.notifies : []).filter((n) => n && n.id)
          .map((n) => ({ id: n.id, name: String(n.name ?? ''), frame: Math.max(0, Math.trunc(Number(n.frame) || 0)), sound: n.sound || '' }))
      };
    });
    const notifies = [...new Set((Array.isArray(s.notifies) ? s.notifies : []).map((n) => String(n).trim()).filter(Boolean))];
    bp.animSource = { sequences, notifies, nextId: Math.max(Number(s.nextId) || 1, geZdMaxId([...sequences, ...sequences.flatMap((q) => q.notifies)]) + 1) };
  }
  if (bp.kind === 'anim_bp') {
    const a = bp.anim ?? {};
    const list = (x) => (Array.isArray(x) ? x.filter((item) => item && item.id) : []);
    const states = list(a.states).map((s) => ({
      id: s.id, name: String(s.name || 'Stan'), x: Number(s.x) || 0, y: Number(s.y) || 0, seq: s.seq || '', loop: s.loop !== false,
      rate: Number.isFinite(Number(s.rate)) ? Number(s.rate) : 1, rateVar: s.rateVar || '',
      dir: GE_ZD_DIR_MODES.some(([m]) => m === s.dir) ? s.dir : 'velocity', dirVar: s.dirVar || '', enter: String(s.enter ?? ''), exit: String(s.exit ?? '')
    }));
    const ids = new Set(states.map((s) => s.id));
    const transitions = list(a.transitions).filter((t) => ids.has(t.from) && ids.has(t.to) && t.from !== t.to).map((t) => ({
      id: t.id, from: t.from, to: t.to, auto: !!t.auto,
      conds: (Array.isArray(t.conds) ? t.conds : []).filter((c) => c && c.var).map((c) => ({ var: c.var, op: GE_ZD_OPS.some(([o]) => o === c.op) ? c.op : '==', value: c.value ?? 0 }))
    }));
    const jumps = list(a.jumps).map((j) => ({ id: j.id, name: String(j.name || 'Jump'), x: Number(j.x) || 0, y: Number(j.y) || 0, to: ids.has(j.to) ? j.to : '' }));
    bp.anim = {
      source: a.source || null, entry: ids.has(a.entry) ? a.entry : states[0]?.id ?? null,
      entryX: Number.isFinite(Number(a.entryX)) ? Number(a.entryX) : 32, entryY: Number.isFinite(Number(a.entryY)) ? Number(a.entryY) : 48,
      states, transitions, jumps, nextId: Math.max(Number(a.nextId) || 1, geZdMaxId([...states, ...transitions, ...jumps]) + 1)
    };
    bp.interfaces = Array.isArray(bp.interfaces) ? bp.interfaces : [];
    bp.funcs = Array.isArray(bp.funcs) ? bp.funcs : [];
  }
}

// Sekwencje wszystkich Anim Source dla gry: { "idSource:idSekwencji": { name, dirs, frames, mirror, notifies } }.
function geZdSequenceData(project) {
  const out = {};
  project.blueprints.filter((b) => geKind(b) === 'anim_source').forEach((src) => src.animSource.sequences.forEach((q) => {
    out[`${src.id}:${q.id}`] = {
      name: q.name, dirs: q.dirs, mirror: q.mirror,
      frames: q.frames.map((id) => (id && geSpriteData(project, id) ? id : null)),
      notifies: q.notifies.filter((n) => n.name || n.sound).map((n) => ({ name: n.name, frame: n.frame, sound: n.sound && geSoundExists(project, n.sound) ? n.sound : '' }))
    };
  }));
  return out;
}

// Sekwencja z klucza „idSource:idSekwencji” (węzeł Play Animation Override).
function geZdSeqByKey(project, key) {
  const [srcId, seqId] = String(key ?? '').split(':');
  const src = project && geAsset(project, srcId, 'anim_source');
  const seq = src?.animSource.sequences.find((q) => q.id === seqId);
  return seq ? { src, seq } : null;
}

// Maszyna stanów dla AnimInstance (static animGraph). Zmienne zamienia na ich nazwy w kodzie (names.vars).
function geZdCompileGraph(project, bp, names, { error, warn }) {
  const a = bp.anim;
  const src = geAsset(project, a.source, 'anim_source');
  const varCode = (id) => (id && bp.variables.some((v) => v.id === id) ? names.vars.get(bp.id + ':' + id) : null);
  if (!a.states.length) warn('Anim Graph jest pusty — dodaj stan (prawy przycisk na karcie Anim Graph).');
  else if (!src) error('Animation Blueprint nie ma Anim Source — wybierz go w Ustawieniach klasy (⚙).');
  const states = a.states.map((s) => {
    const seq = src?.animSource.sequences.find((q) => q.id === s.seq);
    if (src && !seq) warn(`Stan „${s.name}” nie ma sekwencji — wybierz ją w Szczegółach stanu.`);
    const rateVar = varCode(s.rateVar);
    if (s.rateVar && !rateVar) error(`Stan „${s.name}”: zmienna tempa została usunięta.`);
    const dirVar = s.dir === 'var' ? varCode(s.dirVar) : null;
    if (s.dir === 'var' && !dirVar) error(`Stan „${s.name}”: wybierz zmienną z kątem kierunku.`);
    return { id: s.id, name: s.name, seq: seq ? `${src.id}:${seq.id}` : null, loop: s.loop, rate: s.rate, rateVar, dir: s.dir, dirVar, enter: s.enter, exit: s.exit };
  });
  const stateName = (id) => a.states.find((s) => s.id === id)?.name ?? '?';
  const transitions = a.transitions.map((t) => {
    const label = `Przejście ${stateName(t.from)} → ${stateName(t.to)}`;
    if (!t.auto && !t.conds.length) warn(`${label} nie ma warunku ani „Automatycznie po końcu” — nigdy się nie wykona.`);
    const conds = t.conds.map((c) => {
      const v = varCode(c.var);
      if (!v) error(`${label}: warunek używa usuniętej zmiennej.`);
      return { v, op: c.op, value: typeof c.value === 'boolean' ? c.value : Number(c.value) || 0 };
    });
    return { id: t.id, from: t.from, to: t.to, auto: t.auto, conds };
  });
  const jumps = {};
  a.jumps.forEach((j) => {
    if (!j.to) warn(`Jump Node „${j.name}” nie wskazuje stanu — przeciągnij z jego brzegu strzałkę do stanu.`);
    else jumps[j.name] = j.to;
  });
  return { entry: a.entry ?? a.states[0]?.id ?? null, states, transitions, jumps };
}

// Animation Blueprint klasy: ona sama albo ten z Ustawień klasy aktora.
function geZdAbpOf(bp) {
  const project = geProj();
  if (!project || !bp) return null;
  if (geKind(bp) === 'anim_bp') return bp;
  if (geKind(bp) !== 'actor' || bp.id === 'level') return null;
  return geAsset(project, geResolveDefaults(project, bp).animBp, 'anim_bp');
}

// Nazwy notify, które zna ta klasa: z jej Anim Source i ze stanów (bez Animation Blueprintu — ze wszystkich Anim Source).
function geZdNotifyNames(bp) {
  const project = geProj();
  const abp = geZdAbpOf(bp);
  const sources = abp ? [geAsset(project, abp.anim.source, 'anim_source')].filter(Boolean) : project.blueprints.filter((b) => geKind(b) === 'anim_source');
  const names = sources.flatMap((s) => [...s.animSource.notifies, ...s.animSource.sequences.flatMap((q) => q.notifies.map((n) => n.name))]);
  (abp ? [abp] : []).forEach((b) => b.anim.states.forEach((s) => names.push(s.enter, s.exit)));
  return [...new Set(names.filter(Boolean))].sort((x, y) => x.localeCompare(y));
}

const geZdSeqLabel = (key) => {
  const hit = geZdSeqByKey(geProj(), key);
  return hit ? `${hit.src.name} › ${hit.seq.name}` : '(wybierz sekwencję)';
};
const geZdSeqChoices = (src = null) => (src ? [src] : geProj().blueprints.filter((b) => geKind(b) === 'anim_source'))
  .flatMap((s) => s.animSource.sequences.map((q) => [`${s.id}:${q.id}`, `${s.name} › ${q.name}`]));
const geZdWithCurrent = (list, v, label) => (v && !list.some(([x]) => x === v) ? [[v, `${v} ${label}`], ...list] : list);

// ---------- Węzły ----------

const GE_ZD_NODES = [
  { type: 'ev_anim_init', title: 'Event Blueprint Initialize Animation', pl: 'Gdy animacja startuje', cat: 'Zdarzenia', kind: 'event', method: 'animInit', animOnly: true,
    desc: 'Uruchamia się raz, w pierwszej klatce animacji aktora — np. żeby zapamiętać właściciela (Try Get Pawn Owner) w zmiennej.', outs: [geX('then')] },
  { type: 'ev_anim_update', title: 'Event Blueprint Update Animation', pl: 'Co klatkę animacji', cat: 'Zdarzenia', kind: 'event', method: 'animUpdate', params: 'deltaTimeX', animOnly: true,
    desc: 'Uruchamia się w każdej klatce, zaraz po ruchu aktora i przed wyborem stanu. Tu ustaw zmienne, od których zależą przejścia (np. Speed, IsFalling).',
    outs: [geX('then'), geP('delta', 'Delta Time X', 'float', 0, { expr: 'deltaTimeX' })] },
  { type: 'ev_anim_notify', title: (n) => `AnimNotify_${n.props?.notify || 'Notify'}`, pl: 'Gdy animacja dojdzie do notify', cat: 'Zdarzenia', kind: 'event', classOnly: true, noWidget: true, hidden: true,
    desc: 'Uruchamia się, gdy sekwencja dojdzie do klatki z tym notify (np. Krok — dźwięk kroku) albo gdy stan z tym notify zaczyna się lub kończy. Działa w Animation Blueprincie i w klasie aktora, który go używa.',
    props: [{ id: 'notify', name: 'Notify', kind: 'choice', placeholder: '— wybierz notify —', options: (n) => geZdWithCurrent(geZdNotifyNames(geCurBp()).map((x) => [x, x]), n.props?.notify, '(nieznany)') }],
    check: (n) => (n.props?.notify ? null : 'Wybierz notify w tym węźle.'),
    outs: [geX('then')],
    methods: (n) => [{ pin: 'then', name: 'onNotify_' + GE_RT.ident(n.props?.notify || 'Notify'), params: '' }] },
  { type: 'zd_owner', title: 'Try Get Pawn Owner', pl: 'Właściciel animacji (aktor)', cat: 'Animacja', kind: 'pure', animOnly: true,
    desc: 'Aktor, którego animuje ten Animation Blueprint. Z niego weź prędkość (Get Velocity) albo jego zmienne.',
    outs: [geP('out', 'Return Value', 'actor')], expr: () => 'this.tryGetPawnOwner()' },
  { type: 'zd_get_anim', title: 'Get Anim Instance', pl: 'Animation Blueprint aktora', cat: 'Animacja', kind: 'pure',
    desc: 'Animation Blueprint (Anim Instance) aktora — podłącz do węzłów Get / Set zmiennych Animation Blueprintu (pin Target).',
    ins: [geSelf()], outs: [geP('out', 'Return Value', 'actor')], expr: (c) => `${c.in('target')}.animInstance()` },
  { type: 'zd_jump', title: (n) => `Jump to Node (${n.props?.jump || '?'})`, pl: 'Skocz do stanu (Jump Node)', cat: 'Animacja', kind: 'exec', noWidget: true, classOnly: true, hidden: true,
    desc: 'Maszyna stanów od razu przechodzi do stanu, który wskazuje Jump Node o tej nazwie — z dowolnego stanu, bez rysowania przejść (np. Potknięcie, Taniec).',
    props: [{ id: 'jump', name: 'Jump Node', kind: 'choice', placeholder: '— wybierz Jump Node —', options: (n) => geZdWithCurrent(geZdJumpChoices(geCurBp()), n.props?.jump, '(brak w Anim Graph)') }],
    check: (n) => (n.props?.jump ? null : 'Wybierz Jump Node w tym węźle.'),
    ins: [geX(), geSelf()], outs: [geX('then')],
    stmt: (c) => `${c.in('target')}.jumpToAnimNode(${JSON.stringify(String(c.prop('jump') ?? ''))});` },
  { type: 'zd_override', title: (n) => `Play Animation Override (${geZdSeqLabel(n.props?.seq)})`, pl: 'Zagraj animację jednorazowo', cat: 'Animacja', kind: 'flow', noWidget: true, classOnly: true, hidden: true,
    desc: 'Jednorazowo gra sekwencję (np. machanie ręką) zamiast maszyny stanów. Po końcu animacja wraca do maszyny stanów, a wykonanie idzie pinem On Completed.',
    props: [{ id: 'seq', name: 'Sekwencja', kind: 'choice', placeholder: '— wybierz sekwencję —', options: () => geZdSeqChoices() }],
    check: (n, bp, project) => (geZdSeqByKey(project, n.props?.seq) ? null : 'Wybierz sekwencję w tym węźle (albo została usunięta z Anim Source).'),
    ins: [geX(), geSelf(), geP('rate', 'Play Rate', 'float', 1)], outs: [geX('then'), geX('done', 'On Completed')],
    gen: (c) => {
      const done = c.exec('done');
      const then = c.exec('then');
      const call = `${c.in('target')}.playAnimationOverride(${JSON.stringify(String(c.prop('seq') ?? ''))}, ${c.in('rate')}${done ? `, () => {\n${geIndent(done)}\n}` : ''});`;
      return then ? `${call}\n${then}` : call;
    } },
  { type: 'zd_stop_overrides', title: 'Stop All Animation Overrides', pl: 'Przerwij animacje jednorazowe', cat: 'Animacja', kind: 'exec', noWidget: true, classOnly: true,
    desc: 'Przerywa animację z Play Animation Override (bez On Completed) i od razu wraca do maszyny stanów.',
    ins: [geX(), geSelf()], outs: [geX('then')], stmt: (c) => `${c.in('target')}.stopAllAnimationOverrides();` },
  { type: 'zd_state_name', title: 'Get Current State Name', pl: 'Nazwa obecnego stanu animacji', cat: 'Animacja', kind: 'pure', noWidget: true, classOnly: true,
    desc: 'Nazwa stanu, w którym jest maszyna stanów (np. do Print String przy szukaniu błędów).',
    ins: [geSelf()], outs: [geP('out', 'Return Value', 'string')], expr: (c) => `${c.in('target')}.animStateName()` },
  { type: 'zd_set_abp', title: (n) => `Set Anim Blueprint (${geProj()?.blueprints.find((b) => b.id === n.props?.cls)?.name ?? '?'})`, pl: 'Zmień Animation Blueprint', cat: 'Animacja', kind: 'exec', actorOnly: true, hidden: true,
    desc: 'Aktor dostaje nowy Animation Blueprint — maszyna stanów zaczyna od wejścia (np. postać po przemianie).',
    props: [{ id: 'cls', name: 'Animation Blueprint', kind: 'choice', placeholder: '— wybierz —', options: () => geOfKind('anim_bp').map((b) => [b.id, b.name]) }],
    ins: [geX(), geSelf()], outs: [geX('then')], stmt: (c) => `${c.in('target')}.setAnimBlueprint(${c.cls('cls', 'anim_bp')});` }
];
GE_NODE_LIST.push(...GE_ZD_NODES);
GE_ZD_NODES.forEach((def) => {
  GE_NODES[def.type] = def;
});
['zd_jump', 'zd_override', 'zd_stop_overrides', 'zd_set_abp'].forEach((type) => GE_NO_CONSTRUCTION.add(type));
GE_NO_FUNCTION.add('zd_override');
// Anim Instance nie stoi na poziomie: nie dostaje BeginPlay, Tick ani klawiszy (zamiast nich Initialize / Update Animation).
['ev_begin', 'ev_tick', 'ev_key', 'ev_any_key', 'ev_input_action'].forEach((type) => {
  if (GE_NODES[type]) GE_NODES[type].noAnim = true;
});

const geZdJumpChoices = (bp) => {
  const abp = geZdAbpOf(bp);
  const all = abp ? [abp] : geOfKind('anim_bp');
  return [...new Set(all.flatMap((b) => b.anim.jumps.map((j) => j.name)))].map((name) => [name, name]);
};

// Gotowe węzły w menu prawego przycisku: notify, Jump Nodes, sekwencje i Animation Blueprinty.
// Bez nich zostaje ogólny węzeł z wyborem w węźle, żeby dało się go znaleźć.
function geZdMenuEntries(bp, noEvents) {
  const kind = geKind(bp);
  if (kind !== 'actor' && kind !== 'anim_bp') return [];
  const items = [];
  const add = (cat, label, ue, type, props) => {
    if ((geMode() === 'construction' && GE_NO_CONSTRUCTION.has(type)) || (geCurFn() && GE_NO_FUNCTION.has(type))) return;
    items.push({ cat, label, ue, node: { type, props, values: {} } });
  };
  const each =(list, fallback, fn) => (list.length ? list.forEach(fn) : fallback());
  if (!noEvents) {
    each(geZdNotifyNames(bp), () => add('Zdarzenia', 'AnimNotify', 'Gdy animacja dojdzie do notify (wybierz go w węźle)', 'ev_anim_notify', {}),
      (name) => add('Zdarzenia', `AnimNotify_${name}`, `Gdy animacja dojdzie do notify ${name}`, 'ev_anim_notify', { notify: name }));
  }
  each(geZdJumpChoices(bp), () => add('Animacja', 'Jump to Node', 'Skocz do stanu przez Jump Node (wybierz go w węźle)', 'zd_jump', {}),
    ([name]) => add('Animacja', `Jump to Node (${name})`, `Skocz do stanu przez Jump Node ${name}`, 'zd_jump', { jump: name }));
  const abp = geZdAbpOf(bp);
  const src = abp && geAsset(ge.project, abp.anim.source, 'anim_source');
  each(geZdSeqChoices(src), () => add('Animacja', 'Play Animation Override', 'Zagraj animację jednorazowo (wybierz sekwencję w węźle)', 'zd_override', {}),
    ([key, label]) => add('Animacja', `Play Animation Override (${label})`, `Zagraj jednorazowo ${label}`, 'zd_override', { seq: key }));
  if (kind === 'actor') geOfKind('anim_bp').forEach((b) => add('Animacja', `Set Anim Blueprint (${b.name})`, `Zmień Animation Blueprint na ${b.name}`, 'zd_set_abp', { cls: b.id }));
  return items;
}

// ---------- Przeglądarka zawartości: nowe zasoby, miniatury, odwołania ----------

Object.assign(GE_NEW_ASSET, {
  anim_source: {
    title: 'Nowy Anim Source', name: 'AS_NowaPostac',
    text: 'Anim Source zbiera wszystkie animacje jednej postaci: sekwencje (np. Idle, Run, Jump) z Flipbookami na każdy kierunek i notify. Podaj nazwę (zwyczajowo z przedrostkiem AS_).',
    done: 'Kliknij go dwukrotnie i dodaj sekwencje. Potem utwórz Animation Blueprint, który z nich korzysta.'
  },
  anim_bp: {
    title: 'Nowy Animation Blueprint', name: 'ABP_NowaPostac',
    text: 'Animation Blueprint sam wybiera animację postaci: maszyna stanów (Idle, Run, Jump…) z przejściami zależnymi od zmiennych, które ustawiasz w Event Graph. Podaj nazwę (zwyczajowo z przedrostkiem ABP_).',
    done: 'Wybierz w nim Anim Source (⚙ Ustawienia klasy), a w klasie aktora: Ustawienia klasy › Animacja › Animation Blueprint.'
  }
});

// Po utworzeniu: Animation Blueprint dostaje zdarzenia animacji i jedyny Anim Source z projektu.
function geZdCreated(bp) {
  if (geKind(bp) !== 'anim_bp') return;
  const g = geGraph(bp);
  g.add('ev_anim_init', 64, 64);
  g.add('ev_anim_update', 64, 224);
  const sources = geOfKind('anim_source');
  if (sources.length === 1) bp.anim.source = sources[0].id;
}

function geZdUses(b, id) {
  return (geKind(b) === 'anim_source' && b.animSource.sequences.some((q) => q.frames.includes(id) || q.notifies.some((n) => n.sound === id)))
    || (geKind(b) === 'anim_bp' && b.anim.source === id)
    || (geKind(b) === 'actor' && b.defaults?.animBp === id)
    || (b.graph ? geGraphs(b) : []).some((g) => g.nodes.some((n) => (n.type === 'zd_set_abp' && n.props?.cls === id) || (n.type === 'zd_override' && String(n.props?.seq ?? '').startsWith(id + ':'))));
}

// Usunięty zasób: sekwencje, Animation Blueprinty i klasy tracą do niego odwołanie.
function geZdForget(b, id) {
  b.animSource?.sequences.forEach((q) => {
    q.frames = q.frames.map((f) => (f === id ? null : f));
    q.notifies.forEach((n) => {
      if (n.sound === id) n.sound = '';
    });
  });
  if (b.anim?.source === id) b.anim.source = null;
  if (b.defaults?.animBp === id) b.defaults.animBp = null;
}

function geZdBadge(ctx, W, H, bg, fg, text, info) {
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.roundRect(W * 0.12, H * 0.12, W * 0.76, H * 0.76, 10);
  ctx.fill();
  ctx.fillStyle = fg;
  ctx.font = `800 ${Math.round(H * 0.24)}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, W / 2, H * 0.44);
  ctx.font = `600 ${Math.round(H * 0.13)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText(info, W / 2, H * 0.7, W * 0.7);
}

// Miniatura: Anim Source — pierwsza klatka pierwszej sekwencji, Animation Blueprint — plakietka z liczbą stanów.
function geZdDrawThumb(ctx, bp, W, H) {
  const kind = geKind(bp);
  if (kind === 'anim_source') {
    const q = bp.animSource.sequences.find((x) => x.frames.some(Boolean));
    const frame = q && geSpriteData(ge.project, q.frames.find(Boolean))?.frames[0];
    if (!geDrawFrame(ctx, frame, 8, 6, W - 16, H - 22)) geZdBadge(ctx, W, H, '#3d2216', '#ffb08a', 'AS', '');
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(W - 40, H - 18, 38, 16);
    ctx.fillStyle = '#ffb08a';
    ctx.font = '700 10px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`🎞 ${bp.animSource.sequences.length}`, W - 21, H - 10);
    return true;
  }
  if (kind === 'anim_bp') {
    geZdBadge(ctx, W, H, '#43240f', '#ffb36b', 'ABP', `${bp.anim.states.length} stanów`);
    return true;
  }
  return false;
}

// ---------- Edytor Anim Source ----------

GE_ASSET_TABS.push('anim_source');
GE_ASSET_VIEW_TITLE.anim_source = 'Sekwencje animacji (Animation Sequences)';
GE_DATA_PAGES.anim_source = geZdSourcePage;

const geZdCurSeq = (bp) => bp.animSource.sequences.find((q) => q.id === geZdUi().seq[bp.id]) ?? bp.animSource.sequences[0] ?? null;

// Flipbook kierunku (z odbiciem, gdy pusty) i jego klatki.
function geZdSlotFrame(q, slot) {
  let id = q.frames[slot];
  let flip = false;
  if (!id && q.mirror && GE_ZD_MIRROR[q.dirs]) {
    id = q.frames[GE_ZD_MIRROR[q.dirs][slot]];
    flip = !!id;
  }
  return { id: id || null, flip, data: id ? geSpriteData(ge.project, id) : null };
}

function geZdSourcePage(bp, view, details) {
  const src = bp.animSource;
  const ui = geZdUi();
  const q = geZdCurSeq(bp);
  ui.seq[bp.id] = q?.id ?? null;
  const rows = src.sequences.map((s) => `<div class="ge-row${s === q ? ' is-selected' : ''}" data-ge="zd-seq-pick" data-id="${s.id}" tabindex="0">
      <span class="ge-row-name">🎞 ${geEsc(s.name)}</span><span class="ge-row-type">${s.dirs} kier.${s.notifies.length ? ` · ◆${s.notifies.length}` : ''}</span></div>`).join('');
  view.innerHTML = `<div class="ge-zd-src">
    <aside class="ge-zd-seqlist">
      <div class="ge-mb-head"><span>Sekwencje</span><button type="button" class="ge-mb-add" data-ge="zd-seq-add" title="Dodaj sekwencję" aria-label="Dodaj sekwencję">＋</button></div>
      ${rows || '<p class="ge-empty">Brak sekwencji — kliknij ＋.</p>'}
    </aside>
    <section class="ge-zd-seqedit">${q ? geZdSeqEditorHtml(bp, q) : '<p class="ge-empty">Dodaj pierwszą sekwencję (＋), np. <i>Idle</i>, <i>Run</i> albo <i>Jump</i>.</p>'}</section>
  </div>`;
  const users = geOfKind('anim_bp').filter((b) => b.anim.source === bp.id);
  const names = src.notifies.map((name, i) => `<div class="ge-zd-nfname">${geText('zd-nfname', 'name', name, `data-i="${i}" aria-label="Nazwa notify"`)}<button type="button" class="ge-mini" data-ge="zd-nfname-del" data-i="${i}" aria-label="Usuń ${geEsc(name)}">Usuń</button></div>`).join('');
  details.innerHTML = `<p class="ge-det-note"><b>Anim Source</b> to wszystkie animacje jednej postaci. Każda <b>sekwencja</b> ma Flipbook na każdy kierunek — postać patrzy tam, dokąd idzie. Pusty kierunek z „Odbiciem” bierze lustrzaną stronę, więc wystarczy narysować prawą.</p>
    ${geCat('Notify (zarejestrowane nazwy)', `${names || '<p class="ge-hint">Brak — dodaj np. <i>Krok</i> albo <i>Klaśnięcie</i>.</p>'}<div class="ge-det-actions"><button type="button" data-ge="zd-nfname-add">＋ Dodaj notify</button></div>
      <p class="ge-hint">Notify to znacznik na klatce sekwencji. Gdy animacja do niego dojdzie, w Animation Blueprincie (i w klasie aktora) uruchamia się zdarzenie <i>AnimNotify_Nazwa</i>.</p>`)}
    ${geCat('Jak używać', `<ol class="ge-steps">
      <li>Dodaj sekwencje (＋) i wybierz liczbę kierunków.</li>
      <li>Do każdego kierunku przypisz Flipbook (Animację) — dla platformówki wystarczą 2 kierunki z odbiciem i sam „Prawo”.</li>
      <li>Utwórz <b>Animation Blueprint</b> z tym Anim Source i ułóż w nim maszynę stanów.</li></ol><div class="ge-det-actions"><button type="button" data-ge="zd-docs">📖 Poradnik: animacje postaci</button></div>`)}
    ${geCat('Używany przez', users.map(geUserRow).join('') || '<p class="ge-hint">Żaden Animation Blueprint go jeszcze nie używa.</p>')}`;
  geZdDrawCells(bp, q);
  geZdStartSourcePreview();
}

function geZdWheelSvg(q, slot) {
  const n = q.dirs;
  const c = 84;
  const R = 78;
  const r = 28;
  const at = (deg, rad) => [c + Math.cos((deg * Math.PI) / 180) * rad, c + Math.sin((deg * Math.PI) / 180) * rad].map((v) => v.toFixed(2)).join(' ');
  const wedges = GE_ZD_DIRS[n].map(([arrow, label], i) => {
    const mid = geZdSlotAngle(n, i);
    const half = 180 / n;
    const state = q.frames[i] ? 'has' : geZdSlotFrame(q, i).id ? 'mirror' : 'empty';
    const shape = n === 1
      ? `<circle cx="${c}" cy="${c}" r="${R}" />`
      : `<path d="M ${at(mid - half, R)} A ${R} ${R} 0 0 1 ${at(mid + half, R)} L ${at(mid + half, r)} A ${r} ${r} 0 0 0 ${at(mid - half, r)} Z" />`;
    const [tx, ty] = (n === 1 ? `${c} ${c - (R + r) / 2}` : at(mid, (R + r) / 2)).split(' ');
    return `<g class="ge-zd-wedge is-${state}${i === slot ? ' is-current' : ''}" data-ge="zd-dir" data-i="${i}" role="button" aria-label="${label}"><title>${label}${state === 'mirror' ? ' (odbicie)' : state === 'empty' ? ' (pusty)' : ''}</title>${shape}<text x="${tx}" y="${ty}">${state === 'mirror' ? '↔' : arrow}</text></g>`;
  }).join('');
  return `<svg class="ge-zd-wheel" viewBox="0 0 168 168" width="168" height="168" aria-label="Kierunki sekwencji — kliknij, żeby zobaczyć kierunek w podglądzie">${wedges}<circle class="ge-zd-hub" cx="${c}" cy="${c}" r="${r - 4}" /><text class="ge-zd-hub-text" x="${c}" y="${c}">${n}</text></svg>`;
}

function geZdSeqEditorHtml(bp, q) {
  const slot = Math.min(geZdUi().dir[bp.id] ?? 0, q.dirs - 1);
  const attrs = `data-id="${q.id}"`;
  const opts = [['', '— brak —'], ...geSpriteChoices()];
  const slots = GE_ZD_DIRS[q.dirs].map(([arrow, label], i) => {
    const mirrored = !q.frames[i] && geZdSlotFrame(q, i).flip;
    return `<div class="ge-zd-slot${i === slot ? ' is-current' : ''}">
      <button type="button" class="ge-zd-slot-dir" data-ge="zd-dir" data-i="${i}" title="Pokaż ten kierunek w podglądzie" aria-label="Podgląd: ${label}">${arrow}</button>
      <span class="ge-zd-slot-name">${label}</span>
      ${geSelect('zd-seq-frame', 'frame', q.frames[i] ?? '', opts, `${attrs} data-i="${i}" aria-label="Flipbook — ${label}"`)}
      ${mirrored ? '<span class="ge-zd-mirror" title="Pusty kierunek — w grze odbity lustrzanie z przeciwnej strony">↔ odbicie</span>' : ''}
    </div>`;
  }).join('');
  const { data } = geZdSlotFrame(q, slot);
  const cells = (data?.frames ?? []).map((f, i) => {
    const marks = q.notifies.filter((n) => n.frame === i).map((n) => `<span class="ge-zd-nf-mark" title="${geEsc(n.name || 'Dźwięk')}">◆ ${geEsc(n.name || '🔊')}</span>`).join('');
    return `<div class="ge-fb-frame ge-zd-cell" data-i="${i}"><canvas width="64" height="64"></canvas><span class="ge-fb-num">${i + 1}</span>${marks}
      <button type="button" class="ge-mini" data-ge="zd-nf-add" data-i="${i}" title="Dodaj notify na klatce ${i + 1}">＋ notify</button></div>`;
  }).join('');
  const sounds = [['', '— bez dźwięku —'], ...geOfKind('sound').map((s) => [s.id, `🔊 ${s.name}`]), ...GE_SOUNDS.map(([k, l]) => [k, `♪ ${l}`])];
  const nfs = q.notifies.slice().sort((x, y) => x.frame - y.frame).map((n) => {
    const a = `${attrs} data-nf="${n.id}"`;
    const nameOpts = geZdWithCurrent([['', '— bez nazwy (tylko dźwięk) —'], ...bp.animSource.notifies.map((x) => [x, x])], n.name, '');
    return `<div class="ge-zd-nf"><span class="ge-zd-nf-ic">◆</span>
      <label>Klatka ${geNum('zd-nf', 'frame', n.frame + 1, 'int', `${a} min="1" aria-label="Klatka notify"`)}</label>
      ${geSelect('zd-nf', 'name', n.name, nameOpts, `${a} aria-label="Nazwa notify"`)}
      ${geSelect('zd-nf', 'sound', n.sound, sounds, `${a} aria-label="Dźwięk notify"`)}
      <button type="button" class="ge-mini" data-ge="zd-nf-del" ${a} aria-label="Usuń notify">Usuń</button></div>`;
  }).join('');
  return `<div class="ge-zd-seqhead">
      <label class="ge-zd-field">Nazwa ${geText('zd-seq', 'name', q.name, attrs)}</label>
      <label class="ge-zd-field">Kierunki ${geSelect('zd-seq', 'dirs', q.dirs, [[1, '1 (bez kierunku)'], [2, '2 (prawo, lewo)'], [4, '4'], [8, '8']], `${attrs} data-type="int"`)}</label>
      <label class="ge-zd-field ge-zd-check">${geCheck('zd-seq', 'mirror', q.mirror, attrs)} Odbicie pustych kierunków</label>
      <span class="ge-fill"></span>
      <button type="button" class="ge-mini" data-ge="zd-seq-dup" ${attrs}>Duplikuj</button>
      <button type="button" class="ge-mini ge-danger" data-ge="zd-seq-del" ${attrs}>Usuń</button>
    </div>
    <div class="ge-zd-dirs">
      ${geZdWheelSvg(q, slot)}
      <div class="ge-zd-slots">${slots}</div>
      <div class="ge-zd-prev"><canvas class="ge-zd-preview" width="240" height="200" aria-label="Podgląd sekwencji"></canvas>
        <span class="ge-muted">${data ? `${data.frames.length} klatek · ${Number(data.fps) || 0} kl./s` : 'Brak Flipbooka'}</span></div>
    </div>
    <div class="ge-mb-head"><span>Klatki i notify — kierunek: ${GE_ZD_DIRS[q.dirs][slot][1]}</span></div>
    <div class="ge-fb-strip ge-zd-cells">${cells || '<p class="ge-empty">Ten kierunek nie ma Flipbooka — wybierz go wyżej.</p>'}</div>
    <div class="ge-zd-nfs">${nfs || `<p class="ge-hint">Brak notify. Kliknij „＋ notify” pod klatką — np. <i>Krok</i> na klatce, w której stopa dotyka ziemi.</p>`}</div>`;
}

// Miniatury klatek pod podglądem (odbite, gdy kierunek bierze lustrzaną stronę).
function geZdDrawCells(bp, q) {
  if (!q) return;
  const { data, flip } = geZdSlotFrame(q, Math.min(geZdUi().dir[bp.id] ?? 0, q.dirs - 1));
  ge.root.querySelectorAll('.ge-zd-cell').forEach((el) => {
    const canvas = el.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    geChecker(ctx, 0, 0, canvas.width, canvas.height, 6);
    ctx.save();
    if (flip) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    const frame = data?.frames[Number(el.dataset.i)];
    geDrawFrame(ctx, frame, 4, 4, canvas.width - 8, canvas.height - 8);
    ctx.restore();
    // Obrazek tekstury jeszcze się wczytuje — miniatury narysują się od nowa, gdy będzie gotowy.
    if (frame?.src) GE_RT.whenImageReady(frame.src, () => geKind(geCurBp()) === 'anim_source' && geZdDrawCells(geCurBp(), geZdCurSeq(geCurBp())));
  });
}

function geZdStartSourcePreview() {
  cancelAnimationFrame(ge.zdRaf);
  const start = performance.now();
  const step = (now) => {
    const canvas = ge.root.querySelector('.ge-zd-preview');
    const bp = geCurBp();
    if (!canvas || geKind(bp) !== 'anim_source') return;
    const q = geZdCurSeq(bp);
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);
    geChecker(ctx, 0, 0, W, H, 12);
    let i = -1;
    const { data, flip } = q ? geZdSlotFrame(q, Math.min(geZdUi().dir[bp.id] ?? 0, q.dirs - 1)) : {};
    if (data) {
      const len = data.frames.length;
      const fps = Math.max(0.5, Number(data.fps) || 1);
      const t = ((now - start) / 1000) % (data.loop ? Infinity : len / fps + 1);
      const n = Math.floor(t * fps);
      i = data.loop ? n % len : Math.min(n, len - 1);
      ctx.save();
      if (flip) {
        ctx.translate(W, 0);
        ctx.scale(-1, 1);
      }
      geDrawFrame(ctx, data.frames[i], 12, 12, W - 24, H - 24);
      ctx.restore();
    } else geNoImage(ctx, W, H, 'Brak Flipbooka w tym kierunku');
    ge.root.querySelectorAll('.ge-zd-cell').forEach((el) => el.classList.toggle('is-current', Number(el.dataset.i) === i));
    ge.zdRaf = requestAnimationFrame(step);
  };
  ge.zdRaf = requestAnimationFrame(step);
}

// Zmiana liczby kierunków: Flipbooki zostają przy tym samym kącie (np. prawo i lewo z 2 do 4 kierunków).
function geZdResizeDirs(q, dirs) {
  const old = q.frames;
  q.frames = Array.from({ length: dirs }, (_, j) => {
    if (q.dirs === 1) return j === 0 ? old[0] : null;
    if (dirs === 1) return old[0] ?? old.find(Boolean) ?? null;
    const i = old.findIndex((_, k) => Math.abs(geZdSlotAngle(q.dirs, k) - geZdSlotAngle(dirs, j)) < 0.01);
    return i >= 0 ? old[i] : null;
  });
  q.dirs = dirs;
}

// ---------- Edytor Animation Blueprintu: Anim Graph (maszyna stanów) ----------

function geZdGraphHtml(bp) {
  return `<div class="ge-zd" tabindex="0" aria-label="Anim Graph — maszyna stanów. Prawy przycisk dodaje stan, przeciągnięcie z brzegu stanu do innego stanu dodaje przejście.">
    <div class="ge-zd-world"><svg class="ge-zd-wires" width="1" height="1" aria-hidden="true"></svg><div class="ge-zd-nodes"></div></div>
    <div class="ge-crumbs"><b>${geEsc(bp.name)}</b> › AnimGraph › Maszyna stanów</div>
    <div class="ge-zd-tip">Prawy przycisk — nowy stan · przeciągnij z <b>brzegu</b> stanu — przejście</div>
    <aside class="ge-zd-pv${geZdPv(bp).open ? '' : ' is-closed'}" aria-label="Podgląd animacji"></aside>
    <div class="ge-watermark" aria-hidden="true">ANIMATION</div>
  </div>`;
}

function geZdBind(page) {
  const el = page.querySelector('.ge-zd');
  if (!el) return;
  el.addEventListener('pointerdown', geZdDown);
  el.addEventListener('pointermove', geZdMove);
  el.addEventListener('pointerup', geZdUp);
  el.addEventListener('pointercancel', geZdUp);
  el.addEventListener('wheel', geZdWheel, { passive: false });
  el.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  const pv = el.querySelector('.ge-zd-pv');
  pv.addEventListener('input', geZdPvInput);
  pv.addEventListener('change', geZdPvInput);
  pv.addEventListener('click', geZdPvClick);
  const firstOpen = !ge.graphViews[geGraphKey()];
  geZdRenderGraph();
  geZdStartPreview();
  if (firstOpen) requestAnimationFrame(() => geZdFit());
}

const geZdApplyView = () => {
  const el = ge.root.querySelector('.ge-zd');
  if (!el) return;
  const v = geGraphView();
  el.querySelector('.ge-zd-world').style.transform = `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`;
  const minor = GE_SNAP * v.zoom;
  const major = GE_SNAP * 8 * v.zoom;
  el.style.backgroundSize = `${major}px ${major}px, ${major}px ${major}px, ${minor}px ${minor}px, ${minor}px ${minor}px`;
  el.style.backgroundPosition = `${v.x}px ${v.y}px`;
};

function geZdRenderGraph() {
  const root = ge.root.querySelector('.ge-zd');
  const bp = geCurBp();
  if (!root || geKind(bp) !== 'anim_bp') return;
  const a = bp.anim;
  const sel = ge.bpPanel;
  const src = geAsset(ge.project, a.source, 'anim_source');
  const seqName = (id) => src?.animSource.sequences.find((q) => q.id === id)?.name;
  const isSel = (kind, id) => (sel?.kind === 'zd-' + kind && sel.id === id ? ' is-selected' : '');
  const node = (kind, id, x, y, cls, body) => `<div class="ge-zd-node ge-zd-${kind}${cls}" data-zd="${kind}" data-id="${id}" style="left:${x}px;top:${y}px"><div class="ge-zd-body">${body}</div></div>`;
  root.querySelector('.ge-zd-nodes').innerHTML = [
    node('entry', 'entry', a.entryX, a.entryY, isSel('entry', 'entry'), '▶ Entry'),
    ...a.jumps.map((j) => node('jump', j.id, j.x, j.y, isSel('jump', j.id), `<span class="ge-zd-jic">⤳</span><b>${geEsc(j.name)}</b>`)),
    ...a.states.map((s) => node('state', s.id, s.x, s.y, isSel('state', s.id) + (a.entry === s.id ? ' is-entry' : ''),
      `<b class="ge-zd-name">${geEsc(s.name)}</b><span class="ge-zd-sub">${seqName(s.seq) ? `🎞 ${geEsc(seqName(s.seq))}` : '<i>brak sekwencji</i>'}${s.loop ? '' : ' · 1×'}${s.dir === 'var' ? ' · ∠' : ''}</span>`))
  ].join('');
  geZdApplyView();
  geZdDrawWires();
  geZdRenderPvPanel(bp);
  ge.zdPvDirty = true;
}

function geZdBox(kind, id) {
  const el = ge.root.querySelector(`.ge-zd-nodes [data-zd="${kind}"][data-id="${id}"]`);
  if (!el) return null;
  const x = parseFloat(el.style.left) || 0;
  const y = parseFloat(el.style.top) || 0;
  return { x, y, w: el.offsetWidth, h: el.offsetHeight, cx: x + el.offsetWidth / 2, cy: y + el.offsetHeight / 2 };
}

// Punkt na brzegu prostokąta w stronę punktu (tx, ty).
function geZdEdge(b, tx, ty) {
  const dx = tx - b.cx;
  const dy = ty - b.cy;
  if (!dx && !dy) return { x: b.cx, y: b.cy };
  const s = Math.min(b.w / 2 / (Math.abs(dx) || 1e-9), b.h / 2 / (Math.abs(dy) || 1e-9));
  return { x: b.cx + dx * s, y: b.cy + dy * s };
}

// Strzałka między prostokątami, przesunięta w bok (przejścia A → B i B → A nie nakładają się).
function geZdArrow(A, B, side = 0) {
  const len = Math.hypot(B.cx - A.cx, B.cy - A.cy) || 1;
  const nx = (-(B.cy - A.cy) / len) * side;
  const ny = ((B.cx - A.cx) / len) * side;
  const p = geZdEdge({ ...A, cx: A.cx + nx, cy: A.cy + ny }, B.cx + nx, B.cy + ny);
  const q = geZdEdge({ ...B, cx: B.cx + nx, cy: B.cy + ny }, A.cx + nx, A.cy + ny);
  return { x1: p.x, y1: p.y, x2: q.x, y2: q.y, deg: (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI };
}

const geZdHead = (w) => `<path class="ge-zd-head" d="M0 0 L-12 -6 L-12 6 Z" transform="translate(${w.x2.toFixed(1)} ${w.y2.toFixed(1)}) rotate(${w.deg.toFixed(1)})" />`;
const geZdLine = (w) => `M ${w.x1.toFixed(1)} ${w.y1.toFixed(1)} L ${w.x2.toFixed(1)} ${w.y2.toFixed(1)}`;

function geZdDrawWires() {
  const svg = ge.root.querySelector('.ge-zd-wires');
  const bp = geCurBp();
  if (!svg || geKind(bp) !== 'anim_bp') return;
  const a = bp.anim;
  const sel = ge.bpPanel;
  const parts = [];
  const entry = geZdBox('entry', 'entry');
  const first = a.entry && geZdBox('state', a.entry);
  if (entry && first) {
    const w = geZdArrow(entry, first);
    parts.push(`<g class="ge-zd-link is-entry"><path d="${geZdLine(w)}" />${geZdHead(w)}</g>`);
  }
  a.jumps.forEach((j) => {
    const A = geZdBox('jump', j.id);
    const B = j.to && geZdBox('state', j.to);
    if (!A || !B) return;
    const w = geZdArrow(A, B);
    parts.push(`<g class="ge-zd-link is-jump"><path d="${geZdLine(w)}" />${geZdHead(w)}</g>`);
  });
  a.transitions.forEach((t) => {
    const A = geZdBox('state', t.from);
    const B = geZdBox('state', t.to);
    if (!A || !B) return;
    const w = geZdArrow(A, B, 7);
    const mx = (w.x1 + w.x2) / 2;
    const my = (w.y1 + w.y2) / 2;
    const cls = `${sel?.kind === 'zd-trans' && sel.id === t.id ? ' is-selected' : ''}${!t.auto && !t.conds.length ? ' is-dead' : ''}`;
    parts.push(`<g class="ge-zd-tr${cls}" data-tr="${t.id}"><path class="ge-zd-tr-hit" d="${geZdLine(w)}" /><path class="ge-zd-tr-line" d="${geZdLine(w)}" />${geZdHead(w)}
      <g class="ge-zd-tr-ic" transform="translate(${mx.toFixed(1)} ${my.toFixed(1)})"><circle r="9" /><text>${t.auto ? '⏱' : t.conds.length ? '⇄' : '!'}</text></g></g>`);
  });
  const temp = ge.zdTemp;
  const from = temp && geZdBox(temp.kind, temp.id);
  if (from) {
    const p = geZdEdge(from, temp.x, temp.y);
    parts.push(`<path class="ge-zd-temp" d="M ${p.x} ${p.y} L ${temp.x} ${temp.y}" />`);
  }
  svg.innerHTML = parts.join('');
}

const geZdPoint = (event) => {
  const r = ge.root.querySelector('.ge-zd').getBoundingClientRect();
  const v = geGraphView();
  return { x: (event.clientX - r.left - v.x) / v.zoom, y: (event.clientY - r.top - v.y) / v.zoom };
};

function geZdSelect(kind, id) {
  ge.bpPanel = kind ? { kind: 'zd-' + kind, id } : null;
  geZdRenderGraph();
  geRenderBpDetails();
}

function geZdDown(event) {
  const root = event.currentTarget;
  if (event.target.closest('input, select, textarea, button, .ge-zd-pv')) return;
  geCloseMenu();
  root.focus({ preventScroll: true });
  const bp = geCurBp();
  const v = geGraphView();
  const nodeEl = event.target.closest('.ge-zd-node');
  const trEl = event.target.closest('[data-tr]');
  root.setPointerCapture(event.pointerId);
  ge.zdDrag = null;
  if (event.button === 0 && trEl) {
    geZdSelect('trans', trEl.dataset.tr);
    return;
  }
  if (event.button === 0 && nodeEl) {
    const kind = nodeEl.dataset.zd;
    const id = nodeEl.dataset.id;
    geZdSelect(kind, id);
    const o = kind === 'entry' ? { x: bp.anim.entryX, y: bp.anim.entryY } : (kind === 'jump' ? bp.anim.jumps : bp.anim.states).find((x) => x.id === id);
    ge.zdDrag = event.target.closest('.ge-zd-body') && !event.altKey
      ? { mode: 'move', kind, id, cx: event.clientX, cy: event.clientY, ox: o.x, oy: o.y, moved: false }
      : { mode: 'link', kind, id };
    return;
  }
  if (event.button === 0 && ge.bpPanel) geZdSelect(null);
  ge.zdDrag = { mode: 'pan', cx: event.clientX, cy: event.clientY, vx: v.x, vy: v.y, moved: false, button: event.button };
}

function geZdMove(event) {
  const d = ge.zdDrag;
  if (!d) return;
  const bp = geCurBp();
  const v = geGraphView();
  const dx = event.clientX - d.cx;
  const dy = event.clientY - d.cy;
  if (d.mode === 'pan') {
    if (Math.abs(dx) + Math.abs(dy) > 3) d.moved = true;
    v.x = d.vx + dx;
    v.y = d.vy + dy;
    geZdApplyView();
  } else if (d.mode === 'move') {
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 3) return;
      d.moved = true;
      geSnapshot();
    }
    const x = geSnap(d.ox + dx / v.zoom, 8);
    const y = geSnap(d.oy + dy / v.zoom, 8);
    if (d.kind === 'entry') Object.assign(bp.anim, { entryX: x, entryY: y });
    else Object.assign((d.kind === 'jump' ? bp.anim.jumps : bp.anim.states).find((s) => s.id === d.id), { x, y });
    const el = ge.root.querySelector(`.ge-zd-nodes [data-zd="${d.kind}"][data-id="${d.id}"]`);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    geZdDrawWires();
  } else if (d.mode === 'link') {
    ge.zdTemp = { kind: d.kind, id: d.id, ...geZdPoint(event) };
    geZdDrawWires();
  }
}

function geZdUp(event) {
  const d = ge.zdDrag;
  ge.zdDrag = null;
  const root = ge.root.querySelector('.ge-zd');
  if (root?.hasPointerCapture?.(event.pointerId)) root.releasePointerCapture(event.pointerId);
  if (!d) return;
  const hit = document.elementFromPoint(event.clientX, event.clientY);
  if (d.mode === 'move' && d.moved) geScheduleSave();
  if (d.mode === 'link') {
    ge.zdTemp = null;
    const target = hit?.closest('.ge-zd-state');
    if (target && !(d.kind === 'state' && target.dataset.id === d.id)) geZdConnect(d.kind, d.id, target.dataset.id);
    else if (!target && d.kind !== 'entry' && hit?.closest('.ge-zd') && !hit.closest('.ge-zd-pv')) {
      // Strzałka puszczona w pustym miejscu: nowy stan od razu połączony (jak w Unreal Engine).
      const p = geZdPoint(event);
      const s = geZdAddState(p, null, false);
      geZdConnect(d.kind, d.id, s);
    } else geZdDrawWires();
  }
  if (d.mode === 'pan' && d.button === 2 && !d.moved) geZdContextMenu(event, hit);
}

function geZdWheel(event) {
  if (event.target.closest('.ge-zd-pv')) return;
  event.preventDefault();
  const v = geGraphView();
  const r = event.currentTarget.getBoundingClientRect();
  const sx = event.clientX - r.left;
  const sy = event.clientY - r.top;
  const wx = (sx - v.x) / v.zoom;
  const wy = (sy - v.y) / v.zoom;
  v.zoom = Math.min(1.5, Math.max(0.3, v.zoom * Math.pow(1.0015, -event.deltaY)));
  v.x = sx - wx * v.zoom;
  v.y = sy - wy * v.zoom;
  geZdApplyView();
}

function geZdContextMenu(event, hit) {
  const bp = geCurBp();
  const a = bp.anim;
  const at = { x: event.clientX, y: event.clientY };
  const p = geZdPoint(event);
  const trEl = hit?.closest('[data-tr]');
  const nodeEl = hit?.closest('.ge-zd-node');
  if (trEl) {
    geZdSelect('trans', trEl.dataset.tr);
    geMenu(at, [{ label: 'Usuń przejście', key: 'Delete', action: () => geZdDeleteSel() }]);
    return;
  }
  if (nodeEl && nodeEl.dataset.zd !== 'entry') {
    const { zd: kind, id } = nodeEl.dataset;
    geZdSelect(kind, id);
    geMenu(at, [
      ...(kind === 'state' ? [
        { label: '▶ Ustaw jako wejście (Entry)', disabled: a.entry === id, action: () => geChange(() => { a.entry = id; }, { bp: bp.id, only: ['graph', 'details', 'code'] }) },
        { label: 'Duplikuj', key: 'Ctrl+D', action: () => geZdDuplicate() }
      ] : []),
      { label: 'Usuń', key: 'Delete', action: () => geZdDeleteSel() }
    ]);
    return;
  }
  const src = geAsset(ge.project, a.source, 'anim_source');
  geMenu(at, [
    { heading: 'Anim Graph' },
    { label: '＋ Dodaj stan', action: () => geZdAddState(p) },
    { label: '⤳ Dodaj Jump Node', action: () => geZdAddJump(p) },
    ...(src?.animSource.sequences.length ? ['-', { heading: `Stan z sekwencji (${src.name})` },
      ...src.animSource.sequences.map((q) => ({ label: `🎞 ${q.name}`, action: () => geZdAddState(p, q) }))] : [])
  ]);
}

// Nowy stan w punkcie p (z sekwencją q). select: false — bez zaznaczania (np. gdy zaraz powstanie przejście). Zwraca id.
function geZdAddState(p, q = null, select = true) {
  const bp = geCurBp();
  const a = bp.anim;
  const id = geZdId(a, 's');
  geChange(() => {
    a.states.push({
      id, name: geUniqueName(q?.name ?? 'NowyStan', a.states.map((s) => s.name)), x: geSnap(p.x - 70, 8), y: geSnap(p.y - 24, 8),
      seq: q?.id ?? '', loop: true, rate: 1, rateVar: '', dir: 'velocity', dirVar: '', enter: '', exit: ''
    });
    if (!a.entry) a.entry = id;
    if (select) ge.bpPanel = { kind: 'zd-state', id };
  }, { bp: bp.id, only: ['graph', 'details', 'code'] });
  return id;
}

function geZdAddJump(p) {
  const bp = geCurBp();
  const a = bp.anim;
  const id = geZdId(a, 'j');
  geChange(() => {
    a.jumps.push({ id, name: geUniqueName('Potkniecie', a.jumps.map((j) => j.name)), x: geSnap(p.x - 50, 8), y: geSnap(p.y - 16, 8), to: '' });
    ge.bpPanel = { kind: 'zd-jump', id };
  }, { bp: bp.id, only: ['graph', 'details', 'code'] });
}

// Strzałka z węzła kind/id do stanu: z Entry — stan wejścia, z Jump Node — jego cel, ze stanu — nowe przejście.
function geZdConnect(kind, id, to) {
  const bp = geCurBp();
  const a = bp.anim;
  const existing = kind === 'state' && a.transitions.find((t) => t.from === id && t.to === to);
  if (existing) {
    geZdSelect('trans', existing.id);
    return;
  }
  geChange(() => {
    if (kind === 'entry') a.entry = to;
    else if (kind === 'jump') a.jumps.find((j) => j.id === id).to = to;
    else {
      const t = { id: geZdId(a, 't'), from: id, to, auto: false, conds: [] };
      a.transitions.push(t);
      ge.bpPanel = { kind: 'zd-trans', id: t.id };
    }
  }, { bp: bp.id, only: ['graph', 'details', 'code'] });
}

function geZdDuplicate() {
  const bp = geCurBp();
  const a = bp.anim;
  const s = ge.bpPanel?.kind === 'zd-state' && a.states.find((x) => x.id === ge.bpPanel.id);
  if (!s) return;
  const id = geZdId(a, 's');
  geChange(() => {
    a.states.push({ ...s, id, name: geUniqueName(s.name, a.states.map((x) => x.name)), x: s.x + 32, y: s.y + 32 });
    ge.bpPanel = { kind: 'zd-state', id };
  }, { bp: bp.id, only: ['graph', 'details', 'code'] });
}

function geZdDeleteSel() {
  const bp = geCurBp();
  const a = bp.anim;
  const sel = ge.bpPanel;
  if (!sel?.kind?.startsWith('zd-') || sel.kind === 'zd-entry') return;
  geChange(() => {
    if (sel.kind === 'zd-state') {
      a.states = a.states.filter((s) => s.id !== sel.id);
      a.transitions = a.transitions.filter((t) => t.from !== sel.id && t.to !== sel.id);
      a.jumps.forEach((j) => {
        if (j.to === sel.id) j.to = '';
      });
      if (a.entry === sel.id) a.entry = a.states[0]?.id ?? null;
    }
    if (sel.kind === 'zd-trans') a.transitions = a.transitions.filter((t) => t.id !== sel.id);
    if (sel.kind === 'zd-jump') a.jumps = a.jumps.filter((j) => j.id !== sel.id);
    ge.bpPanel = null;
  }, { bp: bp.id, only: ['graph', 'details', 'code'] });
}

function geZdHandleKey(event, del, mod, k) {
  if (event.target.closest?.('input, select, textarea')) return;
  if (del) {
    event.preventDefault();
    geZdDeleteSel();
  } else if (mod && k === 'd') {
    event.preventDefault();
    geZdDuplicate();
  } else if (event.key === 'Home') geZdFit();
}

// Widok obejmujący cały graf (klawisz Home).
function geZdFit() {
  const el = ge.root.querySelector('.ge-zd');
  const boxes = [...ge.root.querySelectorAll('.ge-zd-nodes .ge-zd-node')].map((n) => geZdBox(n.dataset.zd, n.dataset.id));
  if (!el || !boxes.length) return;
  const l = Math.min(...boxes.map((b) => b.x)) - 40;
  const t = Math.min(...boxes.map((b) => b.y)) - 60;
  const r = Math.max(...boxes.map((b) => b.x + b.w)) + 40;
  const b = Math.max(...boxes.map((x) => x.y + x.h)) + 40;
  const v = geGraphView();
  // Rozwinięty podgląd zasłania prawą stronę grafu (w wąskim panelu lepiej większy graf pod podglądem).
  const pv = el.clientWidth > 760 && el.querySelector('.ge-zd-pv:not(.is-closed)');
  const width = Math.max(200, el.clientWidth - (pv ? pv.offsetWidth + 16 : 0));
  v.zoom = Math.min(1.2, Math.max(0.3, Math.min(width / (r - l), el.clientHeight / (b - t))));
  v.x = -l * v.zoom;
  v.y = -t * v.zoom;
  geZdApplyView();
}

// ---------- Szczegóły: stan, przejście, Jump Node i ustawienia Animation Blueprintu ----------

const geZdVars = (bp, types) => bp.variables.filter((v) => types.includes(v.type)).map((v) => [v.id, v.name]);
const geZdNfList = (bp) => `<datalist id="ge-zd-nf-list">${geZdNotifyNames(bp).map((n) => `<option value="${geEsc(n)}"></option>`).join('')}</datalist>`;

function geZdDetailsHtml(bp, panel) {
  const a = bp.anim;
  const name = (id) => a.states.find((s) => s.id === id)?.name ?? '?';
  const del = (label) => `<div class="ge-det-actions"><button type="button" class="ge-danger" data-ge="zd-del">${label}</button></div>`;
  if (panel.kind === 'zd-entry') {
    return `<p class="ge-det-note"><b>Entry</b> — od tego miejsca startuje maszyna stanów. Strzałka wskazuje pierwszy stan (zwykle <i>Idle</i>). Przeciągnij z brzegu Entry do innego stanu, żeby go zmienić.</p>`;
  }
  if (panel.kind === 'zd-jump') {
    const j = a.jumps.find((x) => x.id === panel.id);
    if (!j) return null;
    const attrs = `data-id="${j.id}"`;
    return `<div class="ge-det-top"><span class="ge-det-ic">⤳</span>${geText('zd-jump', 'name', j.name, `${attrs} class="ge-det-name" aria-label="Nazwa Jump Node"`)}</div>
      <div class="ge-det-class"><span>Jump Node — nazwany punkt wejścia</span></div>
      ${geCat('Jump Node', geRow('Stan docelowy', geSelect('zd-jump', 'to', j.to, [['', '— wybierz stan —'], ...a.states.map((s) => [s.id, s.name])], attrs), 'Albo przeciągnij strzałkę z brzegu Jump Node do stanu.')
        + `<p class="ge-hint">W Blueprincie (tu albo w klasie aktora) węzeł <b>Jump to Node (${geEsc(j.name)})</b> od razu przełącza maszynę stanów na ten stan — z dowolnego miejsca, bez rysowania przejść. Dobre na <i>Potknięcie</i> albo <i>Taniec zwycięstwa</i>.</p>`)}
      ${del('Usuń Jump Node')}`;
  }
  if (panel.kind === 'zd-trans') {
    const t = a.transitions.find((x) => x.id === panel.id);
    if (!t) return null;
    const attrs = `data-id="${t.id}"`;
    const vars = geZdVars(bp, ['bool', 'int', 'float']);
    const conds = t.conds.map((c, i) => {
      const v = bp.variables.find((x) => x.id === c.var);
      const ca = `${attrs} data-i="${i}"`;
      const ops = v?.type === 'bool' ? GE_ZD_OPS.slice(0, 2) : GE_ZD_OPS;
      const value = v?.type === 'bool'
        ? geSelect('zd-cond', 'value', String(c.value === true), [['true', 'prawda'], ['false', 'fałsz']], `${ca} aria-label="Wartość"`)
        : geNum('zd-cond', 'value', c.value, v?.type === 'int' ? 'int' : 'float', `${ca} aria-label="Wartość"`);
      return `<div class="ge-zd-cond">${geSelect('zd-cond', 'var', c.var, geZdWithCurrent(vars, c.var, '(usunięta)'), `${ca} aria-label="Zmienna"`)}
        ${geSelect('zd-cond', 'op', c.op, ops, `${ca} aria-label="Porównanie"`)}${value}
        <button type="button" class="ge-mini" data-ge="zd-cond-del" ${ca} aria-label="Usuń warunek">×</button></div>`;
    }).join('');
    const siblings = a.transitions.filter((x) => x.from === t.from);
    const index = siblings.indexOf(t);
    return `<div class="ge-det-top"><span class="ge-det-ic">⇄</span><b class="ge-zd-trname">${geEsc(name(t.from))} → ${geEsc(name(t.to))}</b></div>
      <div class="ge-det-class"><span>Przejście (Transition Rule)</span></div>
      ${geCat('Reguła przejścia', geRow('Automatycznie po końcu', geCheck('zd-trans', 'auto', t.auto, attrs), 'Przejście czeka, aż sekwencja stanu dojdzie do ostatniej klatki (np. Lądowanie → Idle). Stan powinien mieć wyłączone Zapętlenie.')
        + `<div class="ge-zd-conds">${conds || '<p class="ge-hint">Brak warunków.</p>'}</div>
        <div class="ge-det-actions"><button type="button" data-ge="zd-cond-add" ${attrs}${vars.length ? '' : ' disabled'}>＋ Dodaj warunek</button></div>
        <p class="ge-hint">${vars.length ? 'Wszystkie warunki muszą być spełnione naraz. Zmienne ustawiasz w Event Graph (Event Blueprint Update Animation).' : 'Najpierw dodaj zmienną (Mój Blueprint › Zmienne), np. <i>Speed</i> (Float) albo <i>IsFalling</i> (Boolean).'}</p>`)}
      ${geCat('Kolejność sprawdzania', `<p class="ge-hint">Przejścia z „${geEsc(name(t.from))}” są sprawdzane po kolei — wygrywa pierwsze spełnione. To jest ${index + 1}. z ${siblings.length}.</p>
        <div class="ge-det-actions"><button type="button" data-ge="zd-trans-move" data-v="-1" ${attrs}${index ? '' : ' disabled'}>▲ Wcześniej</button><button type="button" data-ge="zd-trans-move" data-v="1" ${attrs}${index < siblings.length - 1 ? '' : ' disabled'}>▼ Później</button></div>`)}
      ${del('Usuń przejście')}`;
  }
  if (panel.kind === 'zd-state') {
    const s = a.states.find((x) => x.id === panel.id);
    if (!s) return null;
    const attrs = `data-id="${s.id}"`;
    const src = geAsset(ge.project, a.source, 'anim_source');
    const seqs = src ? src.animSource.sequences.map((q) => [q.id, `🎞 ${q.name}${q.dirs > 1 ? ` (${q.dirs} kier.)` : ''}`]) : [];
    const nums = geZdVars(bp, ['float', 'int']);
    const out = a.transitions.filter((t) => t.from === s.id).map((t) => `<button type="button" class="ge-row" data-ge="zd-pick" data-v="trans" data-id="${t.id}">
        <span class="ge-row-name">⇄ ${geEsc(name(t.to))}</span><span class="ge-row-type">${t.auto ? 'po końcu' : `${t.conds.length} war.`}</span></button>`).join('');
    return `<div class="ge-det-top"><span class="ge-det-ic">🏃</span>${geText('zd-state', 'name', s.name, `${attrs} class="ge-det-name" aria-label="Nazwa stanu"`)}</div>
      <div class="ge-det-class"><span>Stan maszyny stanów${a.entry === s.id ? ' · <b>wejście (Entry)</b>' : ''}</span></div>
      ${geCat('Play Sequence', (src ? geRow('Sekwencja', geSelect('zd-state', 'seq', s.seq, [['', '— wybierz —'], ...geZdWithCurrent(seqs, s.seq, '(usunięta)')], attrs), `Sekwencja z ${src.name}.`)
          : `<p class="ge-hint">Najpierw wybierz Anim Source w Ustawieniach klasy (⚙ na pasku).</p>`)
        + geRow('Zapętlona', geCheck('zd-state', 'loop', s.loop, attrs), 'Bez zapętlenia sekwencja staje na ostatniej klatce — wtedy działa przejście „Automatycznie po końcu”.')
        + geRow('Play Rate', geNum('zd-state', 'rate', s.rate, 'float', `${attrs} step="0.1"`), '1 — normalnie, 2 — dwa razy szybciej, 0.5 — wolniej.')
        + geRow('× zmienna', geSelect('zd-state', 'rateVar', s.rateVar, [['', '— nie —'], ...nums], attrs), 'Play Rate mnożony przez zmienną. Np. Speed i Play Rate 0.005: im szybciej biegnie postać, tym szybciej przebiera nogami — bez „ślizgania się”.'))}
      ${geCat('Kierunek (Directional Angle)', geRow('Źródło kąta', geSelect('zd-state', 'dir', s.dir, GE_ZD_DIR_MODES, attrs), 'Który Flipbook sekwencji pokazać. Z prędkości — postać patrzy tam, dokąd idzie (2 kierunki: lewo / prawo).')
        + (s.dir === 'var' ? geRow('Zmienna kąta', geSelect('zd-state', 'dirVar', s.dirVar, [['', '— wybierz —'], ...nums], attrs), 'Kąt w stopniach: 0 — prawo, 90 — dół, 180 — lewo, 270 — góra.') : ''))}
      ${geCat('Notify stanu', geRow('Przy wejściu', geText('zd-state', 'enter', s.enter, `${attrs} list="ge-zd-nf-list" placeholder="(brak)"`), 'Nazwa notify — zdarzenie AnimNotify_Nazwa, gdy maszyna wchodzi do tego stanu.')
        + geRow('Przy wyjściu', geText('zd-state', 'exit', s.exit, `${attrs} list="ge-zd-nf-list" placeholder="(brak)"`), 'Nazwa notify — zdarzenie AnimNotify_Nazwa, gdy maszyna wychodzi z tego stanu.') + geZdNfList(bp))}
      ${geCat('Przejścia z tego stanu', out || '<p class="ge-hint">Brak. Przeciągnij z brzegu stanu do innego stanu.</p>')}
      <div class="ge-det-actions">${a.entry === s.id ? '' : '<button type="button" data-ge="zd-entry">▶ Ustaw jako wejście</button>'}<button type="button" class="ge-danger" data-ge="zd-del">Usuń stan</button></div>`;
  }
  return null;
}

// Ustawienia klasy Animation Blueprintu (nic nie zaznaczono albo „⚙ Ustawienia klasy”).
function geZdAbpDefaultsHtml(bp) {
  const a = bp.anim;
  const src = geAsset(ge.project, a.source, 'anim_source');
  const users = geOfKind('actor').filter((b) => b.defaults?.animBp === bp.id);
  return `<p class="ge-det-note"><b>Animation Blueprint</b> sam wybiera animację postaci. W <b>Event Graph</b> ustaw zmienne (np. <i>Speed</i>, <i>IsFalling</i>) w zdarzeniu <i>Event Blueprint Update Animation</i>, a w <b>Anim Graph</b> ułóż stany i przejścia zależne od tych zmiennych.</p>
    ${geCat('Animation Source', geRow('Anim Source', geSelect('zd-abp', 'source', a.source ?? '', [['', '— wybierz —'], ...geOfKind('anim_source').map((b) => [b.id, b.name])]), 'Zestaw sekwencji postaci, z których korzystają stany.')
      + `<div class="ge-det-actions">${src ? `<button type="button" data-ge="open-bp" data-id="${src.id}">✎ Otwórz ${geEsc(src.name)}</button>` : ''}<button type="button" data-ge="zd-new-source">＋ Nowy Anim Source</button></div>`)}
    ${geCat('Szybki start', `<p class="ge-hint">Platformówka: zmienne <i>Speed</i> i <i>IsFalling</i>, ich ustawianie w Event Graph oraz stany Idle, Run i Jump z przejściami. Sekwencje dobiorą się po nazwach (Idle / Run / Jump).</p>
      <div class="ge-det-actions"><button type="button" data-ge="zd-gen-loco">🏃 Szablon: platformówka</button><button type="button" data-ge="zd-gen-states"${src?.animSource.sequences.length ? '' : ' disabled'}>Stany z sekwencji</button><button type="button" data-ge="zd-docs">📖 Poradnik</button></div>`)}
    ${geCat('Używany przez', users.map(geUserRow).join('') || '<p class="ge-hint">Żadna klasa go jeszcze nie używa. W klasie aktora: Ustawienia klasy › Animacja (Paper ZD) › Animation Blueprint.</p>')}
    ${geCat('Węzły', `<p class="ge-hint"><b>Try Get Pawn Owner</b> — aktor, którego animujesz. <b>Jump to Node</b> — skok do stanu przez Jump Node. <b>Play Animation Override</b> — jednorazowa animacja (np. machanie ręką). <b>AnimNotify_…</b> — zdarzenie z notify sekwencji.</p>`)}`;
}

// Kategoria „Animacja (Paper ZD)” w Ustawieniach klasy aktora.
function geZdActorCat(bp) {
  const d = bp.defaults;
  const abp = geAsset(ge.project, d.animBp, 'anim_bp');
  const comps = geChainEntries(ge.project, bp, 'components').filter((e) => geCompKind(e.item) === 'shape').map((e) => [e.item.name, `${GE_COMP_TYPES[e.item.type].icon} ${e.item.name}`]);
  return geCat('Animacja (Paper ZD)', geRow('Animation Blueprint', geSelect('defaults', 'animBp', d.animBp ?? '', [['', '— brak —'], ...geOfKind('anim_bp').map((b) => [b.id, b.name])]), 'Animation Blueprint sam przełącza animacje tego aktora (Idle, Run, Jump…).')
    + geRow('Komponent renderu', geSelect('defaults', 'animComp', d.animComp ?? '', [['', 'Automatycznie (pierwszy Sprite)'], ...geZdWithCurrent(comps, d.animComp, '(brak)')]), 'Komponent, który pokazuje animację. Automatycznie — pierwszy komponent Sprite / Animacja, a bez niego wygląd aktora.')
    + `<div class="ge-det-actions">${abp ? `<button type="button" data-ge="open-bp" data-id="${abp.id}">✎ Otwórz ${geEsc(abp.name)}</button>` : '<button type="button" data-ge="zd-new-abp">＋ Nowy Animation Blueprint</button>'}</div>`);
}

// ---------- Kreatory ----------

const geZdFindSeq = (src, re) => src?.animSource.sequences.find((q) => re.test(q.name)) ?? null;

// Stany Idle, Run, Jump z przejściami oraz zmienne Speed i IsFalling ustawiane w Event Graph.
function geZdPlatformerTemplate(bp) {
  const a = bp.anim;
  const src = geAsset(ge.project, a.source, 'anim_source');
  geChange(() => {
    const g = geGraph(bp);
    const varId = (name, type, value) => bp.variables.find((v) => v.name === name)?.id ?? g.variable(name, type, value);
    const speed = varId('Speed', 'float', 0);
    const falling = varId('IsFalling', 'bool', false);
    const update = bp.graph.nodes.find((n) => n.type === 'ev_anim_update')?.id ?? g.add('ev_anim_update', 64, 224);
    const ev = bp.graph.nodes.find((n) => n.id === update);
    const x = ev.x;
    const y = ev.y;
    // Event Blueprint Update Animation → Set Speed (długość prędkości właściciela) → Set IsFalling (nie stoi na ziemi).
    const setSpeed = g.add('var_set', x + 560, y, { var: speed });
    const setFalling = g.add('var_set', x + 860, y, { var: falling });
    const owner = g.add('zd_owner', x + 16, y + 150);
    const vel = g.add('get_velocity', x + 208, y + 110);
    const len = g.add('vec_len', x + 400, y + 110);
    const ground = g.add('on_ground', x + 400, y + 200);
    const not = g.add('not', x + 680, y + 200);
    if (!bp.graph.links.some((l) => l.from[0] === update && l.from[1] === 'then')) g.link(update, 'then', setSpeed);
    g.link(setSpeed, 'then', setFalling);
    g.link(owner, 'out', vel, 'target');
    g.link(vel, 'out', len, 'a');
    g.link(len, 'out', setSpeed, 'value');
    g.link(owner, 'out', ground, 'target');
    g.link(ground, 'out', not, 'a');
    g.link(not, 'out', setFalling, 'value');
    const state = (name, re, x0, y0, loop = true) => {
      const id = geZdId(a, 's');
      a.states.push({ id, name: geUniqueName(name, a.states.map((s) => s.name)), x: x0, y: y0, seq: geZdFindSeq(src, re)?.id ?? '', loop, rate: 1, rateVar: '', dir: 'velocity', dirVar: '', enter: '', exit: '' });
      return id;
    };
    const ox = Math.max(0, ...a.states.map((s) => s.x + 220));
    const idle = state('Idle', /idle|stoi|stan|spocz/i, ox + 200, 64);
    const run = state('Run', /run|walk|bieg|idzie|chod|ruch/i, ox + 520, 64);
    const jump = state('Jump', /jump|fall|skok|spad|lot/i, ox + 360, 256);
    const tr = (from, to, conds) => a.transitions.push({ id: geZdId(a, 't'), from, to, auto: false, conds });
    tr(idle, run, [{ var: speed, op: '>', value: 10 }]);
    tr(run, idle, [{ var: speed, op: '<=', value: 10 }]);
    tr(idle, jump, [{ var: falling, op: '==', value: true }]);
    tr(run, jump, [{ var: falling, op: '==', value: true }]);
    tr(jump, idle, [{ var: falling, op: '==', value: false }]);
    a.entry = idle;
    ge.bpPanel = null;
  }, { bp: bp.id, only: ['graph', 'details', 'code', 'mybp'] });
  geLog(`${bp.name}: dodano stany Idle, Run i Jump, zmienne Speed i IsFalling oraz ich ustawianie w Event Graph.${src ? '' : ' Wybierz jeszcze Anim Source i sekwencje stanów.'}`);
}

// Stan dla każdej sekwencji Anim Source, której jeszcze żaden stan nie gra (w siatce, bez przejść).
function geZdStatesFromSource(bp) {
  const a = bp.anim;
  const src = geAsset(ge.project, a.source, 'anim_source');
  const fresh = src ? src.animSource.sequences.filter((q) => !a.states.some((s) => s.seq === q.id)) : [];
  if (!fresh.length) {
    geLog('Każda sekwencja ma już swój stan.');
    return;
  }
  geChange(() => {
    fresh.forEach((q, i) => {
      const id = geZdId(a, 's');
      a.states.push({ id, name: geUniqueName(q.name, a.states.map((s) => s.name)), x: 200 + (i % 4) * 230, y: 300 + Math.floor(i / 4) * 120, seq: q.id, loop: true, rate: 1, rateVar: '', dir: 'velocity', dirVar: '', enter: '', exit: '' });
      if (!a.entry) a.entry = id;
    });
  }, { bp: bp.id, only: ['graph', 'details', 'code'] });
}

async function geZdNewAsset(kind, name) {
  const info = GE_NEW_ASSET[kind];
  const answer = await geDialog({ title: info.title, text: info.text, input: geUniqueName(name, ge.project.blueprints.map((b) => b.name)), buttons: [{ label: 'Utwórz', value: true, primary: true }, { label: 'Anuluj', value: null }] });
  return answer?.trim() ? geUniqueName(answer.trim(), ge.project.blueprints.map((b) => b.name)) : null;
}

// ---------- Kliknięcia i zmiany pól ----------

function geZdClick(action, id, bp, btn) {
  const i = Number(btn.dataset.i);
  const src = bp?.animSource;
  const a = bp?.anim;
  const onlySrc = { only: ['details'] };
  const onlyAbp = { bp: bp?.id, only: ['graph', 'details', 'code'] };
  const seq = (sid) => src?.sequences.find((q) => q.id === sid);
  switch (action) {
    case 'zd-seq-add': {
      const taken = src.sequences.map((q) => q.name);
      const name = ['Idle', 'Run', 'Jump', 'Fall', 'Wave'].find((n) => !taken.includes(n)) ?? geUniqueName('Sekwencja', taken);
      const q = { id: geZdId(src, 'q'), name, dirs: 1, frames: [null], mirror: true, notifies: [] };
      geChange(() => src.sequences.push(q), onlySrc);
      geZdUi().seq[bp.id] = q.id;
      geRenderAssetPage();
      break;
    }
    case 'zd-seq-pick':
      geZdUi().seq[bp.id] = id;
      geRenderAssetPage();
      break;
    case 'zd-seq-dup': {
      const q = seq(id);
      if (!q) break;
      const copy = { ...JSON.parse(JSON.stringify(q)), id: geZdId(src, 'q'), name: geUniqueName(q.name, src.sequences.map((x) => x.name)) };
      copy.notifies.forEach((n) => { n.id = geZdId(src, 'n'); });
      geChange(() => src.sequences.splice(src.sequences.indexOf(q) + 1, 0, copy), onlySrc);
      geZdUi().seq[bp.id] = copy.id;
      geRenderAssetPage();
      break;
    }
    case 'zd-seq-del':
      geChange(() => { src.sequences = src.sequences.filter((q) => q.id !== id); }, onlySrc);
      ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      break;
    case 'zd-dir':
      geZdUi().dir[bp.id] = i;
      geRenderAssetPage();
      break;
    case 'zd-nf-add': {
      const q = geZdCurSeq(bp);
      if (!q) break;
      geDialog({
        title: `Notify na klatce ${i + 1}`,
        text: 'Nazwa notify — w Animation Blueprincie (i w klasie aktora) uruchomi zdarzenie <i>AnimNotify_Nazwa</i>, gdy animacja dojdzie do tej klatki. Dźwięk wybierzesz potem na liście notify.',
        input: src.notifies[0] ?? 'Krok',
        select: src.notifies.length ? { label: 'Albo wybierz zarejestrowaną nazwę', value: '', options: [['', '— nazwa z pola wyżej —'], ...src.notifies.map((n) => [n, n])] } : null,
        buttons: [{ label: 'Dodaj', value: true, primary: true }, { label: 'Anuluj', value: null }]
      }).then((answer) => {
        const name = String((typeof answer === 'object' ? answer?.select || answer?.text : answer) ?? '').trim();
        if (!name) return;
        geChange(() => {
          q.notifies.push({ id: geZdId(src, 'n'), name, frame: i, sound: '' });
          if (!src.notifies.includes(name)) src.notifies.push(name);
        }, onlySrc);
      });
      break;
    }
    case 'zd-nf-del': {
      const q = seq(id);
      if (q) geChange(() => { q.notifies = q.notifies.filter((n) => n.id !== btn.dataset.nf); }, onlySrc);
      break;
    }
    case 'zd-nfname-add':
      geDialog({ title: 'Nowy notify', text: 'Nazwa notify, np. <i>Krok</i>, <i>Klaśnięcie</i> albo <i>Plusk</i>.', input: geUniqueName('Krok', src.notifies), buttons: [{ label: 'Dodaj', value: true, primary: true }, { label: 'Anuluj', value: null }] }).then((name) => {
        const n = String(name ?? '').trim();
        if (n && !src.notifies.includes(n)) geChange(() => src.notifies.push(n), onlySrc);
      });
      break;
    case 'zd-nfname-del':
      geChange(() => src.notifies.splice(i, 1), onlySrc);
      break;
    case 'zd-pick':
      geZdSelect(btn.dataset.v, id);
      break;
    case 'zd-del':
      geZdDeleteSel();
      break;
    case 'zd-entry':
      geChange(() => { a.entry = ge.bpPanel?.id ?? a.entry; }, onlyAbp);
      break;
    case 'zd-cond-add': {
      const t = a.transitions.find((x) => x.id === id);
      const v = bp.variables.find((x) => ['bool', 'int', 'float'].includes(x.type));
      if (t && v) geChange(() => t.conds.push({ var: v.id, op: v.type === 'bool' ? '==' : '>', value: v.type === 'bool' ? true : 0 }), onlyAbp);
      break;
    }
    case 'zd-cond-del': {
      const t = a.transitions.find((x) => x.id === id);
      if (t) geChange(() => t.conds.splice(i, 1), onlyAbp);
      break;
    }
    case 'zd-trans-move': {
      const t = a.transitions.find((x) => x.id === id);
      const siblings = a.transitions.filter((x) => x.from === t?.from);
      const other = siblings[siblings.indexOf(t) + Number(btn.dataset.v)];
      if (!t || !other) break;
      geChange(() => {
        const p = a.transitions.indexOf(t);
        const q = a.transitions.indexOf(other);
        [a.transitions[p], a.transitions[q]] = [other, t];
      }, onlyAbp);
      break;
    }
    case 'zd-docs':
      geShowDocs('zd');
      break;
    case 'zd-gen-loco':
      geZdPlatformerTemplate(bp);
      break;
    case 'zd-gen-states':
      geZdStatesFromSource(bp);
      break;
    case 'zd-new-source':
      geZdNewAsset('anim_source', `AS_${bp.name.replace(/^ABP_/, '')}`).then((name) => {
        if (!name) return;
        geChange(() => {
          const s = geAddBlueprint(ge.project, name, {}, 'anim_source');
          s.folder = bp.folder ?? null;
          bp.anim.source = s.id;
        }, { bp: bp.id, only: ['details', 'graph', 'code'] });
        geLog(`Utworzono ${name}. Otwórz go i dodaj sekwencje.`);
      });
      break;
    case 'zd-new-abp':
      geZdNewAsset('anim_bp', `ABP_${bp.name.replace(/^BP_/, '')}`).then((name) => {
        if (!name) return;
        geChange(() => {
          const abp = geAddBlueprint(ge.project, name, {}, 'anim_bp');
          abp.folder = bp.folder ?? null;
          geZdCreated(abp);
          ge.dirty.add(abp.id);
          bp.defaults.animBp = abp.id;
        }, { only: ['details', 'preview'] });
        geLog(`Utworzono ${name} i przypisano go do ${bp.name}. Kliknij „✎ Otwórz”, żeby ułożyć stany.`);
      });
      break;
    default:
      return false;
  }
  return true;
}

function geZdChange(scope, key, value, el, bp) {
  const id = el.dataset.id;
  const onlyAbp = { bp: bp.id, only: ['graph', 'details', 'code'] };
  const onlySrc = { only: ['details'] };
  switch (scope) {
    case 'zd-abp':
      geChange(() => { bp.anim.source = value || null; }, onlyAbp);
      return true;
    case 'zd-state': {
      const s = bp.anim.states.find((x) => x.id === id);
      if (s) geChange(() => {
        if (key === 'name') s.name = String(value).trim() ? geUniqueName(String(value).trim(), bp.anim.states.filter((x) => x !== s).map((x) => x.name)) : s.name;
        else if (key === 'rate') s.rate = Number(value) || 0;
        else if (key === 'enter' || key === 'exit') s[key] = String(value).trim();
        else s[key] = value;
      }, onlyAbp);
      return true;
    }
    case 'zd-trans': {
      const t = bp.anim.transitions.find((x) => x.id === id);
      if (t) geChange(() => { t.auto = !!value; }, onlyAbp);
      return true;
    }
    case 'zd-cond': {
      const c = bp.anim.transitions.find((x) => x.id === id)?.conds[Number(el.dataset.i)];
      if (!c) return true;
      geChange(() => {
        if (key === 'var') {
          c.var = value;
          const bool = bp.variables.find((v) => v.id === value)?.type === 'bool';
          c.value = bool ? true : 0;
          if (bool && !['==', '!='].includes(c.op)) c.op = '==';
        } else if (key === 'op') c.op = value;
        else c.value = bp.variables.find((v) => v.id === c.var)?.type === 'bool' ? value === 'true' || value === true : Number(value) || 0;
      }, onlyAbp);
      return true;
    }
    case 'zd-jump': {
      const j = bp.anim.jumps.find((x) => x.id === id);
      if (!j) return true;
      const old = j.name;
      geChange(() => {
        if (key === 'to') j.to = value;
        else if (String(value).trim()) j.name = geUniqueName(String(value).trim(), bp.anim.jumps.filter((x) => x !== j).map((x) => x.name));
        // Węzły Jump to Node wskazują Jump Node nazwą — zmiana nazwy idzie za nim.
        if (key === 'name' && j.name !== old) geZdRenameRefs('zd_jump', 'jump', old, j.name);
      }, onlyAbp);
      return true;
    }
    case 'zd-seq': {
      const q = bp.animSource.sequences.find((x) => x.id === id);
      if (!q) return true;
      geChange(() => {
        if (key === 'name') q.name = String(value).trim() ? geUniqueName(String(value).trim(), bp.animSource.sequences.filter((x) => x !== q).map((x) => x.name)) : q.name;
        else if (key === 'dirs') geZdResizeDirs(q, [1, 2, 4, 8].includes(Number(value)) ? Number(value) : 1);
        else q.mirror = !!value;
      }, onlySrc);
      if (key === 'name') ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      return true;
    }
    case 'zd-seq-frame': {
      const q = bp.animSource.sequences.find((x) => x.id === id);
      if (q) geChange(() => { q.frames[Number(el.dataset.i)] = value || null; }, onlySrc);
      return true;
    }
    case 'zd-nf': {
      const n = bp.animSource.sequences.find((x) => x.id === id)?.notifies.find((x) => x.id === el.dataset.nf);
      if (n) geChange(() => {
        if (key === 'frame') n.frame = Math.max(0, Math.trunc(Number(value) || 1) - 1);
        else n[key] = String(value ?? '');
      }, onlySrc);
      return true;
    }
    case 'zd-nfname': {
      const i = Number(el.dataset.i);
      const old = bp.animSource.notifies[i];
      const name = String(value).trim();
      if (!name || name === old || bp.animSource.notifies.includes(name)) {
        geRenderAssetPage();
        return true;
      }
      // Nowa nazwa notify trafia też do sekwencji, stanów i zdarzeń AnimNotify w Blueprintach.
      geChange(() => {
        bp.animSource.notifies[i] = name;
        bp.animSource.sequences.forEach((q) => q.notifies.forEach((n) => {
          if (n.name === old) n.name = name;
        }));
        geOfKind('anim_bp').filter((b) => b.anim.source === bp.id).forEach((b) => b.anim.states.forEach((s) => {
          if (s.enter === old) s.enter = name;
          if (s.exit === old) s.exit = name;
        }));
        geZdRenameRefs('ev_anim_notify', 'notify', old, name);
      }, onlySrc);
      return true;
    }
    default:
      return false;
  }
}

// Zmiana nazwy Jump Node albo notify we wszystkich węzłach, które wskazują je nazwą.
function geZdRenameRefs(type, prop, from, to) {
  geAllBlueprints(ge.project).forEach((b) => geGraphs(b).forEach((g) => (g?.nodes ?? []).forEach((n) => {
    if (n.type !== type || n.props?.[prop] !== from) return;
    n.props[prop] = to;
    ge.dirty.add(b.id);
  })));
}

// ---------- Podgląd w Anim Graph: maszyna stanów działa, a zmienne ustawia się ręcznie ----------

const geZdPv = (bp) => (geZdUi().pv[bp.id] ??= { open: true, vars: {}, vx: 0, vy: 0 });
const geZdPvValue = (bp, v) => {
  const pv = geZdPv(bp);
  return v.id in pv.vars ? pv.vars[v.id] : v.value;
};

function geZdRenderPvPanel(bp) {
  const el = ge.root.querySelector('.ge-zd-pv');
  if (!el) return;
  const pv = geZdPv(bp);
  const vars = bp.variables.filter((v) => ['bool', 'int', 'float'].includes(v.type));
  const row = (v) => {
    const value = geZdPvValue(bp, v);
    const input = v.type === 'bool'
      ? `<input type="checkbox" data-zdpv="${v.id}" ${value ? 'checked' : ''} />`
      : `<input type="range" min="-600" max="600" step="${v.type === 'int' ? 1 : 0.5}" value="${Number(value) || 0}" data-zdpv="${v.id}" /><input type="number" step="any" value="${Number(value) || 0}" data-zdpv="${v.id}" />`;
    return `<label class="ge-zd-pv-row"><span title="${geEsc(v.name)}">${geEsc(v.name)}</span>${input}</label>`;
  };
  const jumps = bp.anim.jumps.filter((j) => j.to).map((j) => `<button type="button" class="ge-mini" data-zdpv-jump="${geEsc(j.name)}">⤳ ${geEsc(j.name)}</button>`).join('');
  el.innerHTML = `<div class="ge-zd-pv-head"><b>Podgląd</b><span class="ge-zd-pv-state"></span><span class="ge-fill"></span>
      <button type="button" class="ge-mini" data-zdpv-act="reset" title="Od nowa — od stanu wejścia">⟲</button>
      <button type="button" class="ge-mini" data-zdpv-act="toggle" title="${pv.open ? 'Zwiń' : 'Rozwiń'}" aria-label="Zwiń lub rozwiń podgląd">${pv.open ? '▾' : '▸'}</button></div>
    <div class="ge-zd-pv-body">
      <canvas width="176" height="112" aria-label="Animacja w podglądzie"></canvas>
      <div class="ge-zd-pv-sec">Zmienne (w grze ustawia je Event Graph)</div>
      ${vars.map(row).join('') || '<p class="ge-hint">Brak zmiennych — dodaj je w Mój Blueprint.</p>'}
      <div class="ge-zd-pv-sec">Prędkość właściciela (kierunek)</div>
      <label class="ge-zd-pv-row"><span>X</span><input type="range" min="-400" max="400" step="10" value="${pv.vx}" data-zdpv="@vx" /><input type="number" value="${pv.vx}" data-zdpv="@vx" /></label>
      <label class="ge-zd-pv-row"><span>Y</span><input type="range" min="-400" max="400" step="10" value="${pv.vy}" data-zdpv="@vy" /><input type="number" value="${pv.vy}" data-zdpv="@vy" /></label>
      ${jumps ? `<div class="ge-zd-pv-sec">Jump Nodes</div><div class="ge-zd-pv-jumps">${jumps}</div>` : ''}
      <div class="ge-zd-pv-log" aria-live="polite"></div>
    </div>`;
  el.classList.toggle('is-closed', !pv.open);
}

function geZdPvInput(event) {
  const key = event.target.dataset.zdpv;
  const bp = geCurBp();
  if (!key || geKind(bp) !== 'anim_bp') return;
  const pv = geZdPv(bp);
  const value = event.target.type === 'checkbox' ? event.target.checked : Number(event.target.value) || 0;
  if (key === '@vx') pv.vx = value;
  else if (key === '@vy') pv.vy = value;
  else pv.vars[key] = value;
  // Suwak i pole liczby tej samej zmiennej pokazują to samo.
  event.currentTarget.querySelectorAll(`[data-zdpv="${key}"]`).forEach((other) => {
    if (other !== event.target && other.type !== 'checkbox') other.value = value;
  });
  const sim = ge.zdSim;
  if (sim && key[0] !== '@' && sim.codes.has(key)) sim.inst.vars[sim.codes.get(key)] = value;
}

function geZdPvClick(event) {
  const bp = geCurBp();
  const jump = event.target.closest('[data-zdpv-jump]');
  if (jump) {
    ge.zdSim?.inst.jumpTo(jump.dataset.zdpvJump);
    return;
  }
  const act = event.target.closest('[data-zdpv-act]')?.dataset.zdpvAct;
  if (act === 'reset') ge.zdPvDirty = true;
  if (act === 'toggle') {
    const pv = geZdPv(bp);
    pv.open = !pv.open;
    geZdRenderPvPanel(bp);
  }
}

// Anim Instance w edytorze: ta sama klasa co w grze, ale bez Event Graph — gra „na niby” z podanymi zmiennymi.
function geZdBuildSim(bp) {
  const names = geNames(ge.project);
  const sprites = new Map();
  const log = [];
  const game = {
    time: 0, uidCounter: 0,
    project: { animSequences: geZdSequenceData(ge.project) },
    spriteData: (id) => {
      if (!id) return null;
      if (!sprites.has(id)) sprites.set(id, geSpriteData(ge.project, id));
      return sprites.get(id);
    },
    animSprite(id, loop) {
      const base = this.spriteData(id);
      return base && { ...base, loop };
    },
    call: (actor, method) => {
      if (actor === inst && method.startsWith('onNotify_')) log.unshift({ text: '◆ ' + method.slice(9), at: game.time });
    },
    runTimers() {},
    playSound(name) { log.unshift({ text: '🔊 ' + (geAsset(ge.project, name, 'sound')?.name ?? GE_SOUNDS.find(([k]) => k === name)?.[1] ?? name), at: game.time }); },
    reportError() {}
  };
  const owner = { name: 'Podgląd', vx: 0, vy: 0, dead: false, components: [], animComp: '', shape: 'none', w: 64, h: 64, lookPart() { return this; } };
  const Cls = class extends GE_RT.AnimInstance {};
  Cls.animGraph = geZdCompileGraph(ge.project, bp, names, { error() {}, warn() {} });
  const inst = new Cls(game, { id: 'preview', name: 'Podgląd', owner, vars: {} });
  const codes = new Map();
  bp.variables.forEach((v) => {
    const code = names.vars.get(bp.id + ':' + v.id);
    codes.set(v.id, code);
    inst.vars[code] = geZdPvValue(bp, v);
  });
  return { inst, game, owner, codes, log };
}

function geZdStartPreview() {
  cancelAnimationFrame(ge.zdRaf);
  ge.zdPvDirty = true;
  let last = performance.now();
  let shown = '';
  const step = (now) => {
    const root = ge.root.querySelector('.ge-zd');
    const bp = geCurBp();
    if (!root || geKind(bp) !== 'anim_bp') {
      ge.zdSim = null;
      return;
    }
    if (ge.zdPvDirty) {
      // Graf narysował się od nowa — podświetlenie aktywnego stanu też.
      ge.zdPvDirty = false;
      shown = '';
      try {
        ge.zdSim = geZdBuildSim(bp);
      } catch {
        ge.zdSim = null;
      }
    }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const sim = ge.zdSim;
    const pv = geZdPv(bp);
    if (sim) {
      sim.owner.vx = pv.vx;
      sim.owner.vy = pv.vy;
      sim.game.time += dt;
      sim.inst.tickAnim(dt);
    }
    const inst = sim?.inst;
    const fire = inst?.lastTransition && sim.game.time - inst.lastTransition.at < 0.4 ? inst.lastTransition.id : null;
    const key = `${inst?.state?.id}|${fire}`;
    if (key !== shown) {
      shown = key;
      root.querySelectorAll('.ge-zd-state').forEach((el) => el.classList.toggle('is-active', el.dataset.id === inst?.state?.id));
      root.querySelectorAll('[data-tr]').forEach((el) => el.classList.toggle('is-firing', el.dataset.tr === fire));
      const label = root.querySelector('.ge-zd-pv-state');
      if (label) label.textContent = inst?.state ? `● ${inst.state.name}${inst.override ? ' (override)' : ''}` : '';
    }
    const canvas = root.querySelector('.ge-zd-pv canvas');
    if (canvas && pv.open) geZdDrawSim(canvas, sim);
    const logEl = root.querySelector('.ge-zd-pv-log');
    if (logEl && sim) {
      sim.log.length = Math.min(sim.log.length, 4);
      const text = sim.log.filter((l) => sim.game.time - l.at < 2).map((l) => l.text).join('  ');
      if (logEl.textContent !== text) logEl.textContent = text;
    }
    ge.zdRaf = requestAnimationFrame(step);
  };
  ge.zdRaf = requestAnimationFrame(step);
}

function geZdDrawSim(canvas, sim) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  geChecker(ctx, 0, 0, W, H, 10);
  const o = sim?.owner;
  const sd = o?.spriteData;
  const len = sd?.frames.length ?? 0;
  if (!len) {
    geNoImage(ctx, W, H, sim?.inst.state ? 'Stan bez sekwencji' : 'Dodaj stan');
    return;
  }
  const n = Math.floor((o.animTime || 0) * (Number(sd.fps) || 0));
  const f = sd.frames[len > 1 && sd.fps > 0 ? (sd.loop ? n % len : Math.min(n, len - 1)) : 0];
  const s = Math.min((W - 16) / (f.w || 1), (H - 16) / (f.h || 1));
  ctx.save();
  ctx.imageSmoothingEnabled = s < 1;
  GE_RT.drawShape(ctx, { shape: 'sprite', spriteData: sd, animTime: o.animTime, flipX: o.flipX, x: W / 2, y: H / 2, w: f.w * s, h: f.h * s });
  ctx.restore();
}
