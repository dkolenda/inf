// Zasoby danych w Przeglądarce zawartości JSGame Engine:
// struct — Struktura, czyli własny typ zmiennej z polami (bp.struct: { fields: [{ id, name, type, value }] }),
// enum — Enumeracja (UEnum), czyli lista nazwanych wartości do wyboru (bp.enum: { entries: [{ id, name, desc }] }),
// database — Baza danych klucz → wartość (bp.db: { valueType, entries: [{ id, key, value }] }),
// tsclass — Klasa TypeScript (bp.ts: { source, js, api, errors }); plik .ts otwiera się w VS Code, a proces
// główny (ts-host.js) kompiluje go do JavaScriptu i odczytuje publiczne metody, które stają się węzłami.
// Dekoratory jak w Unreal Engine wybierają, co widać w Blueprintach: @UCLASS(Blueprintable) — klasa może być
// klasą nadrzędną Blueprintu (bp.parent = id klasy TS), @UPROPERTY(…) — pole (Get / Set, Ustawienia klasy,
// Szczegóły aktora), @UFUNCTION(…) — metoda (węzeł wywołania, czysty węzeł albo zdarzenie do nadpisania).
// Wartości pól z Ustawień klasy Blueprintu są w bp.tsDefaults: { nazwaPola: wartość }, a aktora — w vars["ts:nazwaPola"].
//
// Typy z zasobów: „struct:<id>” — Struktura (w kodzie zwykły obiekt { Pole: wartość }),
// „enum:<id>” — Enumeracja (w kodzie tekst z nazwą wartości, np. "Biegnie"; w projekcie — id wpisu, więc zmiana
// nazwy nie psuje ustawień, a nieznany wpis to pierwsza wartość, jak w Unreal Engine),
// „ts:<id>” — obiekt klasy TypeScript. Wartość struktury w projekcie to { idPola: wartość }; brakujące
// albo niepasujące pole bierze wartość domyślną ze Struktury.

Object.assign(GE_KINDS, {
  struct: { label: 'Struktura', icon: '🧱', prefix: 'F_', color: '#3657c9' },
  enum: { label: 'Enumeracja (Enum)', icon: '🔢', prefix: 'E_', color: '#00a08a' },
  database: { label: 'Baza danych', icon: '🗄', prefix: 'DB_', color: '#d4a017' },
  tsclass: { label: 'Klasa TypeScript', icon: '🔷', prefix: '', color: '#3178c6' }
});
GE_CATS.push('Dane', 'TypeScript');
GE_RESERVED.add('DB').add('ENUM');

const GE_DATA_KINDS = ['struct', 'enum', 'database', 'tsclass'];
// Typ zmiennej jako typ w TypeScripcie (jsgame.d.ts) i z powrotem.
const GE_TS_TYPES = { bool: 'boolean', int: 'number', float: 'number', string: 'string', vector: 'Vec', actor: 'Actor | null', actors: 'Actor[]' };
const GE_TS_PINS = { number: 'float', string: 'string', boolean: 'bool', Vec: 'vector', Actor: 'actor' };

// ---------- Typy ----------

function geTypeRef(type) {
  const m = /^(struct|enum|ts):(.+)$/.exec(String(type ?? ''));
  if (!m) return null;
  const bp = geProj()?.blueprints.find((b) => b.id === m[2] && geKind(b) === (m[1] === 'ts' ? 'tsclass' : m[1])) ?? null;
  return { prefix: m[1], id: m[2], bp };
}

// Wartości Enumeracji (pusta lista — to nie Enumeracja albo została usunięta).
const geEnumEntries = (type) => {
  const ref = geTypeRef(type);
  return ref?.prefix === 'enum' ? ref.bp?.enum.entries ?? [] : [];
};
// Wpis Enumeracji dla wartości z projektu (id wpisu); nieznana wartość to pierwszy wpis.
const geEnumEntry = (value, type) => {
  const list = geEnumEntries(type);
  return list.find((e) => e.id === value) ?? list[0] ?? null;
};

// Etykieta i kolor typu pinu albo zmiennej (wbudowanego albo z zasobu).
function geType(type) {
  if (GE_TYPES[type]) return GE_TYPES[type];
  const c = geContainer(type);
  if (c.container !== 'single') {
    const e = geType(c.elem);
    const short = (t) => t.short ?? t.label.match(/\((.+)\)/)?.[1] ?? '?';
    if (c.container === 'array') return { label: `Tablica (Array): ${e.label}`, short: `${short(e)}[]`, color: e.color };
    if (c.container === 'set') return { label: `Zbiór (Set): ${e.label}`, short: `Set<${short(e)}>`, color: e.color };
    const v = geType(c.value);
    return { label: `Mapa (Map): ${e.label} → ${v.label}`, short: `Map<${short(e)}, ${short(v)}>`, color: e.color, valueColor: v.color };
  }
  const ref = geTypeRef(type);
  const name = ref?.bp?.name ?? '(usunięty)';
  if (ref?.prefix === 'struct') return { label: `Struktura ${name}`, short: name, color: GE_KINDS.struct.color };
  if (ref?.prefix === 'enum') return { label: `Enumeracja ${name}`, short: name, color: GE_KINDS.enum.color };
  if (ref?.prefix === 'ts') return { label: `Obiekt ${name} (TypeScript)`, short: name, color: GE_KINDS.tsclass.color };
  return { label: 'Nieznany typ', short: '?', color: '#808080' };
}

// Typy do wyboru dla zmiennych i pól: wbudowane, Struktury, Enumeracje i klasy TypeScript z projektu.
const geVarTypes = (project, except = () => false) => [
  ...GE_VAR_TYPES,
  ...project.blueprints.filter((b) => geKind(b) === 'struct').map((b) => 'struct:' + b.id),
  ...project.blueprints.filter((b) => geKind(b) === 'enum').map((b) => 'enum:' + b.id),
  ...project.blueprints.filter((b) => geKind(b) === 'tsclass').map((b) => 'ts:' + b.id)
].filter((t) => !except(t));

// Poprawny typ zmiennej albo pinu bez zaglądania do projektu (przy wczytywaniu pliku zasoby mogą być dalej).
const geIsVarType = (type) => GE_VAR_TYPES.includes(type) || /^(struct|enum|ts):./.test(String(type ?? ''));

function geVarDefault(type) {
  if (geContainer(type).container !== 'single') return [];
  if (type in GE_VAR_DEFAULTS) return JSON.parse(JSON.stringify(GE_VAR_DEFAULTS[type]));
  const ref = geTypeRef(type);
  if (ref?.prefix === 'enum') return geEnumEntries(type)[0]?.id ?? '';
  return ref?.prefix === 'struct' ? {} : null;
}

// Czy wartość pasuje do typu (po zmianie typu pola stare wartości przestają pasować).
function geValueFits(value, type) {
  if (geContainer(type).container !== 'single') return Array.isArray(value);
  switch (type) {
    case 'bool': return typeof value === 'boolean';
    case 'int':
    case 'float': return typeof value === 'number' && Number.isFinite(value);
    case 'string': return typeof value === 'string';
    case 'vector': return !!value && typeof value === 'object' && 'x' in value;
    default: {
      const ref = geTypeRef(type);
      if (ref?.prefix === 'enum') return geEnumEntries(type).some((e) => e.id === value);
      return ref?.prefix === 'struct' ? !!value && typeof value === 'object' : value === null;
    }
  }
}

const geStructFields = (type) => geTypeRef(type)?.bp?.struct.fields ?? [];
const geFieldKey = (f) => GE_RT.ident(f.name);
const geFieldValue = (value, f) => (geValueFits(value?.[f.id], f.type) ? value[f.id] : geValueFits(f.value, f.type) ? f.value : geVarDefault(f.type));

// Literał JavaScriptu dla typów z zasobów (geLiteral obsługuje wbudowane). Głębokość chroni przed pętlą Struktur.
function geDataLiteral(value, type, depth = 0) {
  const ref = geTypeRef(type);
  if (ref?.prefix === 'enum') return JSON.stringify(geEnumEntry(value, type)?.name ?? '');
  if (ref?.prefix !== 'struct' || depth > 8) return ref ? 'null' : 'undefined';
  const fields = ref.bp?.struct.fields ?? [];
  if (!fields.length) return '{}';
  return `{ ${fields.map((f) => {
    const v = geFieldValue(value, f);
    return `${geFieldKey(f)}: ${geTypeRef(f.type) ? geDataLiteral(v, f.type, depth + 1) : geLiteral(v, { type: f.type })}`;
  }).join(', ')} }`;
}

// Czy Struktura (razem z zagnieżdżonymi) ma pole typu Struktury targetId — taka nie może być polem targetId.
function geStructUses(struct, targetId, seen = new Set()) {
  if (!struct || seen.has(struct.id)) return false;
  seen.add(struct.id);
  return struct.struct.fields.some((f) => {
    const c = geContainer(f.type);
    return [c.elem, c.value].some((t) => {
      const ref = geTypeRef(t);
      return ref?.prefix === 'struct' && (ref.id === targetId || geStructUses(ref.bp, targetId, seen));
    });
  });
}

// Kopia obiektu z wartością ustawioną pod ścieżką „pole.pole.x” (tablice — np. elementy kontenera — zostają tablicami).
function geSetPath(obj, path, value) {
  const [head, ...rest] = String(path).split('.');
  const base = obj && typeof obj === 'object' ? obj : {};
  const next = rest.length ? geSetPath(base[head], rest.join('.'), value) : value;
  if (!Array.isArray(base)) return { ...base, [head]: next };
  const copy = [...base];
  copy[head] = next;
  return copy;
}

// geSetPath, który zna typ wartości: pola Struktury, których jeszcze nie zapisano, startują od wartości domyślnej
// pola (np. tablicy z elementami), a elementy kontenerów zostają w tablicy. Bez typu (wektor, nieznany) — geSetPath.
function geSetAt(value, type, path, next) {
  const keys = Array.isArray(path) ? path : String(path).split('.');
  if (!keys.length) return next;
  const [head, ...rest] = keys;
  const c = geContainer(type);
  if (c.container !== 'single') {
    const items = Array.isArray(value) ? [...value] : [];
    if (c.container !== 'map') items[head] = geSetAt(items[head], c.elem, rest, next);
    else if (!rest.length) items[head] = next;
    else {
      // Para Map: „i.0” — klucz, „i.1” — wartość.
      const [k, ...more] = rest;
      const pair = Array.isArray(items[head]) ? [...items[head]] : [geVarDefault(c.elem), geVarDefault(c.value)];
      pair[k] = geSetAt(pair[k], k === '0' ? c.elem : c.value, more, next);
      items[head] = pair;
    }
    return items;
  }
  const f = geStructFields(type).find((x) => x.id === head);
  if (!f) return geSetPath(value, keys.join('.'), next);
  const base = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return { ...base, [head]: geSetAt(geFieldValue(base, f), f.type, rest, next) };
}

// Wartość i jej typ pod ścieżką „pole.0.pole” — tak, jak pokazują ją pola edycji (z domyślnymi pól Struktury).
function geValueAt(value, type, path) {
  const keys = String(path).split('.');
  for (let i = 0; i < keys.length; i++) {
    const c = geContainer(type);
    if (c.container === 'single') {
      const f = geStructFields(type).find((x) => x.id === keys[i]);
      if (!f) return { value: undefined, type: '' };
      value = geFieldValue(value, f);
      type = f.type;
    } else if (c.container === 'map') {
      value = value?.[keys[i]]?.[keys[i + 1]];
      type = keys[++i] === '0' ? c.elem : c.value;
    } else {
      value = value?.[keys[i]];
      type = c.elem;
    }
  }
  return { value, type };
}

// Wartość Enumeracji z projektu (id wpisu) jako wyrażenie w grze — nazwa wpisu (zmienne Instance Editable).
function geEnumInstValue(expr, type) {
  const list = geEnumEntries(type);
  return `(${JSON.stringify(Object.fromEntries(list.map((e) => [e.id, e.name])))}[${expr}] ?? ${JSON.stringify(list[0]?.name ?? '')})`;
}

// Lista wartości Enumeracji (wartość w projekcie to id wpisu).
function geEnumSelect(scope, key, type, value, extra = '') {
  const list = geEnumEntries(type);
  if (!list.length) return '<span class="ge-muted">Enumeracja bez wartości</span>';
  return geSelect(scope, key, geEnumEntry(value, type).id, list.map((e) => [e.id, e.name]), extra);
}

// Pole edycji wartości Struktury: pola jedno pod drugim, zagnieżdżone Struktury z wcięciem.
// Ścieżka pola trafia do data-axis, tak jak X / Y wektora. Enumeracja — lista jej wartości.
function geDataValueInput(scope, key, type, value, extra, path = '', depth = 0) {
  if (geTypeRef(type)?.prefix === 'enum') return geEnumSelect(scope, key, type, value, extra);
  if (geTypeRef(type)?.prefix !== 'struct' || depth > 6) return '<span class="ge-muted">Brak (None)</span>';
  const fields = geStructFields(type);
  if (!fields.length) return '<span class="ge-muted">Struktura bez pól</span>';
  return `<div class="ge-struct-in">${fields.map((f) => {
    const v = geFieldValue(value, f);
    const at = `${path}${f.id}`;
    let input;
    if (geTypeRef(f.type)?.prefix === 'struct') input = geDataValueInput(scope, key, f.type, v, extra, at + '.', depth + 1);
    else if (geContainer(f.type).container !== 'single') {
      input = `<div class="ge-struct-cont">${geVarContainerInput(scope, key, f.type, v, extra, `${extra} data-k="${geEsc(key)}"`, '', at)}</div>`;
    } else if (f.type === 'vector') {
      input = `<span class="ge-vec2"><label><i class="ge-ax ge-ax-x">X</i>${geNum(scope, key, v.x, 'float', `${extra} data-axis="${at}.x"`)}</label><label><i class="ge-ax ge-ax-y">Y</i>${geNum(scope, key, v.y, 'float', `${extra} data-axis="${at}.y"`)}</label></span>`;
    } else input = geVarInput(scope, key, f.type, v, `${extra} data-axis="${at}"`);
    return `<div class="ge-struct-row"><span class="ge-struct-name"><span class="ge-pill" style="--pc:${geType(f.type).color}"></span>${geEsc(f.name)}</span>${input}</div>`;
  }).join('')}</div>`;
}

// ---------- Węzły: Struktury, Bazy danych i klasy TypeScript ----------

const geDataAsset = (n, prop, kind) => geAsset(geProj(), n?.props?.[prop], kind);
const geAssetChoice = (kind, name, empty) => ({ id: { tsclass: 'cls', database: 'db', enum: 'enum' }[kind] ?? 'struct', name, kind: 'choice', placeholder: empty,
  options: () => (geProj()?.blueprints ?? []).filter((b) => geKind(b) === kind).map((b) => [b.id, b.name]) });
const geDbRef = (c) => `DB.${geAsset(geProj(), c.prop('db'), 'database')?.id ?? 'brak'}`;
const geDbType = (n) => geDataAsset(n, 'db', 'database')?.db.valueType ?? 'string';
// Enumeracja węzła (props.enum): typ pinów, tablica nazw w grze (ENUM.<id>) i sprawdzenie.
const geEnumOf = (n) => geDataAsset(n, 'enum', 'enum');
const geEnumName = (n) => geEnumOf(n)?.name ?? 'Enum';
const geEnumType = (n) => 'enum:' + (geEnumOf(n)?.id ?? '');
const geEnumRef = (c) => `ENUM.${geAsset(geProj(), c.prop('enum'), 'enum')?.id ?? 'brak'}`;
const geEnumCheck = (n) => (geEnumOf(n) ? null : 'Wybierz Enumerację (albo została usunięta).');
const geEnumChoice = () => geAssetChoice('enum', 'Enumeracja', '— wybierz enumerację —');

// Klasa TypeScript węzła i jej metoda (props.fn = „idKlasy:nazwaMetody”).
function geTsMethodOf(n) {
  const [id, name] = String(n?.props?.fn ?? '').split(':');
  const cls = geAsset(geProj(), id, 'tsclass');
  return { cls, method: cls?.ts.api?.methods.find((m) => m.name === name) ?? null, name };
}

// Piny parametrów z typów TypeScriptu; null — któregoś typu nie da się zamienić na pin.
function geTsParamPins(params) {
  const pins = params.map((p, i) => {
    const type = geTsPinType(p.type);
    return type && type !== 'none' ? geP('p' + i, p.name, type, geVarDefault(type)) : null;
  });
  return pins.every(Boolean) ? pins : null;
}

const geTsArgs = (c, params) => params.map((p, i) => c.in('p' + i)).join(', ');

function geTsCheck(cls) {
  if (!cls) return 'Wybierz klasę TypeScript (albo została usunięta).';
  if (cls.ts.errors.length || !cls.ts.js) return `Klasa ${cls.name} ma błędy kompilacji — popraw ją w VS Code.`;
  if (!geTsClasses(geProj()).some((e) => e.bp === cls)) return `Nazwa klasy ${cls.ts.api?.className ?? cls.name} jest zajęta (inna klasa TypeScript albo słowo silnika). Zmień ją w pliku .ts.`;
  return null;
}

// ---------- Dekoratory: co klasa TypeScript pokazuje Blueprintom (UCLASS / UPROPERTY / UFUNCTION) ----------

const geTsHas = (d, ...names) => names.some((name) => d?.specifiers?.includes(name));
const geTsMeta = (item, key) => (item?.uproperty ?? item?.ufunction)?.meta?.[key];
// Nazwa w Blueprintach: DisplayName z dekoratora albo nazwa z kodu.
const geTsLabel = (item) => String(geTsMeta(item, 'DisplayName') ?? item?.name ?? '?');
// Klasa z dekoratorami pokazuje Blueprintom tylko oznaczone elementy; bez nich — wszystkie publiczne metody (jak wcześniej).
const geTsDecorated = (api) => !!(api?.uclass || api?.props?.length || api?.methods.some((m) => m.ufunction));

// Węzły metody: call — BlueprintCallable, pure — BlueprintPure, event — BlueprintImplementableEvent / BlueprintNativeEvent.
function geTsFnKinds(api, m) {
  if (!m) return [];
  if (!geTsDecorated(api)) return ['call'];
  const d = m.ufunction;
  const kinds = [];
  if (geTsHas(d, 'BlueprintPure')) kinds.push('pure');
  else if (geTsHas(d, 'BlueprintCallable')) kinds.push('call');
  if (!m.static && geTsHas(d, 'BlueprintImplementableEvent', 'BlueprintNativeEvent')) kinds.push('event');
  return kinds;
}
const GE_TS_FN_SPEC = { call: 'BlueprintCallable', pure: 'BlueprintPure', event: 'BlueprintImplementableEvent' };

// Pola: Get (BlueprintReadOnly / ReadWrite), Set (ReadWrite), edycja w Ustawieniach klasy i w Szczegółach aktora.
const geTsCanGet = (p) => geTsHas(p.uproperty, 'BlueprintReadOnly', 'BlueprintReadWrite');
const geTsCanSet = (p) => geTsHas(p.uproperty, 'BlueprintReadWrite');
const geTsEditDefaults = (p) => geTsHas(p.uproperty, 'EditAnywhere', 'EditDefaultsOnly');
const geTsEditInstance = (p) => geTsHas(p.uproperty, 'EditAnywhere', 'EditInstanceOnly');
const geTsVisible = (p) => geTsHas(p.uproperty, 'VisibleAnywhere', 'VisibleDefaultsOnly', 'VisibleInstanceOnly');
// Typy pól, które da się wpisać w Szczegółach (jak Instance Editable zmiennych Blueprintu).
const GE_TS_EDIT_TYPES = ['bool', 'float', 'string'];
const geTsPropType = (p) => {
  const type = geTsPinType(p?.type);
  return type && type !== 'none' ? type : null;
};

const geTsByName = (project, name) => (name ? project?.blueprints.find((b) => geKind(b) === 'tsclass' && b.ts.api?.className === name) ?? null : null);

// Klasa TypeScript i jej przodkowie TypeScript (od niej w górę), np. [Boss, Wrog].
function geTsChain(project, cls) {
  const list = [];
  for (let c = cls; c && !list.includes(c); c = geTsByName(project, c.ts.api?.base)) list.push(c);
  return list;
}

// Klasa TypeScript, po której dziedziczy klasa Blueprint (sama albo przez swoje klasy nadrzędne Blueprint).
function geTsParentOf(project, bp) {
  if (!project || !bp || geKind(bp) !== 'actor') return null;
  const root = [bp, ...geAncestors(project, bp)].at(-1);
  return geAsset(project, root.parent, 'tsclass');
}

// Klasy TypeScript, po których dziedziczy Blueprint — od najbliższej.
const geTsLineage = (project, bp) => geTsChain(project, geTsParentOf(project, bp));

// Dlaczego klasa TypeScript nie może być klasą nadrzędną Blueprintu; null — może.
function geTsParentProblem(project, cls) {
  const api = cls?.ts.api;
  if (!api || cls.ts.errors.length || !cls.ts.js) return `Klasa ${cls?.name ?? '?'} ma błędy kompilacji — popraw ją w VS Code.`;
  if (!api.uclass || geTsHas(api.uclass, 'NotBlueprintable')) return `Klasa ${api.className} nie ma @UCLASS(Blueprintable).`;
  if (geTsChain(project, cls).at(-1).ts.api?.base !== 'Actor') return `Klasa ${api.className} musi dziedziczyć po Actor (sama albo przez inną klasę TypeScript).`;
  if (api.ctorDeclared && api.ctor[0]?.type !== 'Game') return `Konstruktor ${api.className} musi przyjmować (game: Game, data: ActorData) i przekazać je do super(game, data) — tak silnik tworzy aktorów klas Blueprint.`;
  if (!geTsClasses(project).some((e) => e.bp === cls)) return `Nazwa klasy ${api.className} jest zajęta (inna klasa TypeScript albo słowo silnika).`;
  return null;
}

// UPROPERTY klas TypeScript, po których dziedziczy Blueprint: [{ cls, prop }]; ta sama nazwa — z najbliższej klasy.
function geTsLineageProps(project, bp) {
  const seen = new Set();
  return geTsLineage(project, bp).flatMap((cls) => (cls.ts.api.props ?? []).filter((p) => !seen.has(p.name) && seen.add(p.name)).map((prop) => ({ cls, prop })));
}

// Wartość pola dla klasy Blueprint: z jej Ustawień klasy, z najbliższej klasy nadrzędnej Blueprint albo z kodu TypeScript.
function geTsClassDefault(project, bp, prop) {
  const type = geTsPropType(prop);
  const owner = [bp, ...geAncestors(project, bp)].find((b) => b.tsDefaults && geValueFits(b.tsDefaults[prop.name], type));
  if (owner) return owner.tsDefaults[prop.name];
  return geValueFits(prop.value, type) ? prop.value : geVarDefault(type);
}

// Linijki konstruktora klasy Blueprint: wartości pól z jej Ustawień klasy, a potem — z aktora na poziomie.
// Każda klasa w łańcuchu dopisuje wartość aktora jeszcze raz, więc wygrywa ona z ustawieniami klas podrzędnych.
function geTsCtorLines(project, bp) {
  const lines = [];
  geTsLineageProps(project, bp).forEach(({ prop }) => {
    const type = geTsPropType(prop);
    if (!GE_TS_EDIT_TYPES.includes(type)) return;
    if (geTsEditDefaults(prop) && geValueFits(bp.tsDefaults?.[prop.name], type)) lines.push(`this.${prop.name} = ${geLiteral(bp.tsDefaults[prop.name], { type })};`);
    if (geTsEditInstance(prop)) lines.push(`this.${prop.name} = data.vars[${JSON.stringify('ts:' + prop.name)}] ?? this.${prop.name};`);
  });
  return lines;
}

// Pole węzła (props.prop = „idKlasy:nazwaPola”).
function geTsPropOf(n) {
  const [id, name] = String(n?.props?.prop ?? '').split(':');
  const cls = geAsset(geProj(), id, 'tsclass');
  return { cls, prop: cls?.ts.api?.props?.find((p) => p.name === name) ?? null, name };
}

// Pin Target obiektu klasy cls. W Blueprincie, który po niej dziedziczy, pusty Target to on sam (this).
const geTsTarget = (cls, bp) => geP('target', 'Target', 'ts:' + cls.id, null, geTsLineage(geProj(), bp).includes(cls) ? { self: true } : {});
// Obiekt, na którym działa węzeł: this albo podłączony obiekt (pusty — nic się nie dzieje).
const geTsOn = (c) => {
  const target = c.in('target');
  return target === 'this' ? 'this' : `${target}?`;
};
// Nazwa parametru zdarzenia z TypeScriptu w metodzie Blueprintu (wzorzec { x, y } dostaje zwykłą nazwę).
const geTsParamName = (p, i) => (/^[A-Za-z_$][\w$]*$/.test(p.name) ? p.name : 'arg' + i);

function geTsFnCheck(n, kind) {
  const { cls, method, name } = geTsMethodOf(n);
  if (!cls) return 'Klasa TypeScript tej metody została usunięta.';
  if (!method) return `W klasie ${cls.name} nie ma już publicznej metody „${name}”.`;
  if (!geTsFnKinds(cls.ts.api, method).includes(kind)) return `Metoda ${name} nie ma już @UFUNCTION(${GE_TS_FN_SPEC[kind]}) w klasie ${cls.ts.api.className}.`;
  return geTsCheck(cls) ?? (geTsParamPins(method.params) ? null : `Metoda ${name} ma parametr bez obsługiwanego typu.`);
}

function geTsPropCheck(n, mode) {
  const { cls, prop, name } = geTsPropOf(n);
  if (!cls) return 'Klasa TypeScript tego pola została usunięta.';
  if (!prop) return `W klasie ${cls.name} nie ma już pola „${name}” z @UPROPERTY.`;
  if (!(mode === 'set' ? geTsCanSet(prop) : geTsCanGet(prop))) return `Pole ${name} nie ma @UPROPERTY(${mode === 'set' ? 'BlueprintReadWrite' : 'BlueprintReadOnly albo BlueprintReadWrite'}).`;
  if (!geTsPropType(prop)) return `Pole ${name} ma typ ${prop.type}, którego nie ma w Blueprintach.`;
  return geTsCheck(cls);
}

const geTsFnTitle = (n) => {
  const { cls, method, name } = geTsMethodOf(n);
  return cls ? `${cls.ts.api?.className ?? cls.name}.${method ? geTsLabel(method) : name}` : 'Metoda TypeScript';
};

const GE_DATA_NODES = [
  // ---------- Struktury ----------
  { type: 'make_struct', title: (n) => `Make ${geDataAsset(n, 'struct', 'struct')?.name ?? 'Struct'}`, pl: 'Złóż strukturę', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Tworzy wartość Struktury z pól. W kodzie to zwykły obiekt { Pole: wartość }.',
    props: [geAssetChoice('struct', 'Struktura', '— wybierz strukturę —')],
    pins: (n) => {
      const s = geDataAsset(n, 'struct', 'struct');
      return { ins: (s?.struct.fields ?? []).map((f) => geP(f.id, f.name, f.type, f.value)), outs: [geP('out', '', s ? 'struct:' + s.id : 'struct:')] };
    },
    check: (n) => (geDataAsset(n, 'struct', 'struct') ? null : 'Wybierz Strukturę (albo została usunięta).'),
    expr: (c) => {
      const fields = geDataAsset({ props: { struct: c.prop('struct') } }, 'struct', 'struct')?.struct.fields ?? [];
      return `({ ${fields.map((f) => `${geFieldKey(f)}: ${c.in(f.id)}`).join(', ')} })`;
    } },
  { type: 'break_struct', title: (n) => `Break ${geDataAsset(n, 'struct', 'struct')?.name ?? 'Struct'}`, pl: 'Rozłóż strukturę', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Wyciąga pola z wartości Struktury — każde pole to osobny pin.',
    props: [geAssetChoice('struct', 'Struktura', '— wybierz strukturę —')],
    pins: (n) => {
      const s = geDataAsset(n, 'struct', 'struct');
      return { ins: [geP('s', s?.name ?? 'Struct', s ? 'struct:' + s.id : 'struct:', null)], outs: (s?.struct.fields ?? []).map((f) => geP(f.id, f.name, f.type)) };
    },
    check: (n) => (geDataAsset(n, 'struct', 'struct') ? null : 'Wybierz Strukturę (albo została usunięta).'),
    expr: (c, outId) => {
      const f = geDataAsset({ props: { struct: c.prop('struct') } }, 'struct', 'struct')?.struct.fields.find((x) => x.id === outId);
      if (!f) return 'undefined';
      const fallback = geTypeRef(f.type) ? geDataLiteral(f.value, f.type) : geLiteral(f.value, { type: f.type });
      return `(${c.in('s')}?.${geFieldKey(f)} ?? ${fallback})`;
    } },

  // ---------- Enumeracje (jak węzły UEnum w Unreal Engine) ----------
  { type: 'enum_switch', title: (n) => `Switch on ${geEnumName(n)}`, pl: 'Rozgałęzienie po wartości enumeracji', cat: 'Dane', kind: 'flow', hidden: true,
    desc: 'Idzie białym pinem tej wartości, którą ma Selection — każda wartość Enumeracji ma własne wyjście.',
    props: [geEnumChoice()],
    pins: (n) => ({ ins: [geX(), geP('sel', 'Selection', geEnumType(n), null)], outs: (geEnumOf(n)?.enum.entries ?? []).map((e) => geX('v_' + e.id, e.name)) }),
    check: geEnumCheck,
    gen: (c) => {
      const entries = geAsset(geProj(), c.prop('enum'), 'enum')?.enum.entries ?? [];
      const cases = entries.map((e) => [e, c.exec('v_' + e.id)]).filter(([, code]) => code);
      if (!cases.length) return '';
      return `switch (${c.in('sel')}) {\n${cases.map(([e, code]) => `  case ${JSON.stringify(e.name)}: {\n${geIndent(code, '    ')}\n    break;\n  }`).join('\n')}\n}`;
    } },
  { type: 'enum_eq', title: (n) => `Equal (${geEnumName(n)})`, pl: 'Wartości enumeracji równe', cat: 'Dane', kind: 'pure', compact: '==', hidden: true,
    props: [geEnumChoice()],
    pins: (n) => ({ ins: [geP('a', '', geEnumType(n), null), geP('b', '', geEnumType(n), null)], outs: [geP('out', '', 'bool')] }),
    check: geEnumCheck,
    expr: (c) => `(${c.in('a')} === ${c.in('b')})` },
  { type: 'enum_neq', title: (n) => `Not Equal (${geEnumName(n)})`, pl: 'Wartości enumeracji różne', cat: 'Dane', kind: 'pure', compact: '!=', hidden: true,
    props: [geEnumChoice()],
    pins: (n) => ({ ins: [geP('a', '', geEnumType(n), null), geP('b', '', geEnumType(n), null)], outs: [geP('out', '', 'bool')] }),
    check: geEnumCheck,
    expr: (c) => `(${c.in('a')} !== ${c.in('b')})` },
  { type: 'enum_literal', title: (n) => `Literal enum ${geEnumName(n)}`, pl: 'Wartość enumeracji', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Jedna, wybrana na liście wartość Enumeracji.',
    props: [geEnumChoice()],
    pins: (n) => ({ ins: [geP('value', 'Value', geEnumType(n), null)], outs: [geP('out', 'Return Value', geEnumType(n))] }),
    check: geEnumCheck,
    expr: (c) => c.in('value') },
  { type: 'enum_for_each', title: (n) => `ForEach ${geEnumName(n)}`, pl: 'Dla każdej wartości enumeracji', cat: 'Dane', kind: 'flow', hidden: true,
    desc: 'Wykonuje Loop Body dla każdej wartości Enumeracji po kolei (Enum Value), potem Completed.',
    props: [geEnumChoice()],
    pins: (n) => ({ ins: [geX()], outs: [geX('body', 'Loop Body'), geP('value', 'Enum Value', geEnumType(n), null, { local: 'enumValue' }), geX('completed', 'Completed')] }),
    check: geEnumCheck,
    gen: (c) => {
      const done = c.exec('completed');
      return `for (${c.local('value')} of ${geEnumRef(c)}) {\n${geIndent(c.exec('body'))}\n}` + (done ? `\n${done}` : '');
    } },
  { type: 'enum_count', title: (n) => `Get number of entries in ${geEnumName(n)}`, pl: 'Liczba wartości enumeracji', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Ile wartości ma Enumeracja.',
    props: [geEnumChoice()],
    outs: [geP('out', 'Return Value', 'int')],
    check: geEnumCheck,
    expr: (c) => `${geEnumRef(c)}.length` },
  { type: 'enum_from_int', title: (n) => `Byte to Enum ${geEnumName(n)}`, pl: 'Liczba na wartość enumeracji', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Wartość Enumeracji o tym numerze (od 0). Numer spoza listy daje pierwszą wartość. W drugą stronę — podłącz Enumerację do pinu Integer.',
    props: [geEnumChoice()],
    pins: (n) => ({ ins: [geP('index', 'Byte', 'int', 0)], outs: [geP('out', 'Return Value', geEnumType(n))] }),
    check: geEnumCheck,
    expr: (c) => `(${geEnumRef(c)}[${c.in('index')}] ?? ${geEnumRef(c)}[0])` },

  // ---------- Bazy danych ----------
  { type: 'db_get', title: (n) => `Find (${geDataAsset(n, 'db', 'database')?.name ?? 'Baza danych'})`, pl: 'Pobierz z bazy danych', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Wartość zapisana pod kluczem. Found mówi, czy taki klucz jest w bazie — bez niego Value to wartość domyślna typu.',
    props: [geAssetChoice('database', 'Baza danych', '— wybierz bazę —')],
    pins: (n) => ({ ins: [geP('key', 'Key', 'string', '')], outs: [geP('value', 'Value', geDbType(n)), geP('found', 'Found', 'bool')] }),
    check: (n) => (geDataAsset(n, 'db', 'database') ? null : 'Wybierz Bazę danych (albo została usunięta).'),
    expr: (c, outId) => {
      const db = geAsset(geProj(), c.prop('db'), 'database');
      if (outId === 'found') return `${geDbRef(c)}.has(${c.in('key')})`;
      const type = db?.db.valueType ?? 'string';
      return `(${geDbRef(c)}.get(${c.in('key')}) ?? ${geTypeRef(type) ? geDataLiteral({}, type) : geLiteral(geVarDefault(type), { type })})`;
    } },
  { type: 'db_set', title: (n) => `Add (${geDataAsset(n, 'db', 'database')?.name ?? 'Baza danych'})`, pl: 'Zapisz w bazie danych', cat: 'Dane', kind: 'exec', hidden: true,
    desc: 'Zapisuje wartość pod kluczem (nowy klucz albo nadpisanie). Zmiany trwają do zamknięcia gry — restart poziomu ich nie cofa.',
    props: [geAssetChoice('database', 'Baza danych', '— wybierz bazę —')],
    pins: (n) => ({ ins: [geX(), geP('key', 'Key', 'string', ''), geP('value', 'Value', geDbType(n), geVarDefault(geDbType(n)))], outs: [geX('then')] }),
    check: (n) => (geDataAsset(n, 'db', 'database') ? null : 'Wybierz Bazę danych (albo została usunięta).'),
    stmt: (c) => `${geDbRef(c)}.set(${c.in('key')}, ${c.in('value')});` },
  { type: 'db_remove', title: (n) => `Remove (${geDataAsset(n, 'db', 'database')?.name ?? 'Baza danych'})`, pl: 'Usuń z bazy danych', cat: 'Dane', kind: 'exec', hidden: true,
    desc: 'Usuwa klucz razem z wartością.',
    props: [geAssetChoice('database', 'Baza danych', '— wybierz bazę —')],
    ins: [geX(), geP('key', 'Key', 'string', '')], outs: [geX('then')],
    check: (n) => (geDataAsset(n, 'db', 'database') ? null : 'Wybierz Bazę danych (albo została usunięta).'),
    stmt: (c) => `${geDbRef(c)}.delete(${c.in('key')});` },
  { type: 'db_count', title: (n) => `Length (${geDataAsset(n, 'db', 'database')?.name ?? 'Baza danych'})`, pl: 'Liczba wpisów w bazie', cat: 'Dane', kind: 'pure', hidden: true,
    desc: 'Ile kluczy jest teraz w bazie.',
    props: [geAssetChoice('database', 'Baza danych', '— wybierz bazę —')],
    outs: [geP('out', '', 'int')],
    check: (n) => (geDataAsset(n, 'db', 'database') ? null : 'Wybierz Bazę danych (albo została usunięta).'),
    expr: (c) => `${geDbRef(c)}.size` },

  // ---------- Klasy TypeScript ----------
  { type: 'ts_new', title: (n) => `Construct ${geDataAsset(n, 'cls', 'tsclass')?.ts.api?.className ?? 'Object'}`, pl: 'Utwórz obiekt klasy TypeScript', cat: 'TypeScript', kind: 'exec', hidden: true,
    desc: 'new Klasa(…) — nowy obiekt klasy TypeScript. Zapisz go w zmiennej typu tej klasy, żeby wywoływać jego metody.',
    props: [geAssetChoice('tsclass', 'Klasa', '— wybierz klasę —')],
    pins: (n) => {
      const cls = geDataAsset(n, 'cls', 'tsclass');
      return { ins: [geX(), ...(geTsParamPins(cls?.ts.api?.ctor ?? []) ?? [])], outs: [geX('then'), geP('out', 'Return Value', cls ? 'ts:' + cls.id : 'ts:', null, { local: 'obj' })] };
    },
    check: (n) => {
      const cls = geDataAsset(n, 'cls', 'tsclass');
      return geTsCheck(cls) ?? (geTsParamPins(cls.ts.api?.ctor ?? []) ? null : 'Konstruktor ma parametr bez obsługiwanego typu (number, string, boolean, Vec, Actor, Struktura albo klasa TS).');
    },
    stmt: (c) => {
      const cls = geAsset(geProj(), c.prop('cls'), 'tsclass');
      return `${c.local('out')} = new ${cls?.ts.api?.className ?? 'Object'}(${geTsArgs(c, cls?.ts.api?.ctor ?? [])});`;
    } },
  { type: 'ts_call', title: geTsFnTitle, pl: 'Wywołaj metodę klasy TypeScript', cat: 'TypeScript', kind: 'exec', hidden: true,
    desc: 'Wywołuje metodę z pliku .ts (w klasie z dekoratorami — z @UFUNCTION(BlueprintCallable)). Metoda statyczna nie potrzebuje obiektu, zwykła — obiektu z „Construct” (Target). W Blueprincie, który dziedziczy po tej klasie, pusty Target to on sam.',
    pins: (n, bp) => {
      const { cls, method } = geTsMethodOf(n);
      if (!method) return { ins: [geX()], outs: [geX('then')] };
      const ret = geTsPinType(method.returns);
      return {
        ins: [geX(), ...(method.static ? [] : [geTsTarget(cls, bp)]), ...(geTsParamPins(method.params) ?? [])],
        outs: [geX('then'), ...(ret && ret !== 'none' ? [geP('ret', 'Return Value', ret, null, { local: 'ret' })] : [])]
      };
    },
    check: (n) => geTsFnCheck(n, 'call'),
    stmt: (c) => {
      const { cls, method, name } = geTsMethodOf({ props: { fn: c.prop('fn') } });
      if (!method) return `// brak metody ${name}`;
      const call = `${method.static ? cls.ts.api.className : geTsOn(c)}.${name}(${geTsArgs(c, method.params)})`;
      const ret = geTsPinType(method.returns);
      return ret && ret !== 'none' ? `${c.local('ret')} = ${call};` : `${call};`;
    } },
  { type: 'ts_pure', title: geTsFnTitle, pl: 'Wynik metody klasy TypeScript (BlueprintPure)', cat: 'TypeScript', kind: 'pure', hidden: true,
    desc: 'Metoda z @UFUNCTION(BlueprintPure): tylko liczy wynik, więc węzeł nie ma białych pinów — jak Get zmiennej.',
    pins: (n, bp) => {
      const { cls, method } = geTsMethodOf(n);
      if (!method) return { ins: [], outs: [] };
      const ret = geTsPinType(method.returns);
      return { ins: [...(method.static ? [] : [geTsTarget(cls, bp)]), ...(geTsParamPins(method.params) ?? [])], outs: ret && ret !== 'none' ? [geP('ret', 'Return Value', ret)] : [] };
    },
    check: (n) => {
      const problem = geTsFnCheck(n, 'pure');
      if (problem) return problem;
      const { method, name } = geTsMethodOf(n);
      const ret = geTsPinType(method.returns);
      return ret && ret !== 'none' ? null : `Metoda ${name} z BlueprintPure musi zwracać wynik (number, string, boolean, Vec, Actor, Struktura albo klasa TS).`;
    },
    expr: (c) => {
      const { cls, method, name } = geTsMethodOf({ props: { fn: c.prop('fn') } });
      if (!method) return 'undefined';
      return `${method.static ? cls.ts.api.className : geTsOn(c)}.${name}(${geTsArgs(c, method.params)})`;
    } },
  { type: 'ev_ts', title: (n) => {
      const { method, name } = geTsMethodOf(n);
      return `Event ${method ? geTsLabel(method) : name || '?'}`;
    }, pl: 'Zdarzenie z klasy TypeScript', cat: 'Zdarzenia', kind: 'event', actorOnly: true, hidden: true,
    desc: 'Metoda z @UFUNCTION(BlueprintImplementableEvent) albo (BlueprintNativeEvent) w klasie TypeScript, po której dziedziczy ten Blueprint. Kod TypeScript ją wywołuje (this.metoda(…)), a Blueprint daje jej treść. W BlueprintNativeEvent „Call Parent Event” uruchamia też wersję z TypeScriptu.',
    pins: (n) => {
      const { method } = geTsMethodOf(n);
      return { ins: [], outs: [geX('then'), ...(method?.params ?? []).map((p, i) => geP('p' + i, p.name, geTsPinType(p.type) ?? 'none', null, { expr: geTsParamName(p, i) })).filter((p) => p.type !== 'none')] };
    },
    methods: (n) => {
      const { method, name } = geTsMethodOf(n);
      return [{ pin: 'then', name: method?.name ?? GE_RT.ident(name || 'brak'), params: (method?.params ?? []).map(geTsParamName).join(', ') }];
    },
    check: (n, bp, project) => {
      const problem = geTsFnCheck(n, 'event');
      if (problem) return problem;
      const { cls } = geTsMethodOf(n);
      return geTsLineage(project, bp).includes(cls) ? null : `Ten Blueprint nie dziedziczy po ${cls.ts.api.className} — ustaw ją jako klasę nadrzędną albo usuń węzeł.`;
    } },
  { type: 'ts_prop_get', title: (n) => geTsLabel(geTsPropOf(n).prop ?? { name: geTsPropOf(n).name }), pl: 'Pobierz pole klasy TypeScript', cat: 'TypeScript', kind: 'pure', hidden: true,
    desc: 'Pole z @UPROPERTY(BlueprintReadOnly) albo (BlueprintReadWrite) w klasie TypeScript. W Blueprincie, który dziedziczy po tej klasie, pusty Target to on sam.',
    pins: (n, bp) => {
      const { cls, prop } = geTsPropOf(n);
      return prop ? { ins: [geTsTarget(cls, bp)], outs: [geP('out', '', geTsPropType(prop) ?? 'string')] } : { ins: [], outs: [] };
    },
    check: (n) => geTsPropCheck(n, 'get'),
    expr: (c) => {
      const { prop, name } = geTsPropOf({ props: { prop: c.prop('prop') } });
      return prop ? `${geTsOn(c)}.${name}` : 'undefined';
    } },
  { type: 'ts_prop_set', title: (n) => `Set ${geTsLabel(geTsPropOf(n).prop ?? { name: geTsPropOf(n).name })}`, pl: 'Ustaw pole klasy TypeScript', cat: 'TypeScript', kind: 'exec', hidden: true,
    desc: 'Zmienia pole z @UPROPERTY(BlueprintReadWrite) w klasie TypeScript.',
    pins: (n, bp) => {
      const { cls, prop } = geTsPropOf(n);
      if (!prop) return { ins: [geX()], outs: [geX('then')] };
      const type = geTsPropType(prop) ?? 'string';
      return { ins: [geX(), geTsTarget(cls, bp), geP('value', geTsLabel(prop), type, geVarDefault(type))], outs: [geX('then')] };
    },
    check: (n) => geTsPropCheck(n, 'set'),
    stmt: (c) => {
      const { prop, name } = geTsPropOf({ props: { prop: c.prop('prop') } });
      if (!prop) return `// brak pola ${name}`;
      const target = c.in('target');
      return target === 'this' ? `this.${name} = ${c.in('value')};` : `if (${target}) ${target}.${name} = ${c.in('value')};`;
    } }
];
GE_NODE_LIST.push(...GE_DATA_NODES);
GE_DATA_NODES.forEach((def) => {
  GE_NODES[def.type] = def;
});

// Gotowe węzły dla zasobów projektu w menu prawego przycisku na grafie.
// noEvents — graf bez zdarzeń (Construction Script, funkcja).
function geDataMenuEntries(bp, noEvents = false) {
  const items = [];
  geOfKind('struct').forEach((s) => {
    items.push({ cat: 'Dane', label: `Make ${s.name}`, ue: `Złóż strukturę ${s.name}`, node: { type: 'make_struct', props: { struct: s.id }, values: {} } });
    items.push({ cat: 'Dane', label: `Break ${s.name}`, ue: `Rozłóż strukturę ${s.name}`, node: { type: 'break_struct', props: { struct: s.id }, values: {} } });
  });
  geOfKind('enum').forEach((en) => {
    [['enum_switch', `Switch on ${en.name}`, 'Rozgałęzienie po'], ['enum_eq', `Equal (${en.name})`, 'Równe — wartości'], ['enum_neq', `Not Equal (${en.name})`, 'Różne — wartości'],
      ['enum_literal', `Literal enum ${en.name}`, 'Wartość z'], ['enum_for_each', `ForEach ${en.name}`, 'Pętla po wartościach'],
      ['enum_count', `Get number of entries in ${en.name}`, 'Liczba wartości'], ['enum_from_int', `Byte to Enum ${en.name}`, 'Liczba na wartość']].forEach(([type, label, ue]) => {
      items.push({ cat: 'Dane', label, ue: `${ue} ${en.name}`, node: { type, props: { enum: en.id }, values: {} } });
    });
  });
  geOfKind('database').forEach((db) => {
    [['db_get', 'Find', 'Pobierz z'], ['db_set', 'Add', 'Zapisz w'], ['db_remove', 'Remove', 'Usuń z'], ['db_count', 'Length', 'Liczba wpisów w']].forEach(([type, label, ue]) => {
      items.push({ cat: 'Dane', label: `${label} (${db.name})`, ue: `${ue} ${db.name}`, node: { type, props: { db: db.id }, values: {} } });
    });
  });
  // Klasy, po których ten Blueprint dziedziczy: ich zdarzenia i pola są jak własne (Zdarzenia, Zmienne).
  const lineage = bp ? geTsLineage(geProj(), bp) : [];
  geOfKind('tsclass').forEach((cls) => {
    const api = cls.ts.api;
    if (!api) return;
    const own = lineage.includes(cls);
    const where = (item) => [api.className, geTsMeta(item, 'Category')].filter(Boolean).join(' › ');
    // Klasa z @UCLASS to klasa nadrzędna Blueprintów — jej aktorów tworzy Spawn Actor klasy Blueprint.
    if (!api.uclass) items.push({ cat: 'TypeScript', label: `Construct ${api.className}`, ue: `Utwórz obiekt ${api.className}`, node: { type: 'ts_new', props: { cls: cls.id }, values: {} } });
    api.methods.forEach((m) => {
      const fn = `${cls.id}:${m.name}`;
      geTsFnKinds(api, m).forEach((kind) => {
        if (kind === 'event') {
          if (own && !noEvents) items.push({ cat: 'Zdarzenia', label: `Event ${geTsLabel(m)}`, ue: `Zdarzenie z ${where(m)}`, node: { type: 'ev_ts', props: { fn }, values: {} } });
          return;
        }
        items.push({ cat: 'TypeScript', label: `${api.className}.${geTsLabel(m)}`, ue: `${m.static ? 'Metoda statyczna' : kind === 'pure' ? 'Czysta metoda' : 'Metoda'} ${m.name} (${where(m)})`, node: { type: kind === 'pure' ? 'ts_pure' : 'ts_call', props: { fn }, values: {} } });
      });
    });
    (api.props ?? []).forEach((p) => {
      const prop = `${cls.id}:${p.name}`;
      const cat = own ? 'Zmienne' : 'TypeScript';
      const label = own ? geTsLabel(p) : `${api.className}.${geTsLabel(p)}`;
      if (geTsCanGet(p)) items.push({ cat, label: `Get ${label}`, ue: `Pobierz pole ${p.name} (${where(p)})`, node: { type: 'ts_prop_get', props: { prop }, values: {} } });
      if (geTsCanSet(p)) items.push({ cat, label: `Set ${label}`, ue: `Ustaw pole ${p.name} (${where(p)})`, node: { type: 'ts_prop_set', props: { prop }, values: {} } });
    });
  });
  return items;
}

// ---------- Ustawienia klasy i Szczegóły aktora: pola UPROPERTY z klasy TypeScript ----------

// Wiersze pól, pogrupowane jak w Unreal Engine po Category (bez niej — po nazwie klasy TS).
function geTsPropCats(entries, row) {
  const groups = new Map();
  entries.forEach((e) => {
    const html = row(e);
    if (!html) return;
    const title = String(geTsMeta(e.prop, 'Category') ?? e.cls.ts.api.className);
    groups.set(title, (groups.get(title) ?? '') + html);
  });
  return [...groups].map(([title, html]) => geCat(title, html)).join('');
}

// Ustawienia klasy Blueprint: EditAnywhere / EditDefaultsOnly — do zmiany, Visible… — do podglądu.
function geTsDefaultsHtml(bp) {
  return geTsPropCats(geTsLineageProps(ge.project, bp), ({ prop }) => {
    const type = geTsPropType(prop);
    const value = geTsClassDefault(ge.project, bp, prop);
    const tip = String(geTsMeta(prop, 'ToolTip') ?? '');
    if (geTsEditDefaults(prop) && GE_TS_EDIT_TYPES.includes(type)) return geRow(geTsLabel(prop), geVarInput('ts-default', prop.name, type, value), tip);
    if (geTsEditDefaults(prop) || geTsVisible(prop)) return geRow(geTsLabel(prop), `<span class="ge-muted">${geEsc(value === null ? 'None' : String(value))}</span>`, tip);
    return '';
  });
}

// Szczegóły aktora na poziomie: EditAnywhere / EditInstanceOnly (wartość w vars["ts:nazwaPola"]).
function geTsInstanceHtml(bp, actor) {
  return geTsPropCats(geTsLineageProps(ge.project, bp), ({ prop }) => {
    const type = geTsPropType(prop);
    if (!geTsEditInstance(prop) || !GE_TS_EDIT_TYPES.includes(type)) return '';
    const saved = actor.vars?.['ts:' + prop.name];
    return geRow(geTsLabel(prop), geVarInput('actor-var', 'ts:' + prop.name, type, geValueFits(saved, type) ? saved : geTsClassDefault(ge.project, bp, prop)), String(geTsMeta(prop, 'ToolTip') ?? ''));
  });
}

// ---------- Kod gry ----------

// Klasy TypeScript, które wchodzą do programu: skompilowane, z unikalną nazwą, klasa bazowa przed podrzędną.
function geTsClasses(project) {
  const used = new Set(GE_RESERVED);
  const ok = [];
  project.blueprints.filter((b) => geKind(b) === 'tsclass' && b.ts.js && b.ts.api && !b.ts.errors.length).forEach((bp) => {
    const name = bp.ts.api.className;
    if (used.has(name)) return;
    used.add(name);
    ok.push({ bp, name });
  });
  const list = [];
  const visit = (entry, depth = 0) => {
    if (list.includes(entry) || depth > ok.length) return;
    const base = /\bextends\s+([A-Za-z_$][\w$]*)/.exec(entry.bp.ts.js)?.[1];
    const parent = ok.find((e) => e.name === base && e !== entry);
    if (parent) visit(parent, depth + 1);
    if (!list.includes(entry)) list.push(entry);
  };
  ok.forEach((e) => visit(e));
  return list;
}

// Początek programu gry: Enumeracje (listy nazw), bazy danych (Map) i klasy TypeScript — przed klasami Blueprintów.
// ts — kod źródłowy klas (program w TypeScripcie), bez niego — wynik kompilacji do wykonania.
function geDataPrelude(project, { ts = false, debug = false } = {}) {
  const lines = [];
  const enums = project.blueprints.filter((b) => geKind(b) === 'enum');
  if (enums.length) {
    lines.push('', '// Enumeracje: wartości po kolei (numer wartości to jej indeks, jak Byte w Unreal Engine).', `const ENUM${ts ? ': Record<string, any[]>' : ''} = {`);
    enums.forEach((en) => lines.push(`  ${en.id}: [${en.enum.entries.map((e) => JSON.stringify(e.name)).join(', ')}], // ${en.name.replace(/\n/g, ' ')}`));
    lines.push('};');
  }
  const dbs = project.blueprints.filter((b) => geKind(b) === 'database');
  if (dbs.length) {
    lines.push('', '// Bazy danych (klucz → wartość). Zmiany z gry trwają do jej zamknięcia — restart poziomu ich nie cofa.', 'const DB = {');
    dbs.forEach((db) => {
      const type = db.db.valueType;
      const literal = (v) => (geTypeRef(type) ? geDataLiteral(v, type) : geLiteral(geValueFits(v, type) ? v : geVarDefault(type), { type }));
      const entries = db.db.entries.map((e) => `[${JSON.stringify(String(e.key))}, ${literal(e.value)}]`).join(', ');
      lines.push(`  ${db.id}: new Map([${entries}]), // ${db.name.replace(/\n/g, ' ')}`);
    });
    lines.push('};');
  }
  geTsClasses(project).forEach(({ bp, name }) => {
    const title = `// Klasa TypeScript: ${bp.name.replace(/\n/g, ' ')}`;
    // Granie w edytorze: kod klasy jako osobny skrypt (eval) z mapą źródeł — breakpointy z VS Code trafiają w plik .ts.
    if (debug && !ts && bp.ts.map) {
      lines.push('', title, `const ${name} = eval(${JSON.stringify(`${bp.ts.js}\n;${name}\n//# sourceMappingURL=${bp.ts.map}`)});`);
      return;
    }
    const code = ts ? bp.ts.source.trim().replace(/^export\s+(default\s+)?/gm, '') : bp.ts.js.trim();
    lines.push('', title, `const ${name} = (() => {`, geIndent(code), `  return ${name};`, '})();');
  });
  return lines.join('\n').replace(/<\//g, '<\\/');
}

// ---------- TypeScript: typy, kompilacja, VS Code ----------

// Typ z TypeScriptu („number”, „Punkt | null”…) jako typ pinu; „none” — brak wyniku, null — nie da się.
function geTsPinType(text) {
  const t = String(text ?? '').replace(/\s+/g, '').replace(/\|(null|undefined)$/, '');
  if (t === 'void' || t === 'undefined') return 'none';
  if (GE_TS_PINS[t]) return GE_TS_PINS[t];
  const project = geProj();
  const data = project?.blueprints.find((b) => (geKind(b) === 'struct' || geKind(b) === 'enum') && GE_RT.ident(b.name) === t);
  if (data) return geKind(data) + ':' + data.id;
  const cls = project?.blueprints.find((b) => geKind(b) === 'tsclass' && b.ts.api?.className === t);
  return cls ? 'ts:' + cls.id : null;
}

function geTsTypeName(type) {
  if (GE_TS_TYPES[type]) return GE_TS_TYPES[type];
  const c = geContainer(type);
  if (c.container === 'array') return `(${geTsTypeName(c.elem)})[]`;
  if (c.container === 'set') return `Set<${geTsTypeName(c.elem)}>`;
  if (c.container === 'map') return `Map<${geTsTypeName(c.elem)}, ${geTsTypeName(c.value)}>`;
  const ref = geTypeRef(type);
  if (!ref?.bp) return 'any';
  if (ref.prefix === 'enum') return ref.bp.enum.entries.map((e) => JSON.stringify(e.name)).join(' | ') || 'string';
  return ref.prefix === 'struct' ? GE_RT.ident(ref.bp.name) : `${ref.bp.ts.api?.className ?? 'any'} | null`;
}

// jsgame.d.ts obok plików .ts: silnik i Struktury z projektu, żeby VS Code podpowiadał i sprawdzał typy.
function geTsDecl(project) {
  const structs = project.blueprints.filter((b) => geKind(b) === 'struct').map((s) => `/** Struktura ${s.name} z Przeglądarki zawartości. */
interface ${GE_RT.ident(s.name)} {
${s.struct.fields.map((f) => `  ${geFieldKey(f)}: ${geTsTypeName(f.type)};`).join('\n')}
}`);
  const enums = project.blueprints.filter((b) => geKind(b) === 'enum').map((e) => `/** Enumeracja ${e.name} z Przeglądarki zawartości (wartość to nazwa wpisu). */
type ${GE_RT.ident(e.name)} = ${geTsTypeName('enum:' + e.id)};`);
  return `// Wygenerowane przez JSGame Engine — nie edytuj (odświeża się przy każdym otwarciu klasy).
// Klasy TypeScript widzą się nawzajem bez import / export, a w grze mają dostęp do G, vec i Actor.
// Węzły w Blueprintach dostają publiczne metody, których parametry i wynik mają typy:
// number, string, boolean, Vec, Actor, Struktura i Enumeracja (niżej) albo inna klasa TypeScript.

interface Vec { x: number; y: number; }
/** Wektor 2D. */
declare function vec(x?: number, y?: number): Vec;
/** Aktor na poziomie (klasa bazowa Blueprintów). */
declare class Actor {
  /** game — G; data — ustawienia aktora (name, className, x, y, shape, color, w, h…). */
  constructor(game: Game, data?: Partial<ActorData>);
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  dead: boolean;
  vars: Record<string, any>;
  destroy(): void;
  [key: string]: any;
}
/** Widget na ekranie (klasa bazowa Widget Blueprintów). */
declare class Widget extends Actor {}
/** Anim Instance — klasa bazowa Animation Blueprintów (owner — aktor, którego animuje). */
declare class AnimInstance extends Actor {
  owner: Actor | null;
  tryGetPawnOwner(): Actor | null;
}
/** Gra: punkty, wiadomości, dźwięki, klawisze, tworzenie aktorów… (to samo, co w kodzie Blueprintów). */
interface Game { [key: string]: any; }
declare const G: Game;
/** Dane instancji z poziomu (zmienne Instance Editable w vars). */
interface ActorData { vars: Record<string, any>; [key: string]: any; }

// ---------- Dekoratory jak w Unreal Engine: co widać w Blueprintach ----------
/** Metadane dekoratora: Category — grupa w menu i w Szczegółach, DisplayName — nazwa w Blueprintach, ToolTip — podpowiedź. */
interface UMeta { Category?: string; DisplayName?: string; ToolTip?: string; }
type UClassSpecifier = 'Blueprintable' | 'NotBlueprintable';
type UPropertySpecifier = 'EditAnywhere' | 'EditDefaultsOnly' | 'EditInstanceOnly' | 'VisibleAnywhere' | 'VisibleDefaultsOnly' | 'VisibleInstanceOnly' | 'BlueprintReadWrite' | 'BlueprintReadOnly';
type UFunctionSpecifier = 'BlueprintCallable' | 'BlueprintPure' | 'BlueprintImplementableEvent' | 'BlueprintNativeEvent';
/** Klasa może być klasą nadrzędną Blueprintu (Klasa nadrzędna na pasku klasy Blueprint). Musi dziedziczyć po Actor. */
declare function UCLASS(...specifiers: (UClassSpecifier | UMeta)[]): (target: any, context?: any) => void;
/** Pole widoczne w Blueprintach: Get / Set (BlueprintReadOnly / ReadWrite), edycja w Ustawieniach klasy i Szczegółach aktora (Edit…). */
declare function UPROPERTY(...specifiers: (UPropertySpecifier | UMeta)[]): (target: any, context?: any) => void;
/** Metoda widoczna w Blueprintach: węzeł (BlueprintCallable / Pure) albo zdarzenie, które Blueprint nadpisuje (…Event). */
declare function UFUNCTION(...specifiers: (UFunctionSpecifier | UMeta)[]): (target: any, context?: any) => void;
/** Klasa może być klasą nadrzędną Blueprintu. */
declare const Blueprintable: 'Blueprintable';
/** Klasa nie może być klasą nadrzędną Blueprintu. */
declare const NotBlueprintable: 'NotBlueprintable';
/** Wartość zmienisz w Ustawieniach klasy Blueprint i w Szczegółach każdego aktora na poziomie. */
declare const EditAnywhere: 'EditAnywhere';
/** Wartość zmienisz tylko w Ustawieniach klasy Blueprint. */
declare const EditDefaultsOnly: 'EditDefaultsOnly';
/** Wartość zmienisz tylko w Szczegółach aktora na poziomie. */
declare const EditInstanceOnly: 'EditInstanceOnly';
/** Wartość widać (bez zmiany) w Ustawieniach klasy Blueprint. */
declare const VisibleAnywhere: 'VisibleAnywhere';
declare const VisibleDefaultsOnly: 'VisibleDefaultsOnly';
declare const VisibleInstanceOnly: 'VisibleInstanceOnly';
/** Węzły Get i Set pola. */
declare const BlueprintReadWrite: 'BlueprintReadWrite';
/** Tylko węzeł Get pola. */
declare const BlueprintReadOnly: 'BlueprintReadOnly';
/** Węzeł z białymi pinami, który wywołuje metodę. */
declare const BlueprintCallable: 'BlueprintCallable';
/** Czysty węzeł (bez białych pinów) — metoda tylko liczy wynik. */
declare const BlueprintPure: 'BlueprintPure';
/** Zdarzenie do zrobienia w Blueprincie: kod TypeScript wywołuje metodę, a jej treść daje klasa Blueprint. */
declare const BlueprintImplementableEvent: 'BlueprintImplementableEvent';
/** Jak BlueprintImplementableEvent, ale metoda ma treść w TypeScripcie; Blueprint może ją zastąpić (Call Parent Event ją uruchamia). */
declare const BlueprintNativeEvent: 'BlueprintNativeEvent';

${[...structs, ...enums].join('\n\n')}
`;
}

function geTsTemplate(name) {
  return `// Klasa TypeScript w grze — aktor (dziedziczy po Actor). Zapisz plik (Ctrl+S) — JSGame Engine sam go skompiluje.
// Publiczne metody z typami (number, string, boolean, Vec, Actor, Struktura, inna klasa TS)
// pojawią się w Blueprintach: prawy przycisk na grafie › TypeScript. Silnik: G, vec, Actor.
// Obiekt z węzła „Construct” trafia na poziom: silnik wywoła beginPlay(), a potem tick(dt) w każdej klatce.
class ${name} extends Actor {
  licznik = 0;

  constructor(x: number, y: number) {
    super(G, { name: '${name}', className: '${name}', x, y });
    G.addActor(this);
  }

  beginPlay(): void {
    this.licznik = 0;
  }

  tick(dt: number): void {
    this.licznik += dt;
  }
}
`;
}

// Klasa nadrzędna Blueprintów, jak klasa C++ z UCLASS w Unreal Engine: dekoratory wybierają, co widać w Blueprintach.
function geTsUclassTemplate(name) {
  return `// Klasa nadrzędna Blueprintów (jak klasa C++ w Unreal Engine). Zapisz plik (Ctrl+S) — JSGame Engine sam go skompiluje.
// Utwórz z niej klasę Blueprint: prawy przycisk na kafelku › Utwórz klasę Blueprint (albo Klasa nadrzędna na pasku Blueprintu).
// Dekoratory mówią, co Blueprint widzi — bez nich pole albo metoda zostaje tylko w kodzie:
//   @UPROPERTY(EditAnywhere | EditDefaultsOnly | EditInstanceOnly | VisibleAnywhere, BlueprintReadWrite | BlueprintReadOnly, { Category, DisplayName, ToolTip })
//   @UFUNCTION(BlueprintCallable | BlueprintPure | BlueprintImplementableEvent | BlueprintNativeEvent, { Category, DisplayName })
// Aktora tworzy silnik (Spawn Actor albo poziom), więc klasa nie ma własnego konstruktora — albo ma (game: Game, data: ActorData).
@UCLASS(Blueprintable)
class ${name} extends Actor {
  @UPROPERTY(EditAnywhere, BlueprintReadWrite, { Category: 'Ruch', ToolTip: 'Piksele na sekundę' })
  predkosc = 200;

  @UPROPERTY(VisibleAnywhere, BlueprintReadOnly, { Category: 'Ruch' })
  przebytaDroga = 0;

  // Bez dekoratora — Blueprint tego pola nie widzi.
  kierunek = 1;

  @UFUNCTION(BlueprintCallable, { Category: 'Ruch' })
  zawroc(): void {
    this.kierunek = -this.kierunek;
    this.naZawrocie(this.kierunek);
  }

  @UFUNCTION(BlueprintPure, { Category: 'Ruch' })
  czyWPrawo(): boolean {
    return this.kierunek > 0;
  }

  // Treść tego zdarzenia daje klasa Blueprint (węzeł „Event naZawrocie”).
  @UFUNCTION(BlueprintImplementableEvent)
  naZawrocie(kierunek: number): void {}

  // Zdarzenia aktora: Blueprint może je zastąpić, a „Call Parent Event” uruchomi tę wersję.
  tick(dt: number): void {
    this.x += this.predkosc * this.kierunek * dt;
    this.przebytaDroga += this.predkosc * dt;
  }
}
`;
}

const geTsNative = () => (typeof window !== 'undefined' ? window.jsgameNative?.ts ?? null : null);
const geTsFileInfo = (bp) => ({ id: bp.id, name: GE_RT.ident(bp.name), project: ge.project.name, dir: ge.projectDir, source: bp.ts.source, decl: geTsDecl(ge.project) });

// Nowy wynik kompilacji: zmienia się API klasy, więc wszystkie Blueprinty trzeba przekompilować.
function geTsSetResult(bp, source, result) {
  bp.ts = { source, js: result.js ?? '', api: result.api ?? null, errors: result.errors ?? [], map: result.map ?? '' };
  ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
}

const geTsRefreshParts = (bp) => (ge.tab === bp.id ? ['details', 'drawer'] : ['drawer', 'graph', 'details', 'code']);

async function geTsCompile(bp) {
  const native = geTsNative();
  const source = bp.ts.source;
  if (!native) {
    Object.assign(bp.ts, { js: '', errors: ['TypeScript kompiluje się tylko w aplikacji desktopowej JSGame Engine.'] });
    geRefresh(geTsRefreshParts(bp));
    return;
  }
  const result = await native.compile(source, GE_RT.ident(bp.name), { project: ge.project.name, dir: ge.projectDir });
  // W międzyczasie mogła przyjść nowsza treść (VS Code, kolejna zmiana w karcie).
  if (!ge || geBp(bp.id) !== bp || bp.ts.source !== source) return;
  geTsSetResult(bp, source, result);
  ge.preview = null;
  geScheduleSave();
  geRefresh(geTsRefreshParts(bp));
  geTsReport(bp);
}

function geTsReport(bp, from = '') {
  const api = bp.ts.api;
  if (bp.ts.errors.length) geLog(`🔷 ${bp.name}${from}: ${bp.ts.errors.length} błędów kompilacji — ${bp.ts.errors[0]}`, 'error');
  else geLog(`🔷 ${bp.name}${from}: skompilowano klasę ${api?.className} (${api?.methods.length ?? 0} metod).`);
}

async function geTsOpen(bp) {
  const native = geTsNative();
  if (!native) {
    geLog('VS Code otworzysz tylko z aplikacji desktopowej JSGame Engine — tutaj edytuj klasę w jej karcie.', 'warn');
    return;
  }
  const res = await native.open(geTsFileInfo(bp));
  if (!ge) return;
  ge.tsFiles = { ...ge.tsFiles, [bp.id]: res.file };
  if (!res.ok) geLog(`Nie udało się otworzyć ${bp.name}: ${res.error}`, 'error');
  else if (res.editor === 'vscode') geLog(`🔷 ${bp.name} otwarta w VS Code: ${res.file}. Zapisz plik, a edytor sam go skompiluje.`);
  else geLog(`Nie znaleziono VS Code (polecenie „code”) — ${bp.name} otwarta w domyślnym programie: ${res.file}.`, 'warn');
  if (ge.tab === bp.id) geRenderAssetPage();
}

// Zapis pliku w VS Code (ts-host.js obserwuje otwarte pliki i przysyła treść z wynikiem kompilacji).
geTsNative()?.onChanged(({ id, source, result }) => {
  const bp = ge && geAsset(ge.project, id, 'tsclass');
  if (!bp || bp.ts.source === source) return;
  geChange(() => geTsSetResult(bp, source, result), { only: geTsRefreshParts(bp) });
  geTsReport(bp, ' (zapis w VS Code)');
});

// Zadanie „JSGame: Kompiluj i odśwież” z VS Code: klasy prosto z plików .ts, potem gra od nowa.
// Z debugerem (debug) gra startuje chwilę później, żeby VS Code zdążył się podłączyć i ustawić breakpointy.
geTsNative()?.onRefresh(async ({ id, dir, debug }) => {
  const native = geTsNative();
  if (!ge) {
    native.refreshed(id, false, 'Najpierw otwórz projekt w edytorze.');
    return;
  }
  const classes = ge.project.blueprints.filter((b) => geKind(b) === 'tsclass');
  const res = await native.reload({ request: { dir }, project: ge.project.name, dir: ge.projectDir, classes: classes.map(geTsFileInfo) });
  if (!ge) return;
  if (!res.ok) {
    native.refreshed(id, false, res.error);
    return;
  }
  const changed = res.classes.map(({ id: bpId, source, result }) => ({ bp: geAsset(ge.project, bpId, 'tsclass'), source, result }))
    .filter(({ bp, source, result }) => bp && (bp.ts.source !== source || bp.ts.js !== result.js || bp.ts.map !== result.map));
  if (changed.length) geChange(() => changed.forEach(({ bp, source, result }) => geTsSetResult(bp, source, result)), { only: ['drawer', 'graph', 'details', 'code'] });
  changed.forEach(({ bp }) => geTsReport(bp, ' (VS Code: Kompiluj i odśwież)'));
  const broken = classes.filter((b) => b.ts.errors.length);
  if (broken.length) {
    native.refreshed(id, false, `${broken[0].name}: ${broken[0].ts.errors[0]}`);
    return;
  }
  geStopPlay();
  setTimeout(() => {
    if (!ge) return;
    gePlay();
    native.refreshed(id, !!ge.playing, ge.playing ? `gra uruchomiona od nowa (${classes.length} klas TypeScript).` : 'gra nie wystartowała — szczegóły w Dzienniku wiadomości edytora.');
  }, debug ? 1500 : 0);
});

// ---------- Projekt: dane zasobów, tworzenie, otwieranie ----------

// Wypełnia brakujące dane zasobu (nowy albo wczytany z pliku); inne rodzaje zostawia w spokoju.
function geDataAssetDefaults(bp) {
  const kind = bp.kind;
  if (kind === 'struct') bp.struct = { fields: Array.isArray(bp.struct?.fields) ? bp.struct.fields.filter((f) => f && f.id) : [] };
  // Nowa Enumeracja dostaje dwie wartości (NewEnumerator0, NewEnumerator1).
  if (kind === 'enum') {
    bp.enum = { entries: Array.isArray(bp.enum?.entries)
      ? bp.enum.entries.filter((e) => e && e.id).map((e) => ({ id: e.id, name: String(e.name || e.id), desc: String(e.desc ?? '') }))
      : [0, 1].map((i) => ({ id: 'e' + (i + 1), name: 'NewEnumerator' + i, desc: '' })) };
  }
  if (kind === 'database') bp.db = { valueType: bp.db?.valueType || 'string', entries: Array.isArray(bp.db?.entries) ? bp.db.entries.filter((e) => e && e.id) : [] };
  if (kind === 'tsclass') {
    const t = bp.ts ?? {};
    bp.ts = { source: typeof t.source === 'string' ? t.source : geTsTemplate(GE_RT.ident(bp.name)), js: String(t.js ?? ''), api: t.api ?? null, errors: Array.isArray(t.errors) ? t.errors : [], map: String(t.map ?? '') };
  }
  if (bp.tsDefaults !== undefined && (!bp.tsDefaults || typeof bp.tsDefaults !== 'object' || Array.isArray(bp.tsDefaults))) delete bp.tsDefaults;
  const ids = [...(bp.struct?.fields ?? []), ...(bp.enum?.entries ?? []), ...(bp.db?.entries ?? [])].map((x) => Number(String(x.id).slice(1)) || 0);
  if (ids.length) bp.nextVar = Math.max(Number(bp.nextVar) || 1, ...ids.map((n) => n + 1));
}

const GE_DATA_NEW_ASSET = {
  struct: {
    title: 'Nowa Struktura', name: 'F_NowaStruktura',
    text: 'Struktura to <b>własny typ zmiennej</b> złożony z pól (np. Przedmiot: Nazwa, Cena, Ikona). Będzie do wyboru jako typ zmiennej, pola innej Struktury i wartości Bazy danych. Podaj nazwę (zwyczajowo z przedrostkiem F_).',
    done: 'Dodaj w niej pola, a potem wybierz ją jako typ zmiennej (Mój Blueprint › Zmienne).'
  },
  enum: {
    title: 'Nowa Enumeracja', name: 'E_NowaEnumeracja',
    text: 'Enumeracja (Enum) to <b>lista nazwanych wartości</b>, z której zmienna ma zawsze jedną (np. Stan: Stoi, Biegnie, Skacze). Będzie do wyboru jako typ zmiennej, pola Struktury i wartości Bazy danych. Podaj nazwę (zwyczajowo z przedrostkiem E_).',
    done: 'Dodaj w niej wartości, a potem wybierz ją jako typ zmiennej. W grafie: prawy przycisk › Dane › Switch on…'
  },
  database: {
    title: 'Nowa Baza danych', name: 'DB_NowaBaza',
    text: 'Baza danych to tabela <b>klucz → wartość</b> (np. nazwa poziomu → najlepszy wynik). Wartości mogą być liczbami, tekstem albo Strukturą. Podaj nazwę (zwyczajowo z przedrostkiem DB_).',
    done: 'Wybierz typ wartości i dodaj wpisy. W grafie: prawy przycisk › Dane › Find / Add.'
  },
  tsclass: {
    title: 'Nowa klasa TypeScript', name: 'MojaKlasa',
    text: 'Klasa TypeScript to kod pisany ręcznie w <b>Visual Studio Code</b>. <b>Klasa nadrzędna Blueprintów</b> (jak klasa C++ w Unreal Engine) pokazuje Blueprintom pola i metody z dekoratorami <code>@UPROPERTY</code> i <code>@UFUNCTION</code>, a klasy Blueprint mogą po niej dziedziczyć. <b>Zwykła klasa</b> to obiekt z węzła Construct — jej publiczne metody są węzłami. Nazwa pliku i klasy (litery, cyfry i _).',
    done: 'Kliknij dwukrotnie, żeby otworzyć ją w VS Code.',
    // Szablon pliku do wyboru w oknie tworzenia klasy.
    select: { label: 'Rodzaj klasy', value: 'uclass', options: [['uclass', 'Klasa nadrzędna Blueprintów (@UCLASS)'], ['object', 'Zwykła klasa (węzeł Construct)']] }
  }
};

// Treść nowej klasy TypeScript wybrana w oknie tworzenia (select z GE_DATA_NEW_ASSET.tsclass).
function geTsApplyTemplate(bp, choice) {
  if (choice === 'uclass') bp.ts.source = geTsUclassTemplate(GE_RT.ident(bp.name));
}

// Po utworzeniu: klasa TypeScript od razu się kompiluje, żeby jej węzły były w menu.
function geDataCreated(bp) {
  if (geKind(bp) === 'tsclass') geTsCompile(bp);
}

// ---------- Import pliku JSON jako Bazy danych ----------

// Wpisy [klucz, wartość] z pliku JSON: obiekt { klucz: wartość }, lista par [klucz, wartość],
// lista { key, value } albo lista obiektów (klucz z pola id / key / name, a bez nich — numer).
function geJsonEntries(data) {
  if (Array.isArray(data)) {
    return data.map((item, i) => {
      if (Array.isArray(item) && item.length === 2 && typeof item[0] !== 'object') return item;
      if (item && typeof item === 'object' && !Array.isArray(item)) {
        if ('key' in item && 'value' in item && Object.keys(item).length === 2) return [item.key, item.value];
        const key = ['id', 'key', 'name'].map((k) => item[k]).find((v) => v != null && typeof v !== 'object');
        if (key != null) return [key, item];
      }
      return [i, item];
    });
  }
  return data && typeof data === 'object' ? Object.entries(data) : [];
}

// Typ zmiennej pasujący do wszystkich wartości; „object” — obiekty z polami (staną się Strukturą).
function geJsonType(values) {
  const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
  if (!values.length) return 'string';
  if (values.every((v) => typeof v === 'boolean')) return 'bool';
  if (values.every((v) => typeof v === 'number' && Number.isFinite(v))) return values.every(Number.isInteger) ? 'int' : 'float';
  if (values.every((v) => isObj(v) && Object.keys(v).length === 2 && Number.isFinite(v.x) && Number.isFinite(v.y))) return 'vector';
  if (values.every(isObj)) return 'object';
  return 'string';
}

// Wartość z JSON-a w typie wpisu: pola Struktury po nazwie, a tablice i obiekty w polach tekstowych jako tekst JSON.
function geJsonValue(value, type, struct = null) {
  if (value == null) return geVarDefault(type);
  if (struct) return Object.fromEntries(struct.struct.fields.filter((f) => value[f.name] != null).map((f) => [f.id, geJsonValue(value[f.name], f.type)]));
  if (type === 'string') return typeof value === 'string' ? value : JSON.stringify(value);
  if (type === 'vector') return { x: value.x, y: value.y };
  return value;
}

// Plik JSON → nowa Baza danych (DB_nazwa). Typ wartości zgadujemy z wpisów; obiekty z polami
// dostają nową Strukturę (F_nazwa) z polami o typach zgadniętych tak samo.
function geImportDatabaseJson(fileName, data, folder = ge.cbFolder) {
  const entries = geJsonEntries(data);
  if (!entries.length) {
    geLog(`Pominięto ${fileName}: plik JSON nie ma wpisów klucz → wartość (potrzebny obiekt { "klucz": wartość } albo lista).`, 'warn');
    return;
  }
  const base = GE_RT.ident(fileName.replace(/\.json$/i, '')) || 'Baza';
  const values = entries.map(([, v]) => v).filter((v) => v != null);
  let type = geJsonType(values);
  let db;
  let struct = null;
  geChange(() => {
    const names = () => ge.project.blueprints.map((b) => b.name);
    if (type === 'object') {
      struct = geAddBlueprint(ge.project, geUniqueName(`F_${base}`, names()), {}, 'struct');
      struct.folder = folder;
      struct.struct.fields = [...new Set(values.flatMap((v) => Object.keys(v)))].map((name) => {
        const t = geJsonType(values.map((v) => v[name]).filter((v) => v != null));
        const ft = t === 'object' ? 'string' : t;
        return { id: 'f' + struct.nextVar++, name, type: ft, value: geVarDefault(ft) };
      });
      type = 'struct:' + struct.id;
    }
    db = geAddBlueprint(ge.project, geUniqueName(`DB_${base}`, names()), {}, 'database');
    db.folder = folder;
    db.db.valueType = type;
    const keys = [];
    db.db.entries = entries.map(([key, value]) => {
      keys.push(geUniqueName(String(key) || 'klucz', keys));
      return { id: 'e' + db.nextVar++, key: keys.at(-1), value: geJsonValue(value, type, struct) };
    });
    ge.selTile = db.id;
  }, { only: ['drawer'] });
  geLog(`🗄 Zaimportowano ${fileName} jako Bazę danych ${db.name}: ${entries.length} wpisów, typ wartości ${geType(type).label}${struct ? ` (nowa Struktura z ${struct.struct.fields.length} polami)` : ''}. W grafie: prawy przycisk › Dane › Find / Add.`);
}

// Dwuklik na kafelku: klasa TypeScript otwiera się w VS Code zamiast karty w edytorze.
// Zwraca true, gdy zasób otworzył się poza edytorem; karta zostaje tylko w wersji przeglądarkowej.
function geDataOpened(id) {
  const bp = geAsset(ge.project, id, 'tsclass');
  if (!bp || !geTsNative()) return false;
  geTsOpen(bp);
  return true;
}

// Kto korzysta z zasobu danych: zmienne, pola Struktur, Bazy danych i węzły.
function geDataUsers(bp) {
  const kind = geKind(bp);
  const type = (kind === 'tsclass' ? 'ts' : kind) + ':' + bp.id;
  const nodeUses = (n) => n.props?.struct === bp.id || n.props?.enum === bp.id || n.props?.db === bp.id || n.props?.cls === bp.id || [n.props?.fn, n.props?.prop].some((ref) => String(ref ?? '').startsWith(bp.id + ':'));
  const uses = (t) => [geContainer(t).elem, geContainer(t).value].includes(type);
  return geAllBlueprints(ge.project).filter((b) => b !== bp && (
    b.parent === bp.id
    || (b.variables ?? []).some((v) => uses(v.type))
    || (b.struct?.fields ?? []).some((f) => uses(f.type))
    || uses(b.db?.valueType)
    || (b.graph ? geGraphs(b) : []).some((g) => g.nodes.some(nodeUses))));
}

// ---------- Karty zasobów ----------

const GE_DATA_VIEW_TITLE = { struct: 'Pola struktury', enum: 'Wartości enumeracji', database: 'Wpisy bazy danych', tsclass: 'Kod TypeScript' };

function geDataToolbar(kind) {
  const sep = '<span class="ge-sep"></span>';
  return {
    struct: `${sep}<button type="button" data-ge="struct-add"><span class="ge-ic ge-ic-green">＋</span>Dodaj pole</button>`,
    enum: `${sep}<button type="button" data-ge="enum-add"><span class="ge-ic ge-ic-green">＋</span>Dodaj wartość</button>`,
    database: `${sep}<button type="button" data-ge="db-add"><span class="ge-ic ge-ic-green">＋</span>Dodaj wpis</button>`,
    tsclass: `${sep}<button type="button" data-ge="ts-compile" title="Skompiluj jeszcze raz (zapis pliku w VS Code kompiluje sam)"><span class="ge-ic">⟳</span>Kompiluj</button>`
  }[kind] ?? '';
}

const geUserRow = (b) => `<button type="button" class="ge-row" data-ge="open-bp" data-id="${geTabFor(b.id)}"><span class="ge-row-name">${geKindIcon(b)} ${geEsc(b.name)}</span><span class="ge-row-type">otwórz</span></button>`;
const geUsedByCat = (bp) => geCat('Używana przez', geDataUsers(bp).map(geUserRow).join('') || '<p class="ge-hint">Nic jej jeszcze nie używa.</p>');
const geTypeOptions = (types) => types.map((t) => [t, geType(t).label]);

// Pole nie może mieć typu tej Struktury ani takiej, która ją zawiera (struktura bez końca) — też jako element kontenera.
const geStructFieldExcept = (bp) => (t) => t === 'struct:' + bp.id || (geTypeRef(t)?.prefix === 'struct' && geStructUses(geTypeRef(t).bp, bp.id));

// Typ pola składa się jak typ zmiennej: typ elementu, kontener (Single / Array / Set / Map) i typ wartości Map.
function geSetFieldType(bp, id, which, value) {
  const f = bp.struct.fields.find((x) => x.id === id);
  const type = f && geRetype(f.type, which, value);
  if (!f || type === f.type) return;
  geChange(() => {
    f.type = type;
    f.value = geVarDefault(type);
    ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
  }, { only: ['details'] });
}

function geStructPage(bp, view, details) {
  const own = 'struct:' + bp.id;
  view.innerHTML = `<div class="ge-data-table ge-struct-table">
      <div class="ge-data-head"><span>Pole</span><span>Typ</span><span>Wartość domyślna</span><span></span></div>
      ${bp.struct.fields.map((f) => {
        const extra = `data-id="${f.id}"`;
        const c = geContainer(f.type);
        const value = c.container !== 'single' ? geVarContainerInput('struct-field', 'value', f.type, f.value, extra, extra, f.name)
          : geTypeRef(f.type) ? geDataValueInput('struct-field', 'value', f.type, f.value, extra) : geVarInput('struct-field', 'value', f.type, geValueFits(f.value, f.type) ? f.value : geVarDefault(f.type), extra);
        return `<div class="ge-data-row" style="--pc:${geType(f.type).color}">
          <span class="ge-data-name"><span class="ge-pill"></span>${geText('struct-field', 'name', f.name, `${extra} aria-label="Nazwa pola"`)}</span>
          <div class="ge-field-type">${geContTypeRow('struct', f.id, f.type)}${c.container === 'map' ? `<span class="ge-var-type" title="Typ wartości">${geTypeBtn('struct-vtype-pick', f.id, c.value, geType(c.value).label)}</span>` : ''}</div>
          <div class="ge-data-value">${value}</div>
          <button type="button" class="ge-mini" data-ge="struct-del" data-id="${f.id}" aria-label="Usuń pole ${geEsc(f.name)}">Usuń</button>
        </div>`;
      }).join('') || '<p class="ge-empty">Brak pól — kliknij „＋ Dodaj pole”.</p>'}
    </div>`;
  details.innerHTML = `<p class="ge-det-note"><b>Struktura</b> to własny typ zmiennej złożony z pól — jedna zmienna trzyma kilka wartości naraz (np. Przedmiot: Nazwa, Cena, Ilość).</p>
    ${geCat('Jak używać', `<ol class="ge-steps">
      <li>Dodaj pola i ich wartości domyślne. Przycisk obok typu zmienia kontener: pojedyncza wartość, Tablica (Array), Zbiór (Set) albo Mapa (Map).</li>
      <li>W Blueprincie: Mój Blueprint › Zmienne › Typ — <b>Struktura ${geEsc(bp.name)}</b>.</li>
      <li>W grafie: <i>Make ${geEsc(bp.name)}</i> składa wartość, <i>Break ${geEsc(bp.name)}</i> wyciąga pola.</li>
      <li>Może być też typem wartości w Bazie danych i typem w klasach TypeScript (interfejs <code>${geEsc(GE_RT.ident(bp.name))}</code>).</li></ol>`)}
    ${geCat('W kodzie', `<pre class="ge-data-code">${geEsc(geDataLiteral({}, own))}</pre>`)}
    ${geUsedByCat(bp)}`;
}

// Karta Enumeracji jak edytor UEnum: wartości po kolei (Display Name, Description), strzałki zmieniają kolejność.
function geEnumPage(bp, view, details) {
  const list = bp.enum.entries;
  view.innerHTML = `<div class="ge-data-table ge-enum-table">
      <div class="ge-data-head"><span>Nr</span><span>Nazwa (Display Name)</span><span>Opis (Description)</span><span></span></div>
      ${list.map((e, i) => {
        const extra = `data-id="${e.id}"`;
        return `<div class="ge-data-row" style="--pc:${GE_KINDS.enum.color}">
          <span class="ge-enum-index">${i}</span>
          <span class="ge-data-name"><span class="ge-pill"></span>${geText('enum-entry', 'name', e.name, `${extra} aria-label="Nazwa wartości"`)}</span>
          <div class="ge-data-value">${geText('enum-entry', 'desc', e.desc, `${extra} aria-label="Opis wartości ${geEsc(e.name)}"`)}</div>
          <span class="ge-enum-btns">
            <button type="button" class="ge-mini" data-ge="enum-up" data-id="${e.id}"${i ? '' : ' disabled'} aria-label="Przesuń ${geEsc(e.name)} wyżej">↑</button>
            <button type="button" class="ge-mini" data-ge="enum-down" data-id="${e.id}"${i < list.length - 1 ? '' : ' disabled'} aria-label="Przesuń ${geEsc(e.name)} niżej">↓</button>
            <button type="button" class="ge-mini" data-ge="enum-del" data-id="${e.id}" aria-label="Usuń wartość ${geEsc(e.name)}">Usuń</button>
          </span>
        </div>`;
      }).join('') || '<p class="ge-empty">Brak wartości — kliknij „＋ Dodaj wartość”.</p>'}
    </div>`;
  details.innerHTML = `<p class="ge-det-note"><b>Enumeracja</b> (Enum) to lista nazwanych wartości — zmienna tego typu ma zawsze jedną z nich (np. Stan postaci: Stoi, Biegnie, Skacze). Zamiast pamiętać, co znaczy liczba 2, wybierasz wartość z listy.</p>
    ${geCat('Jak używać', `<ol class="ge-steps">
      <li>Dodaj wartości i ustaw ich kolejność (numer od 0 to Byte, jak w Unreal Engine).</li>
      <li>W Blueprincie: Mój Blueprint › Zmienne › Typ — <b>Enumeracja ${geEsc(bp.name)}</b>.</li>
      <li>W grafie: <i>Switch on ${geEsc(bp.name)}</i> — osobne wyjście dla każdej wartości, <i>==</i> / <i>!=</i> porównują, <i>ForEach</i> przechodzi po wszystkich, <i>Byte to Enum</i> zamienia numer na wartość.</li>
      <li>Wartość podłączona do pinu tekstu (String) daje nazwę, a do pinu Integer — numer.</li>
      <li>Może być też typem pola Struktury, wartości w Bazie danych i typem w klasach TypeScript (<code>${geEsc(GE_RT.ident(bp.name))}</code>).</li></ol>`)}
    ${geCat('W kodzie', `<pre class="ge-data-code">${geEsc(`ENUM.${bp.id} = [${list.map((e) => JSON.stringify(e.name)).join(', ')}]\n// wartość w kodzie to nazwa, np. ${JSON.stringify(list[0]?.name ?? '')}`)}</pre>`)}
    ${geUsedByCat(bp)}`;
}

function geDatabasePage(bp, view, details) {
  const type = bp.db.valueType;
  const types = geTypeOptions(geVarTypes(ge.project, (t) => t === 'actor' || geTypeRef(t)?.prefix === 'ts'));
  view.innerHTML = `<div class="ge-data-table ge-db-table">
      <div class="ge-data-head"><span>Klucz</span><span>Wartość · ${geEsc(geType(type).label)}</span><span></span></div>
      ${bp.db.entries.map((e) => {
        const extra = `data-id="${e.id}"`;
        const value = geTypeRef(type) ? geDataValueInput('db-entry', 'value', type, e.value, extra) : geVarInput('db-entry', 'value', type, geValueFits(e.value, type) ? e.value : geVarDefault(type), extra);
        return `<div class="ge-data-row" style="--pc:${geType(type).color}">
          <span class="ge-data-name"><span class="ge-pill"></span>${geText('db-entry', 'key', e.key, `${extra} aria-label="Klucz"`)}</span>
          <div class="ge-data-value">${value}</div>
          <button type="button" class="ge-mini" data-ge="db-del" data-id="${e.id}" aria-label="Usuń wpis ${geEsc(e.key)}">Usuń</button>
        </div>`;
      }).join('') || '<p class="ge-empty">Baza jest pusta — kliknij „＋ Dodaj wpis”.</p>'}
    </div>`;
  details.innerHTML = `<p class="ge-det-note"><b>Baza danych</b> to tabela <b>klucz → wartość</b>: pod tekstowym kluczem (np. <i>miecz</i>) leży wartość wybranego typu. Gra zaczyna z wpisami z tej tabeli, a węzły mogą je czytać i zmieniać.</p>
    ${geCat('Baza', geRow('Typ wartości', geSelect('db', 'valueType', type, types), 'Wszystkie wpisy mają ten sam typ. Zmiana typu ustawia wartości domyślne.')
      + geRow('Wpisy', `<span class="ge-muted">${bp.db.entries.length}</span>`))}
    ${geCat('Jak używać', `<ol class="ge-steps">
      <li><i>Find (${geEsc(bp.name)})</i> — wartość pod kluczem i czy klucz istnieje (Found).</li>
      <li><i>Add</i> zapisuje albo nadpisuje, <i>Remove</i> usuwa, <i>Length</i> liczy wpisy.</li>
      <li>Zmiany z gry trwają do jej zamknięcia — restart poziomu ich nie cofa.</li></ol>`)}
    ${geUsedByCat(bp)}`;
}

function geTsPage(bp, view, details) {
  const t = bp.ts;
  const api = t.api;
  const native = geTsNative();
  const file = ge.tsFiles?.[bp.id];
  const status = t.errors.length
    ? `<span class="ge-ts-status is-error">✖ ${t.errors.length} błędów</span>`
    : api ? `<span class="ge-ts-status is-ok">✓ Skompilowano · klasa <b>${geEsc(api.className)}</b></span>` : '<span class="ge-ts-status">… kompilowanie</span>';
  view.innerHTML = `<div class="ge-ts-wrap">
      <div class="ge-ts-bar">${status}<span class="ge-fill"></span>${file ? `<span class="ge-muted" title="${geEsc(file)}">📄 ${geEsc(file.split(/[\\/]/).pop())}</span>` : ''}
        <button type="button" class="ge-ts-open" data-ge="ts-open"${native ? '' : ' disabled title="Tylko w aplikacji desktopowej"'}>🔷 Otwórz w VS Code</button></div>
      ${t.errors.length ? `<ul class="ge-ts-errors">${t.errors.map((e) => `<li>${geEsc(e)}</li>`).join('')}</ul>` : ''}
      <textarea class="ge-ts-source" spellcheck="false" data-scope="ts" data-k="source" aria-label="Kod TypeScript klasy ${geEsc(bp.name)}">${geEsc(t.source)}</textarea>
      <p class="ge-hint">Domyślnie klasę edytujesz w VS Code (dwuklik na kafelku albo przycisk wyżej) — po zapisie pliku edytor sam ją skompiluje. Tutaj możesz poprawić drobiazg; zmiana kompiluje się po wyjściu z pola.</p>
    </div>`;
  const pinLabel = (text) => {
    const type = geTsPinType(text);
    if (type === 'none') return 'brak';
    return type ? geEsc(geType(type).label) : `<span class="ge-ts-bad">${geEsc(text)} — nieobsługiwany</span>`;
  };
  const params = (list) => list.map((p) => `${geEsc(p.name)}: ${pinLabel(p.type)}`).join(', ') || 'bez parametrów';
  const specs = (d) => (d ? `<span class="ge-ts-spec">${geEsc(d.specifiers.join(', ') || '—')}</span>` : '');
  const kindLabel = { call: 'węzeł', pure: 'czysty węzeł', event: 'zdarzenie' };
  const decorated = geTsDecorated(api);
  const methods = api ? api.methods.map((m) => {
    const kinds = geTsFnKinds(api, m);
    const shown = kinds.length ? kinds.map((k) => kindLabel[k]).join(' + ') : 'niewidoczna';
    return geRow(`${m.static ? 'static ' : ''}${geTsLabel(m)}`, `<span class="ge-muted">(${params(m.params)}) → ${pinLabel(m.returns)}</span>${decorated ? `<br><span class="ge-muted">${shown}</span> ${specs(m.ufunction)}` : ''}`);
  }).join('') : '';
  const props = (api?.props ?? []).map((p) => {
    const access = [geTsCanGet(p) && 'Get', geTsCanSet(p) && 'Set', geTsEditDefaults(p) && 'Ustawienia klasy', geTsEditInstance(p) && 'Szczegóły aktora'].filter(Boolean).join(' · ') || 'niewidoczne';
    return geRow(geTsLabel(p), `<span class="ge-muted">${pinLabel(p.type)} · ${geEsc(access)}</span> ${specs(p.uproperty)}`, String(geTsMeta(p, 'ToolTip') ?? ''));
  }).join('');
  const parentProblem = api?.uclass ? geTsParentProblem(ge.project, bp) : null;
  const children = ge.project.blueprints.filter((b) => b.parent === bp.id);
  const uclass = api?.uclass
    ? geCat('UCLASS — klasa nadrzędna Blueprintów', (parentProblem ? `<p class="ge-ts-bad">${geEsc(parentProblem)}</p>` : '<p class="ge-hint">Klasy Blueprint mogą po niej dziedziczyć: prawy przycisk na kafelku › Utwórz klasę Blueprint albo Klasa nadrzędna na pasku Blueprintu.</p>')
      + (children.length ? geRow('Klasy Blueprint', children.map((c) => `<b>${geEsc(c.name)}</b>`).join(', ')) : '')
      + (parentProblem ? '' : `<div class="ge-det-actions"><button type="button" data-ge="ts-child">📘 Utwórz klasę Blueprint</button></div>`))
    : '';
  details.innerHTML = `<p class="ge-det-note"><b>Klasa TypeScript</b> to kod pisany ręcznie. ${decorated
    ? 'Blueprinty widzą tylko pola i metody z dekoratorami <code>@UPROPERTY</code> i <code>@UFUNCTION</code> — jak w klasie C++ w Unreal Engine.'
    : 'Jej publiczne metody są w Blueprintach węzłami (prawy przycisk na grafie › TypeScript).'} Zmienne mogą mieć typ <b>Obiekt ${geEsc(api?.className ?? bp.name)}</b>.</p>
    ${uclass}
    ${api ? geCat('API dla Blueprintów', (api.uclass ? '' : geRow('constructor', `<span class="ge-muted">(${params(api.ctor)})</span>`)) + (methods || '<p class="ge-hint">Brak publicznych metod.</p>')) : ''}
    ${props ? geCat('Pola (UPROPERTY)', props) : ''}
    ${geCat('Zasady', `<ol class="ge-steps">
      <li>Jedna klasa na plik; bez <code>import</code> — wszystkie klasy TypeScript widzą się nawzajem.</li>
      <li>Typy parametrów i wyniku: <code>number</code>, <code>string</code>, <code>boolean</code>, <code>Vec</code>, <code>Actor</code>, Struktura, Enumeracja albo inna klasa TS.</li>
      <li>W kodzie są <code>G</code> (gra), <code>vec(x, y)</code> i <code>Actor</code> — opis w Pomoc › Dokumentacja › TypeScript.</li>
      <li>Metody <code>private</code> nie są węzłami. Klasa bez dekoratorów pokazuje wszystkie publiczne metody; z dekoratorami — tylko oznaczone.</li>
      <li><code>@UCLASS(Blueprintable)</code> — klasa nadrzędna Blueprintów; musi dziedziczyć po <code>Actor</code> i nie mieć konstruktora (albo mieć <code>(game: Game, data: ActorData)</code>).</li>
      <li><code>@UPROPERTY</code>: <code>BlueprintReadWrite</code> / <code>BlueprintReadOnly</code> — węzły Get i Set, <code>EditAnywhere</code> / <code>EditDefaultsOnly</code> / <code>EditInstanceOnly</code> — wartość w Ustawieniach klasy i w Szczegółach aktora, <code>VisibleAnywhere</code> — tylko podgląd.</li>
      <li><code>@UFUNCTION</code>: <code>BlueprintCallable</code> — węzeł, <code>BlueprintPure</code> — czysty węzeł, <code>BlueprintImplementableEvent</code> / <code>BlueprintNativeEvent</code> — zdarzenie, któremu treść daje Blueprint.</li>
      <li>Zwykła klasa dziedziczy po <code>Actor</code>: konstruktor dodaje ją do poziomu (<code>G.addActor(this)</code>), więc silnik wywołuje <code>beginPlay()</code> i co klatkę <code>tick(dt)</code>.</li></ol>`)}
    ${t.js ? geCat('JavaScript (wynik kompilacji)', `<pre class="ge-data-code">${geEsc(t.js)}</pre>`) : ''}
    ${geUsedByCat(bp)}`;
}

const GE_DATA_PAGES = { struct: geStructPage, enum: geEnumPage, database: geDatabasePage, tsclass: geTsPage };

function geDrawDataThumb(ctx, bp, W, H) {
  const kind = geKind(bp);
  const color = GE_KINDS[kind].color;
  ctx.fillStyle = '#1d2230';
  ctx.beginPath();
  ctx.roundRect(W * 0.12, H * 0.12, W * 0.76, H * 0.76, 10);
  ctx.fill();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `800 ${Math.round(H * 0.26)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillText({ tsclass: 'TS', database: 'DB', enum: 'E' }[kind] ?? '{ }', W / 2, H * 0.43);
  ctx.font = `600 ${Math.round(H * 0.13)}px "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = '#c9d3e6';
  const info = kind === 'struct' ? `${bp.struct.fields.length} pól` : kind === 'enum' ? `${bp.enum.entries.length} wartości` : kind === 'database' ? `${bp.db.entries.length} wpisów` : bp.ts.errors.length ? '✖ błędy' : `${bp.ts.api?.methods.length ?? 0} ƒ`;
  ctx.fillText(info, W / 2, H * 0.7);
}

// ---------- Zmiany i przyciski w kartach zasobów danych ----------

function geDataChange(scope, key, value, el, bp) {
  const id = el.dataset.id;
  const axis = el.dataset.axis;
  switch (scope) {
    case 'struct-field': {
      const f = bp.struct.fields.find((x) => x.id === id);
      if (!f) return;
      geChange(() => {
        if (key === 'name') {
          const name = String(value).trim();
          if (name) f.name = geUniqueName(name, bp.struct.fields.filter((x) => x !== f).map((x) => x.name));
        } else f.value = axis ? geSetAt(f.value, f.type, axis, value) : value;
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] });
      break;
    }
    case 'enum-entry': {
      const e = bp.enum.entries.find((x) => x.id === id);
      if (!e) return;
      geChange(() => {
        if (key === 'name') {
          e.name = geUniqueName(String(value).trim() || e.name, bp.enum.entries.filter((x) => x !== e).map((x) => x.name));
          ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
        } else e.desc = String(value);
      }, { only: key === 'name' ? ['details'] : [] });
      break;
    }
    case 'db-entry': {
      const e = bp.db.entries.find((x) => x.id === id);
      if (!e) return;
      geChange(() => {
        if (key === 'key') e.key = geUniqueName(String(value).trim() || e.key, bp.db.entries.filter((x) => x !== e).map((x) => x.key));
        else e.value = axis ? geSetAt(e.value, bp.db.valueType, axis, value) : value;
      }, { only: key === 'key' ? ['details'] : [] });
      break;
    }
    case 'db':
      geChange(() => {
        bp.db.valueType = value;
        bp.db.entries.forEach((e) => {
          e.value = geVarDefault(value);
        });
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] });
      geLog(`${bp.name}: nowy typ wartości — ${geType(value).label}. Wpisy dostały wartości domyślne (Ctrl+Z cofa).`);
      break;
    case 'ts-default':
      // Wartość pola UPROPERTY z klasy TypeScript w Ustawieniach klasy Blueprint (konstruktor klasy ją ustawia).
      geChange(() => {
        bp.tsDefaults = { ...bp.tsDefaults, [key]: value };
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['viewport'] });
      break;
    case 'ts':
      if (value === bp.ts.source) return;
      geChange(() => {
        bp.ts.source = String(value);
      }, { only: [] });
      geTsNative()?.write(geTsFileInfo(bp));
      geTsCompile(bp);
      break;
    default:
  }
}

function geDataClick(action, id, bp, btn) {
  switch (action) {
    case 'struct-type-pick':
    case 'struct-cont-pick':
    case 'struct-vtype-pick': {
      const f = bp.struct.fields.find((x) => x.id === id);
      if (f) geVarTypeMenu(btn, f.type, { 'struct-type-pick': 'type', 'struct-cont-pick': 'container', 'struct-vtype-pick': 'valueType' }[action], (which, value) => geSetFieldType(bp, id, which, value), geStructFieldExcept(bp));
      break;
    }
    // Elementy kontenera w polu Struktury albo w Strukturze zapisanej we wpisie Bazy danych.
    case 'struct-field-el':
    case 'db-entry-el': {
      const inStruct = action === 'struct-field-el';
      const item = (inStruct ? bp.struct.fields : bp.db.entries).find((x) => x.id === id);
      if (!item) break;
      const type = inStruct ? item.type : bp.db.valueType;
      geContainerBtn(btn, (op) => geChange(() => {
        item.value = geContainerEditAt(item.value, type, btn, op);
        if (inStruct) ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] }));
      break;
    }
    case 'struct-add':
      geChange(() => {
        bp.struct.fields.push({ id: 'f' + bp.nextVar++, name: geUniqueName('NowePole', bp.struct.fields.map((f) => f.name)), type: 'float', value: 0 });
      }, { only: ['details'] });
      break;
    case 'struct-del':
      geChange(() => {
        bp.struct.fields = bp.struct.fields.filter((f) => f.id !== id);
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] });
      break;
    case 'enum-add':
      geChange(() => {
        const names = bp.enum.entries.map((e) => e.name);
        let i = bp.enum.entries.length;
        while (names.includes('NewEnumerator' + i)) i++;
        bp.enum.entries.push({ id: 'e' + bp.nextVar++, name: 'NewEnumerator' + i, desc: '' });
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] });
      break;
    case 'enum-del':
      geChange(() => {
        bp.enum.entries = bp.enum.entries.filter((e) => e.id !== id);
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] });
      break;
    case 'enum-up':
    case 'enum-down': {
      const list = bp.enum.entries;
      const i = list.findIndex((e) => e.id === id);
      const j = action === 'enum-up' ? i - 1 : i + 1;
      if (i < 0 || j < 0 || j >= list.length) return;
      geChange(() => {
        [list[i], list[j]] = [list[j], list[i]];
        ge.dirty = new Set(geAllBlueprints(ge.project).map((b) => b.id));
      }, { only: ['details'] });
      break;
    }
    case 'db-add':
      geChange(() => {
        bp.db.entries.push({ id: 'e' + bp.nextVar++, key: geUniqueName('klucz', bp.db.entries.map((e) => e.key)), value: geVarDefault(bp.db.valueType) });
      }, { only: ['details'] });
      break;
    case 'db-del':
      geChange(() => {
        bp.db.entries = bp.db.entries.filter((e) => e.id !== id);
      }, { only: ['details'] });
      break;
    case 'ts-open': geTsOpen(bp); break;
    case 'ts-compile': geTsCompile(bp); break;
    case 'ts-child': geNewBlueprint('actor', bp.id); break;
    default:
  }
}
