// Szablony nowych projektów (okno „Nowy projekt”): gotowe, małe gry zrobione z Blueprintów, które można
// otworzyć, pozmieniać i rozbudować. Każdy szablon buduje zwykły projekt tymi samymi funkcjami co przykład
// z platformówką (geAddBlueprint, geGraph, geAddActor…), więc nie ma w nich nic, czego nie da się wyklikać.
// Gry są bez przemocy (dla dzieci od ok. 10 lat): roboty po trafieniu rozpadają się w iskierki,
// a duszki zamieniają się w gwiazdki.

const GE_TEMPLATES = [
  { id: 'empty', icon: '📄', title: 'Pusty projekt', text: 'Sam poziom i nic więcej — wszystko robisz od zera.', make: () => geNewProject() },
  { id: 'platformer', icon: '🐱', title: 'Platformówka', text: 'Kot skacze po platformach i zbiera gwiazdki.', make: () => geStarterProject() },
  { id: 'shooter', icon: '🤖', title: 'Strzelanka (jak Metal Slug)', text: 'Astronauta biegnie w prawo, skacze i strzela kulkami energii w roboty.', make: () => geTplFinish(geShooterProject()) },
  { id: 'rpg', icon: '🏡', title: 'RPG z widokiem z góry', text: 'Bohater chodzi po wiosce, rozmawia z mieszkańcami, wchodzi do domków i wykonuje zadanie.', make: () => geTplFinish(geRpgProject()) },
  { id: 'racing', icon: '🏎️', title: 'Wyścigi', text: 'Bolid na torze widzianym z góry: 3 okrążenia, punkty kontrolne, turbo i stoper.', make: () => geTplFinish(geRacingProject()) },
  { id: 'fps', icon: '👻', title: 'Strzelanka 3D (jak Wolfenstein 3D)', text: 'Labirynt w widoku 3D: łapiesz duszki bańkami, szukasz klucza i wyjścia.', make: () => geTplFinish(geRaycastProject()) }
];

// ---------- Pomocnicze ----------

// Wygląd każdej klasy aktora jako komponent z „Podstawowych kształtów” (DefaultSceneRoot bez wyglądu).
function geTplFinish(p) {
  p.blueprints.forEach((bp) => geLookToComponent(p, bp));
  return p;
}

function geTplFolder(p, name, list) {
  const folder = { id: 'f' + p.nextId++, name, parent: null };
  p.folders.push(folder);
  list.forEach((b) => { b.folder = folder.id; });
  return folder;
}

// Komponent klasy aktora (jak „＋ Dodaj komponent” w zakładce Viewport).
function geTplComp(bp, type, name, extra = {}) {
  const c = { id: 'c' + bp.nextComp++, type, name, ...JSON.parse(JSON.stringify(GE_COMP_TYPES[type].defaults)), ...extra };
  bp.components.push(c);
  return c.id;
}

// Input Action z mapowaniami: maps = [[klawisz, [modyfikatory…]]], np. ['A', ['negate']].
function geTplAction(p, imc, name, valueType, maps, triggers = []) {
  const ia = geAddBlueprint(p, name, {}, 'input_action');
  ia.inputAction.valueType = valueType;
  ia.inputAction.triggers = triggers;
  maps.forEach(([key, mods = []]) => geAddMapping(imc, ia.id, key, { modifiers: mods.map((type) => geInputItem('mod', type)) }));
  return ia;
}

function geTplPulse(interval) {
  return Object.assign(geInputItem('trig', 'pulse'), { interval });
}

// Wartość zmiennej Instance Editable aktora na poziomie.
function geTplVar(actor, bp, varId, value) {
  actor.vars[`${bp.id}:${varId}`] = value;
  return actor;
}

// Aktorzy na innym poziomie niż otwarty: na chwilę go otwieramy, a potem wracamy.
function geTplOnLevel(p, lvl, fn) {
  const back = p.levelId;
  geSwitchLevel(p, lvl.id);
  fn();
  geSwitchLevel(p, back);
}

// Grafika szablonu (GE_TEMPLATE_ASSETS z game-template-assets.js) jako Tekstura T_nazwa w Przeglądarce zawartości.
function geTplTexture(p, key, name, w, h) {
  const tex = geAddBlueprint(p, 'T_' + name, {}, 'texture');
  Object.assign(tex.texture, { src: GE_TEMPLATE_ASSETS[key], w, h });
  return tex;
}

// Typowy Widget HUD w prawym górnym rogu (lewy zajmują napisy z Print String): ciemne tło szerokości w
// i napisy [nazwa, tekst, x, y, w, rozmiar] — x liczony tak, jakby tło zaczynało się w x = 12.
function geTplHud(hud, w, h, texts) {
  const shift = 960 - 24 - w;
  Object.assign(geAddWidgetElement(hud, 'box', 12 + shift, 10), { name: 'Tlo', w, h, bg: '#1e2a3a' });
  texts.forEach(([name, text, x, y, tw, size]) => Object.assign(geAddWidgetElement(hud, 'text', x + shift, y), { name, text, w: tw, h: size + 12, size }));
}

// ---------- Strzelanka (jak Metal Slug) ----------

function geShooterProject() {
  const p = geNewProject('Robo-misja');
  p.level.graph.nodes = [];
  Object.assign(p.settings, { background: '#9fd8ff', gravity: 1800, killY: 900 });

  const player = geAddBlueprint(p, 'BP_Astronauta', { shape: 'emoji', emoji: '🧑‍🚀', w: 48, h: 48, gravity: true, collision: 'block', moveSpeed: 260, jumpSpeed: 780, z: 2 });
  const bullet = geAddBlueprint(p, 'BP_KulkaEnergii', { shape: 'circle', color: '#ffe14d', glow: 14, w: 16, h: 16, collision: 'block', z: 3 });
  const robot = geAddBlueprint(p, 'BP_Robot', { shape: 'emoji', emoji: '🤖', w: 52, h: 52, gravity: true, collision: 'block', moveSpeed: 90, z: 1 });
  const bolt = geAddBlueprint(p, 'BP_Iskra', { shape: 'emoji', emoji: '⚡', w: 26, h: 26, collision: 'overlap', z: 3 });
  const sparks = geAddBlueprint(p, 'BP_Iskierki', { shape: 'emoji', emoji: '✨', w: 60, h: 60, collision: 'none', z: 4 });
  const ground = geAddBlueprint(p, 'BP_Ziemia', { shape: 'box', color: '#7a5230', w: 192, h: 32, collision: 'block' });
  geTplComp(ground, 'box', 'Trawa', { y: -13, w: 192, h: 8, color: '#5fbf4f' });
  const crate = geAddBlueprint(p, 'BP_Skrzynia', { shape: 'emoji', emoji: '📦', w: 64, h: 64, collision: 'block' });
  const heart = geAddBlueprint(p, 'BP_Serce', { shape: 'emoji', emoji: '❤️', w: 36, h: 36, collision: 'overlap', z: 1 });
  const goal = geAddBlueprint(p, 'BP_Meta', { shape: 'emoji', emoji: '🏁', w: 64, h: 64, collision: 'overlap', z: 1 });

  const imc = geAddBlueprint(p, 'IMC_Domyslny', {}, 'input_context');
  const iaMove = geTplAction(p, imc, 'IA_Ruch', 'axis1d', [['D'], ['Right'], ['A', ['negate']], ['Left', ['negate']], ['Gamepad_LeftX', ['deadzone']]]);
  const iaJump = geTplAction(p, imc, 'IA_Skok', 'bool', [['Space'], ['W'], ['Up'], ['Gamepad_FaceButton_Bottom']]);
  // Pulse: trzymany klawisz strzela co 0,25 s.
  const iaShoot = geTplAction(p, imc, 'IA_Strzal', 'bool', [['J'], ['Ctrl'], ['Enter'], ['LeftMouseButton'], ['Gamepad_FaceButton_Left']], [geTplPulse(0.25)]);
  geTplFolder(p, 'Input', [iaMove, iaJump, iaShoot, imc]);
  p.settings.inputContext = imc.id;

  const gameMode = geAddBlueprint(p, 'BP_GameMode', { shape: 'none', collision: 'none' });
  const controller = geAddBlueprint(p, 'BP_KontrolerGracza', { shape: 'none', collision: 'none' });
  const hud = geAddBlueprint(p, 'WBP_HUD', {}, 'widget');
  geTplFolder(p, 'Framework', [gameMode, controller, hud]);
  Object.assign(p.settings, { gameMode: gameMode.id, playerController: controller.id, defaultPawn: player.id, hud: hud.id, spawnX: 120, spawnY: 440, playerStart: true });

  // GameMode: życia, punkty i kierunek strzału (zmienne gry widzi każdy Blueprint).
  let g = geGraph(gameMode);
  let a = g.add('ev_begin', 0, 0);
  let b = g.add('set_gvar', 288, 0, {}, { name: 'Zycia', value: 3 });
  g.link(a, 'then', b);
  a = g.add('set_gvar', 576, 0, {}, { name: 'Punkty', value: 0 });
  g.link(b, 'then', a);
  b = g.add('set_gvar', 864, 0, {}, { name: 'Kierunek', value: 1 });
  g.link(a, 'then', b);
  a = g.add('print', 1152, 0, {}, { text: 'Dobiegnij do flagi 🏁! ←/→ albo A/D — bieg, Spacja — skok, J albo Ctrl — strzał.' });
  g.link(b, 'then', a);

  // Player Controller: bieg (i obrót postaci w stronę biegu), skok i strzał.
  g = geGraph(controller);
  const mEv = g.add('ev_input_action', 0, 0, { action: iaMove.id });
  const mPawn = g.add('get_pawn', 32, 176);
  const mMove = g.add('move_input', 320, 0);
  g.link(mEv, 'Triggered', mMove);
  g.link(mEv, 'value', mMove, 'scale');
  g.link(mPawn, 'out', mMove, 'target');
  const mRight = g.add('gt', 352, 192);
  g.link(mEv, 'value', mRight, 'a');
  const mBranch = g.add('branch', 608, 0);
  g.link(mMove, 'then', mBranch);
  g.link(mRight, 'out', mBranch, 'cond');
  const mDirR = g.add('set_gvar', 880, -96, {}, { name: 'Kierunek', value: 1 });
  const mScaleR = g.add('set_scale', 1168, -96, {}, { scale: { x: 1, y: 1 } });
  const mDirL = g.add('set_gvar', 880, 128, {}, { name: 'Kierunek', value: -1 });
  const mScaleL = g.add('set_scale', 1168, 128, {}, { scale: { x: -1, y: 1 } });
  g.link(mBranch, 'true', mDirR);
  g.link(mDirR, 'then', mScaleR);
  g.link(mBranch, 'false', mDirL);
  g.link(mDirL, 'then', mScaleL);
  g.link(mPawn, 'out', mScaleR, 'target');
  g.link(mPawn, 'out', mScaleL, 'target');

  const jEv = g.add('ev_input_action', 0, 416, { action: iaJump.id });
  const jPawn = g.add('get_pawn', 32, 592);
  const jGround = g.add('on_ground', 288, 592);
  const jBranch = g.add('branch', 320, 416);
  const jJump = g.add('jump', 592, 416);
  const jSound = g.add('sound', 864, 416, { sound: 'jump' });
  g.link(jEv, 'Started', jBranch);
  g.link(jPawn, 'out', jGround, 'target');
  g.link(jGround, 'out', jBranch, 'cond');
  g.link(jBranch, 'true', jJump);
  g.link(jPawn, 'out', jJump, 'target');
  g.link(jJump, 'then', jSound);

  // Strzał: kulka pojawia się przed astronautą i leci w stronę, w którą biegł (zmienna gry Kierunek).
  const sEv = g.add('ev_input_action', 0, 768, { action: iaShoot.id });
  const sPawn = g.add('get_pawn', 0, 960);
  const sValid = g.add('is_valid', 256, 960);
  const sBranch = g.add('branch', 320, 768);
  const sDir = g.add('get_gvar', 256, 1056, {}, { name: 'Kierunek' });
  const sOffX = g.add('mul', 512, 1056, {}, { b: 38 });
  const sOff = g.add('make_vec', 736, 1056, {}, { y: -4 });
  const sLoc = g.add('get_location', 512, 960);
  const sAt = g.add('vec_add', 960, 1008);
  const sSpawn = g.add('spawn', 1024, 768, { cls: bullet.id });
  const sSpeedX = g.add('mul', 1024, 1152, {}, { b: 720 });
  const sSpeed = g.add('make_vec', 1248, 1152);
  const sVel = g.add('set_velocity', 1344, 768);
  const sSound = g.add('sound', 1632, 768, { sound: 'blip' });
  g.link(sEv, 'Triggered', sBranch);
  g.link(sPawn, 'out', sValid, 'actor');
  g.link(sValid, 'out', sBranch, 'cond');
  g.link(sDir, 'out', sOffX, 'a');
  g.link(sOffX, 'out', sOff, 'x');
  g.link(sPawn, 'out', sLoc, 'target');
  g.link(sLoc, 'out', sAt, 'a');
  g.link(sOff, 'out', sAt, 'b');
  g.link(sBranch, 'true', sSpawn);
  g.link(sAt, 'out', sSpawn, 'loc');
  g.link(sDir, 'out', sSpeedX, 'a');
  g.link(sSpeedX, 'out', sSpeed, 'x');
  g.link(sSpawn, 'then', sVel);
  g.link(sSpawn, 'actor', sVel, 'target');
  g.link(sSpeed, 'out', sVel, 'vel');
  g.link(sVel, 'then', sSound);

  // Astronauta: po oberwaniu traci życie, odskakuje i przez chwilę miga (wtedy nic mu nie grozi).
  g = geGraph(player);
  const safe = g.variable('Nietykalny', 'bool', false);
  a = g.add('ev_destroyed', 0, 0);
  b = g.add('restart', 288, 0);
  g.link(a, 'then', b);
  const pTick = g.add('ev_tick', 0, 160);
  const pSafe = g.add('var_get', 32, 320, { var: safe });
  const pBlinkBranch = g.add('branch', 288, 160);
  const pTime = g.add('game_time', 0, 448);
  const pTimeMul = g.add('mul', 224, 448, {}, { b: 10 });
  const pRound = g.add('round', 416, 448);
  const pMod = g.add('mod', 576, 448, {}, { b: 2 });
  const pEven = g.add('eq', 736, 448, {}, { b: 0 });
  const pBlink = g.add('set_visible', 576, 160);
  const pShow = g.add('set_visible', 576, 304, {}, { hidden: false });
  g.link(pTick, 'then', pBlinkBranch);
  g.link(pSafe, 'out', pBlinkBranch, 'cond');
  g.link(pTime, 'out', pTimeMul, 'a');
  g.link(pTimeMul, 'out', pRound, 'a');
  g.link(pRound, 'out', pMod, 'a');
  g.link(pMod, 'out', pEven, 'a');
  g.link(pBlinkBranch, 'true', pBlink);
  g.link(pEven, 'out', pBlink, 'hidden');
  g.link(pBlinkBranch, 'false', pShow);

  const hEv = g.add('ev_custom', 0, 640, { name: 'Oberwal' });
  const hSafe = g.add('var_get', 0, 800, { var: safe });
  const hNot = g.add('not', 192, 800);
  const hBranch = g.add('branch', 288, 640);
  const hSet = g.add('var_set', 544, 640, { var: safe }, { value: true });
  const hLose = g.add('add_gvar', 800, 640, {}, { name: 'Zycia', amount: -1 });
  const hSound = g.add('sound', 1072, 640, { sound: 'hit' });
  const hKnock = g.add('launch', 1280, 640, {}, { vel: { x: 0, y: -420 } });
  const hLives = g.add('get_gvar', 1280, 864, {}, { name: 'Zycia' });
  const hDead = g.add('le', 1504, 864, {}, { b: 0 });
  const hDeadBranch = g.add('branch', 1568, 640);
  const hMsg = g.add('message', 1840, 544, {}, { text: 'Ojej! Spróbuj jeszcze raz 💪' });
  const hWait = g.add('delay', 2128, 544, {}, { dur: 1.5 });
  const hRestart = g.add('restart', 2368, 544);
  const hSafeWait = g.add('delay', 1840, 736, {}, { dur: 2 });
  const hUnsafe = g.add('var_set', 2128, 736, { var: safe }, { value: false });
  g.link(hEv, 'then', hBranch);
  g.link(hSafe, 'out', hNot, 'a');
  g.link(hNot, 'out', hBranch, 'cond');
  g.link(hBranch, 'true', hSet);
  g.link(hSet, 'then', hLose);
  g.link(hLose, 'then', hSound);
  g.link(hSound, 'then', hKnock);
  g.link(hKnock, 'then', hDeadBranch);
  g.link(hLives, 'out', hDead, 'a');
  g.link(hDead, 'out', hDeadBranch, 'cond');
  g.link(hDeadBranch, 'true', hMsg);
  g.link(hMsg, 'then', hWait);
  g.link(hWait, 'then', hRestart);
  g.link(hDeadBranch, 'false', hSafeWait);
  g.link(hSafeWait, 'then', hUnsafe);

  // Kulka energii: znika po 1,5 s albo po uderzeniu w cokolwiek; robotowi mówi „Trafiony”.
  g = geGraph(bullet);
  a = g.add('ev_begin', 0, 0);
  b = g.add('delay', 288, 0, {}, { dur: 1.5 });
  g.link(a, 'then', b);
  g.link(b, 'then', g.add('destroy', 528, 0));
  const bHit = g.add('ev_hit', 0, 192);
  const bSeq = g.add('sequence', 288, 192);
  const bIsA = g.add('is_a', 288, 384, { cls: robot.id });
  const bBranch = g.add('branch', 544, 192);
  const bCall = g.add('call_event', 800, 160, { name: 'Trafiony' });
  const bDestroy = g.add('destroy', 800, 400);
  g.link(bHit, 'then', bSeq);
  g.link(bHit, 'other', bIsA, 'actor');
  g.link(bSeq, 'then0', bBranch);
  g.link(bIsA, 'out', bBranch, 'cond');
  g.link(bBranch, 'true', bCall);
  g.link(bHit, 'other', bCall, 'target');
  g.link(bSeq, 'then1', bDestroy);

  // Robot: chodzi w tę i z powrotem, co 2 s strzela iskrą w stronę gracza, po 3 trafieniach rozpada się w iskierki.
  g = geGraph(robot);
  const dir = g.variable('Kierunek', 'float', -1, true);
  const energy = g.variable('Energia', 'int', 3, true);
  a = g.add('ev_begin', 0, 0);
  b = g.add('set_timer', 288, 0, {}, { name: 'Zawroc', time: 2.2, loop: true });
  g.link(a, 'then', b);
  g.link(b, 'then', g.add('set_timer', 576, 0, {}, { name: 'Strzal', time: 2, loop: true }));
  const rTick = g.add('ev_tick', 0, 224);
  const rDir = g.add('var_get', 32, 384, { var: dir });
  const rVec = g.add('make_vec', 224, 384);
  const rMove = g.add('move_input', 448, 224);
  g.link(rTick, 'then', rMove);
  g.link(rDir, 'out', rVec, 'x');
  g.link(rVec, 'out', rMove, 'dir');

  const tEv = g.add('ev_custom', 0, 544, { name: 'Zawroc' });
  const tDir = g.add('var_get', 32, 704, { var: dir });
  const tMul = g.add('mul', 224, 704, {}, { b: -1 });
  const tSet = g.add('var_set', 448, 544, { var: dir });
  g.link(tEv, 'then', tSet);
  g.link(tDir, 'out', tMul, 'a');
  g.link(tMul, 'out', tSet, 'value');

  const fEv = g.add('ev_custom', 0, 864, { name: 'Strzal' });
  const fPawn = g.add('get_pawn', 0, 1056);
  const fValid = g.add('is_valid', 224, 1024);
  const fDist = g.add('distance', 224, 1120);
  const fNear = g.add('lt', 448, 1120, {}, { b: 520 });
  const fAnd = g.add('and', 608, 1056);
  const fBranch = g.add('branch', 640, 864);
  const fPawnLoc = g.add('get_location', 448, 1248);
  const fMyLoc = g.add('get_location', 448, 1344);
  const fTo = g.add('vec_sub', 672, 1280);
  const fDir = g.add('vec_norm', 864, 1280);
  const fOff = g.add('vec_scale', 1056, 1248, {}, { b: 40 });
  const fAt = g.add('vec_add', 1248, 1248);
  const fSpawn = g.add('spawn', 928, 864, { cls: bolt.id });
  const fSpeed = g.add('vec_scale', 1248, 1376, {}, { b: 260 });
  const fVel = g.add('set_velocity', 1248, 864);
  g.link(fEv, 'then', fBranch);
  g.link(fPawn, 'out', fValid, 'actor');
  g.link(fPawn, 'out', fDist, 'other');
  g.link(fDist, 'out', fNear, 'a');
  g.link(fValid, 'out', fAnd, 'a');
  g.link(fNear, 'out', fAnd, 'b');
  g.link(fAnd, 'out', fBranch, 'cond');
  g.link(fPawn, 'out', fPawnLoc, 'target');
  g.link(fPawnLoc, 'out', fTo, 'a');
  g.link(fMyLoc, 'out', fTo, 'b');
  g.link(fTo, 'out', fDir, 'a');
  g.link(fDir, 'out', fOff, 'a');
  g.link(fMyLoc, 'out', fAt, 'a');
  g.link(fOff, 'out', fAt, 'b');
  g.link(fBranch, 'true', fSpawn);
  g.link(fAt, 'out', fSpawn, 'loc');
  g.link(fSpawn, 'then', fVel);
  g.link(fSpawn, 'actor', fVel, 'target');
  g.link(fDir, 'out', fSpeed, 'a');
  g.link(fSpeed, 'out', fVel, 'vel');

  const xEv = g.add('ev_custom', 0, 1536, { name: 'Trafiony' });
  const xEnergy = g.add('var_get', 0, 1696, { var: energy });
  const xSub = g.add('sub', 224, 1696, {}, { b: 1 });
  const xSet = g.add('var_set', 288, 1536, { var: energy });
  const xSeq = g.add('sequence', 544, 1536);
  const xLeft = g.add('var_get', 576, 1792, { var: energy });
  const xGone = g.add('le', 768, 1792, {}, { b: 0 });
  const xBranch = g.add('branch', 832, 1504);
  const xLoc = g.add('get_location', 864, 1696);
  const xSpawn = g.add('spawn', 1088, 1504, { cls: sparks.id });
  const xPoints = g.add('add_gvar', 1376, 1504, {}, { name: 'Punkty', amount: 100 });
  const xSound = g.add('sound', 1664, 1504, { sound: 'coin' });
  const xDestroy = g.add('destroy', 1888, 1504);
  const xHide = g.add('set_visible', 832, 1904, {}, { hidden: true });
  const xWait = g.add('delay', 1088, 1904, {}, { dur: 0.1 });
  const xShow = g.add('set_visible', 1344, 1904, {}, { hidden: false });
  g.link(xEv, 'then', xSet);
  g.link(xEnergy, 'out', xSub, 'a');
  g.link(xSub, 'out', xSet, 'value');
  g.link(xSet, 'then', xSeq);
  g.link(xLeft, 'out', xGone, 'a');
  g.link(xSeq, 'then0', xBranch);
  g.link(xGone, 'out', xBranch, 'cond');
  g.link(xBranch, 'true', xSpawn);
  g.link(xLoc, 'out', xSpawn, 'loc');
  g.link(xSpawn, 'then', xPoints);
  g.link(xPoints, 'then', xSound);
  g.link(xSound, 'then', xDestroy);
  g.link(xSeq, 'then1', xHide);
  g.link(xHide, 'then', xWait);
  g.link(xWait, 'then', xShow);

  const cEv = g.add('ev_hit', 0, 2112);
  const cIsA = g.add('is_a', 32, 2272, { cls: player.id });
  const cBranch = g.add('branch', 288, 2112);
  const cCall = g.add('call_event', 544, 2112, { name: 'Oberwal' });
  g.link(cEv, 'then', cBranch);
  g.link(cEv, 'other', cIsA, 'actor');
  g.link(cIsA, 'out', cBranch, 'cond');
  g.link(cBranch, 'true', cCall);
  g.link(cEv, 'other', cCall, 'target');

  // Iskra robota: leci przez wszystko, gracza „kopie prądem” i znika.
  g = geGraph(bolt);
  a = g.add('ev_begin', 0, 0);
  b = g.add('delay', 288, 0, {}, { dur: 3 });
  g.link(a, 'then', b);
  g.link(b, 'then', g.add('destroy', 528, 0));
  const oEv = g.add('ev_overlap', 0, 192);
  const oIsA = g.add('is_a', 32, 352, { cls: player.id });
  const oBranch = g.add('branch', 288, 192);
  const oCall = g.add('call_event', 544, 192, { name: 'Oberwal' });
  const oDestroy = g.add('destroy', 864, 192);
  g.link(oEv, 'then', oBranch);
  g.link(oEv, 'other', oIsA, 'actor');
  g.link(oIsA, 'out', oBranch, 'cond');
  g.link(oBranch, 'true', oCall);
  g.link(oEv, 'other', oCall, 'target');
  g.link(oCall, 'then', oDestroy);

  // Iskierki po robocie: kręcą się pół sekundy i znikają.
  g = geGraph(sparks);
  a = g.add('ev_begin', 0, 0);
  b = g.add('delay', 288, 0, {}, { dur: 0.5 });
  g.link(a, 'then', b);
  g.link(b, 'then', g.add('destroy', 528, 0));
  a = g.add('ev_tick', 0, 192);
  b = g.add('add_rotation', 384, 192);
  const kMul = g.add('mul', 192, 352, {}, { b: 540 });
  g.link(a, 'then', b);
  g.link(a, 'delta', kMul, 'a');
  g.link(kMul, 'out', b, 'deg');

  // Serce: +1 życie.
  g = geGraph(heart);
  const eEv = g.add('ev_overlap', 0, 0);
  const eIsA = g.add('is_a', 32, 160, { cls: player.id });
  const eBranch = g.add('branch', 288, 0);
  const eAdd = g.add('add_gvar', 544, 0, {}, { name: 'Zycia', amount: 1 });
  const eSound = g.add('sound', 1152, 0, { sound: 'coin' });
  const eDestroy = g.add('destroy', 1056, 0);
  g.link(eEv, 'then', eBranch);
  g.link(eEv, 'other', eIsA, 'actor');
  g.link(eIsA, 'out', eBranch, 'cond');
  g.link(eBranch, 'true', eAdd);
  g.link(eAdd, 'then', eSound);
  g.link(eSound, 'then', eDestroy);

  // Meta: wygrana i pauza.
  g = geGraph(goal);
  const wEv = g.add('ev_overlap', 0, 0);
  const wIsA = g.add('is_a', 32, 160, { cls: player.id });
  const wBranch = g.add('branch', 288, 0);
  const wOnce = g.add('do_once', 544, 0);
  const wMsg = g.add('message', 768, 0, {}, { text: 'MISJA WYKONANA! 🎉' });
  const wSound = g.add('sound', 1056, 0, { sound: 'win' });
  const wPause = g.add('pause', 1280, 0, {}, { paused: true });
  g.link(wEv, 'then', wBranch);
  g.link(wEv, 'other', wIsA, 'actor');
  g.link(wIsA, 'out', wBranch, 'cond');
  g.link(wBranch, 'true', wOnce);
  g.link(wOnce, 'then', wMsg);
  g.link(wMsg, 'then', wSound);
  g.link(wSound, 'then', wPause);

  // HUD: życia i punkty.
  geTplHud(hud, 300, 44, [['TekstZycia', '❤️ x 3', 24, 12, 120, 22], ['TekstPunkty', '⭐ 0', 150, 12, 150, 22]]);
  g = geGraph(hud);
  const uTick = g.add('ev_tick', 0, 0);
  const uLives = g.add('set_widget_text', 288, 0, {}, { name: 'TekstZycia' });
  const uLivesText = g.add('append', 64, 192, {}, { a: '❤️ x ' });
  const uLivesVar = g.add('get_gvar', 0, 320, {}, { name: 'Zycia' });
  const uPoints = g.add('set_widget_text', 640, 0, {}, { name: 'TekstPunkty' });
  const uPointsText = g.add('append', 416, 192, {}, { a: '⭐ ' });
  const uPointsVar = g.add('get_gvar', 352, 320, {}, { name: 'Punkty' });
  g.link(uTick, 'then', uLives);
  g.link(uLivesVar, 'out', uLivesText, 'b');
  g.link(uLivesText, 'out', uLives, 'text');
  g.link(uLives, 'then', uPoints);
  g.link(uPointsVar, 'out', uPointsText, 'b');
  g.link(uPointsText, 'out', uPoints, 'text');

  geGraph(p.level).add('ev_begin', 0, 0);

  // Poziom: ziemia z dziurami, platformy, skrzynie, roboty, serca i meta na końcu.
  [[192, 2], [640, 2], [1120, 2], [1700, 3], [2300, 2], [2900, 3], [3500, 2]].forEach(([x, sx]) => geAddActor(p, ground, x, 512, { scaleX: sx }));
  [[700, 384], [1200, 352], [1700, 384], [1860, 272], [2900, 384], [3060, 288]].forEach(([x, y]) => geAddActor(p, ground, x, y, { scaleX: 0.75 }));
  [[1000, 464], [2200, 464], [2200, 400], [2264, 464]].forEach(([x, y]) => geAddActor(p, crate, x, y));
  [[720, 470], [1180, 470], [1620, 470], [2420, 470], [2780, 470], [3060, 470]].forEach(([x, y]) => geAddActor(p, robot, x, y));
  // Duży robot przed metą: większy i wytrzymalszy.
  geTplVar(geAddActor(p, robot, 3420, 456, { scaleX: 1.5, scaleY: 1.5 }), robot, energy, 8);
  geAddActor(p, heart, 1860, 230);
  geAddActor(p, heart, 3060, 246);
  geAddActor(p, goal, 3620, 464);
  return p;
}

// ---------- RPG z widokiem z góry ----------

function geRpgProject() {
  const p = geNewProject('Wioska');
  p.level.graph.nodes = [];
  p.levels[0].name = 'Wioska';
  Object.assign(p.settings, { background: '#7cc56b', gravity: 0 });

  const hero = geAddBlueprint(p, 'BP_Bohater', { shape: 'emoji', emoji: '🧒', w: 44, h: 44, collision: 'block', moveSpeed: 220, z: 3 });
  // Klasa bazowa mieszkańców: rozmowy i kolizja, bez wyglądu — wygląd (Emoji) ma każda klasa podrzędna.
  const npc = geAddBlueprint(p, 'BP_Postac', { shape: 'none', w: 48, h: 48, collision: 'block', z: 2 });
  const door = geAddBlueprint(p, 'BP_Drzwi', { shape: 'emoji', emoji: '🚪', w: 40, h: 48, collision: 'overlap', z: 1 });
  const item = geAddBlueprint(p, 'BP_Przedmiot', { shape: 'emoji', emoji: '🔑', w: 32, h: 32, collision: 'overlap', z: 1 });
  const house = geAddBlueprint(p, 'BP_Dom', { shape: 'emoji', emoji: '🏠', w: 150, h: 150, collision: 'block', z: 1 });
  const house2 = geAddBlueprint(p, 'BP_DomKowala', { shape: 'emoji', emoji: '🏡', w: 150, h: 150, collision: 'block', z: 1 });
  const tree = geAddBlueprint(p, 'BP_Drzewo', { shape: 'emoji', emoji: '🌳', w: 64, h: 64, collision: 'block', z: 2 });
  // Dekoracje: same emoji, większe meble blokują przejście.
  const decor = (name, emoji, size, collision = 'none') => geAddBlueprint(p, name, { shape: 'emoji', emoji, w: size, h: size, collision, z: collision === 'none' ? 0 : 2 });
  const flower = decor('BP_Kwiatek', '🌼', 32);
  const tulip = decor('BP_Tulipan', '🌷', 32);
  const bed = decor('BP_Lozko', '🛏️', 64, 'block');
  const basket = decor('BP_Kosz', '🧺', 48, 'block');
  const plant = decor('BP_Roslina', '🪴', 44, 'block');
  const hearth = decor('BP_Palenisko', '🔥', 56, 'block');
  const hammer = decor('BP_Mlot', '🔨', 40);
  const fence = geAddBlueprint(p, 'BP_Plot', { shape: 'box', color: '#8b5a2b', w: 64, h: 16, collision: 'block' });
  const water = geAddBlueprint(p, 'BP_Woda', { shape: 'box', color: '#3a8fd9', w: 64, h: 64, collision: 'block' });
  const path = geAddBlueprint(p, 'BP_Sciezka', { shape: 'box', color: '#d9b77a', w: 64, h: 64, collision: 'none', z: -2 });
  const floor = geAddBlueprint(p, 'BP_Podloga', { shape: 'box', color: '#c8a27a', w: 64, h: 64, collision: 'none', z: -2 });
  const wall = geAddBlueprint(p, 'BP_Sciana', { shape: 'box', color: '#6b4a2b', w: 64, h: 24, collision: 'block' });
  const talk = geAddBlueprint(p, 'WBP_Rozmowa', {}, 'widget');
  // Ekwipunek: nazwa przedmiotu → ile go masz. Postać z Warunkiem „Klucz” sprawdza tu, czy bohater ma klucz.
  const inventory = geAddBlueprint(p, 'DB_Ekwipunek', {}, 'database');
  inventory.db.valueType = 'int';

  const imc = geAddBlueprint(p, 'IMC_Domyslny', {}, 'input_context');
  // Axis2D jak w Unreal Engine: D daje X, Swizzle zamienia X na Y (S — w dół), Negate odwraca (A, W).
  const iaMove = geTplAction(p, imc, 'IA_Ruch', 'axis2d', [
    ['D'], ['Right'], ['A', ['negate']], ['Left', ['negate']],
    ['S', ['swizzle']], ['Down', ['swizzle']], ['W', ['swizzle', 'negate']], ['Up', ['swizzle', 'negate']],
    ['Gamepad_Left2D', ['deadzone']]
  ]);
  const iaTalk = geTplAction(p, imc, 'IA_Interakcja', 'bool', [['E'], ['Enter'], ['Space'], ['Gamepad_FaceButton_Bottom']]);
  geTplFolder(p, 'Input', [iaMove, iaTalk, imc]);
  p.settings.inputContext = imc.id;

  const gameMode = geAddBlueprint(p, 'BP_GameMode', { shape: 'none', collision: 'none' });
  const controller = geAddBlueprint(p, 'BP_KontrolerGracza', { shape: 'none', collision: 'none' });
  geTplFolder(p, 'Framework', [gameMode, controller, talk, inventory]);
  Object.assign(p.settings, { gameMode: gameMode.id, playerController: controller.id, defaultPawn: hero.id, spawnX: 800, spawnY: 760, playerStart: true });

  let g = geGraph(gameMode);
  let a = g.add('ev_begin', 0, 0);
  g.link(a, 'then', g.add('print', 288, 0, {}, { text: 'Chodzisz strzałkami albo WASD, rozmawiasz klawiszem E. Wejdź do domków przez drzwi 🚪.' }));

  // Player Controller: chodzenie w 4 strony i obracanie bohatera w lewo / w prawo.
  g = geGraph(controller);
  const mEv = g.add('ev_input_action', 0, 0, { action: iaMove.id });
  const mPawn = g.add('get_pawn', 32, 224);
  const mMove = g.add('move_input', 320, 0, {}, { scale: 1 });
  g.link(mEv, 'Triggered', mMove);
  g.link(mEv, 'value', mMove, 'dir');
  g.link(mPawn, 'out', mMove, 'target');
  const mBreak = g.add('break_vec', 320, 224);
  const mLeft = g.add('lt', 544, 224, {}, { b: 0 });
  const mRight = g.add('gt', 544, 320, {}, { b: 0 });
  const mBranchL = g.add('branch', 608, 0);
  const mFaceL = g.add('set_scale', 880, -64, {}, { scale: { x: -1, y: 1 } });
  const mBranchR = g.add('branch', 880, 128);
  const mFaceR = g.add('set_scale', 1152, 128, {}, { scale: { x: 1, y: 1 } });
  g.link(mEv, 'value', mBreak, 'v');
  g.link(mBreak, 'x', mLeft, 'a');
  g.link(mBreak, 'x', mRight, 'a');
  g.link(mMove, 'then', mBranchL);
  g.link(mLeft, 'out', mBranchL, 'cond');
  g.link(mBranchL, 'true', mFaceL);
  g.link(mBranchL, 'false', mBranchR);
  g.link(mRight, 'out', mBranchR, 'cond');
  g.link(mBranchR, 'true', mFaceR);
  g.link(mPawn, 'out', mFaceL, 'target');
  g.link(mPawn, 'out', mFaceR, 'target');

  // Postać: gdy bohater podejdzie, nad głową pojawia się podpowiedź, a E otwiera okno rozmowy.
  // Warunek to nazwa przedmiotu z DB_Ekwipunek (np. Klucz) — gdy bohater go ma, postać mówi TekstPo.
  g = geGraph(npc);
  const vName = g.variable('Imie', 'string', 'Mieszkaniec', true);
  const vText = g.variable('Tekst', 'string', 'Dzień dobry!', true);
  const vCond = g.variable('Warunek', 'string', '', true);
  const vTextAfter = g.variable('TekstPo', 'string', '', true);
  const vNear = g.variable('Blisko', 'bool', false);
  const vWindow = g.variable('Okno', 'actor', null);
  const zone = geTplComp(npc, 'box_collision', 'Strefa', { w: 130, h: 130 });
  const hint = geTplComp(npc, 'text', 'Podpowiedz', { y: -42, w: 130, h: 22, text: '[E] Porozmawiaj', color: '#ffffff', visible: false, z: 3 });

  a = g.add('ev_begin', 0, 0);
  let b = g.add('create_widget', 288, 0, { cls: talk.id });
  const nSetWin = g.add('var_set', 576, 0, { var: vWindow });
  g.link(a, 'then', b);
  g.link(b, 'then', nSetWin);
  g.link(b, 'widget', nSetWin, 'value');

  const nIn = g.add('ev_comp_overlap', 0, 192, { comp: zone });
  const nInIsA = g.add('is_a', 32, 352, { cls: hero.id });
  const nInBranch = g.add('branch', 320, 192);
  const nInNear = g.add('var_set', 576, 192, { var: vNear }, { value: true });
  const nInHint = g.add('comp_visible', 832, 192, { comp: hint }, { visible: true });
  g.link(nIn, 'then', nInBranch);
  g.link(nIn, 'other', nInIsA, 'actor');
  g.link(nInIsA, 'out', nInBranch, 'cond');
  g.link(nInBranch, 'true', nInNear);
  g.link(nInNear, 'then', nInHint);

  const nOut = g.add('ev_comp_end_overlap', 0, 448, { comp: zone });
  const nOutIsA = g.add('is_a', 32, 608, { cls: hero.id });
  const nOutBranch = g.add('branch', 320, 448);
  const nOutNear = g.add('var_set', 576, 448, { var: vNear }, { value: false });
  const nOutHint = g.add('comp_visible', 832, 448, { comp: hint }, { visible: false });
  const nOutWin = g.add('var_get', 832, 640, { var: vWindow });
  const nOutHide = g.add('remove_widget', 1088, 448);
  g.link(nOut, 'then', nOutBranch);
  g.link(nOut, 'other', nOutIsA, 'actor');
  g.link(nOutIsA, 'out', nOutBranch, 'cond');
  g.link(nOutBranch, 'true', nOutNear);
  g.link(nOutNear, 'then', nOutHint);
  g.link(nOutHint, 'then', nOutHide);
  g.link(nOutWin, 'out', nOutHide, 'target');

  const tEv = g.add('ev_input_action', 0, 768, { action: iaTalk.id });
  const tNear = g.add('var_get', 64, 992, { var: vNear });
  const tBranch = g.add('branch', 320, 768);
  const tWin = g.add('var_get', 320, 1088, { var: vWindow });
  const tShow = g.add('add_viewport', 576, 768);
  const tSound = g.add('sound', 832, 768, { sound: 'blip' });
  const tName = g.add('var_get', 832, 992, { var: vName });
  const tSetName = g.add('set_widget_text', 1056, 768, {}, { name: 'Imie' });
  const tCondName = g.add('var_get', 1056, 1088, { var: vCond });
  const tCondValue = g.add('db_get', 1248, 1088, { db: inventory.id });
  const tCondOk = g.add('gt', 1472, 1088, {}, { b: 0 });
  const tCondBranch = g.add('branch', 1376, 768);
  const tAfter = g.add('var_get', 1632, 640, { var: vTextAfter });
  const tSetAfter = g.add('set_widget_text', 1888, 672, {}, { name: 'Tekst' });
  const tOnce = g.add('do_once', 2208, 672);
  const tWin2 = g.add('sound', 2432, 672, { sound: 'win' });
  const tText = g.add('var_get', 1632, 992, { var: vText });
  const tSetText = g.add('set_widget_text', 1888, 896, {}, { name: 'Tekst' });
  g.link(tEv, 'Started', tBranch);
  g.link(tNear, 'out', tBranch, 'cond');
  g.link(tBranch, 'true', tShow);
  g.link(tWin, 'out', tShow, 'target');
  g.link(tShow, 'then', tSound);
  g.link(tSound, 'then', tSetName);
  g.link(tWin, 'out', tSetName, 'target');
  g.link(tName, 'out', tSetName, 'text');
  g.link(tSetName, 'then', tCondBranch);
  g.link(tCondName, 'out', tCondValue, 'key');
  g.link(tCondValue, 'value', tCondOk, 'a');
  g.link(tCondOk, 'out', tCondBranch, 'cond');
  g.link(tCondBranch, 'true', tSetAfter);
  g.link(tWin, 'out', tSetAfter, 'target');
  g.link(tAfter, 'out', tSetAfter, 'text');
  g.link(tSetAfter, 'then', tOnce);
  g.link(tOnce, 'then', tWin2);
  g.link(tCondBranch, 'false', tSetText);
  g.link(tWin, 'out', tSetText, 'target');
  g.link(tText, 'out', tSetText, 'text');

  // Okno rozmowy na dole ekranu.
  Object.assign(geAddWidgetElement(talk, 'box', 40, 384), { name: 'Tlo', w: 880, h: 136, bg: '#1e2a3a' });
  Object.assign(geAddWidgetElement(talk, 'text', 64, 394), { name: 'Imie', text: 'Imię', w: 500, h: 32, size: 22, color: '#ffd34d' });
  Object.assign(geAddWidgetElement(talk, 'text', 64, 428), { name: 'Tekst', text: 'Tekst rozmowy', w: 830, h: 64, size: 19 });
  Object.assign(geAddWidgetElement(talk, 'text', 560, 494), { name: 'Wskazowka', text: 'Odejdź, żeby zakończyć rozmowę', w: 340, h: 20, size: 13, color: '#9fb3c8', align: 'right' });

  // Drzwi: przenoszą na poziom o nazwie Poziom. Drzwi z wioski zapamiętują, gdzie bohater ma wrócić.
  g = geGraph(door);
  const vLevel = g.variable('Poziom', 'string', 'Dom_Babci', true);
  const vRemember = g.variable('ZapamietajMiejsce', 'bool', true, true);
  const dEv = g.add('ev_overlap', 0, 0);
  const dIsA = g.add('is_a', 32, 160, { cls: hero.id });
  const dBranch = g.add('branch', 288, 0);
  const dRemember = g.add('var_get', 288, 192, { var: vRemember });
  const dRememberBranch = g.add('branch', 544, 0);
  const dLoc = g.add('get_location', 544, 224);
  const dBreak = g.add('break_vec', 768, 224);
  const dBelow = g.add('add', 1024, 288, {}, { b: 64 });
  const dSetX = g.add('set_gvar', 800, -64, {}, { name: 'PowrotX' });
  const dSetY = g.add('set_gvar', 1088, -64, {}, { name: 'PowrotY' });
  const dSound = g.add('sound', 1376, 0, { sound: 'blip' });
  const dLevel = g.add('var_get', 1376, 192, { var: vLevel });
  const dOpen = g.add('open_level', 1600, 0);
  g.link(dEv, 'then', dBranch);
  g.link(dEv, 'other', dIsA, 'actor');
  g.link(dIsA, 'out', dBranch, 'cond');
  g.link(dBranch, 'true', dRememberBranch);
  g.link(dRemember, 'out', dRememberBranch, 'cond');
  g.link(dRememberBranch, 'true', dSetX);
  g.link(dLoc, 'out', dBreak, 'v');
  g.link(dBreak, 'x', dSetX, 'value');
  g.link(dSetX, 'then', dSetY);
  g.link(dBreak, 'y', dBelow, 'a');
  g.link(dBelow, 'out', dSetY, 'value');
  g.link(dSetY, 'then', dSound);
  g.link(dRememberBranch, 'false', dSound);
  g.link(dSound, 'then', dOpen);
  g.link(dLevel, 'out', dOpen, 'level');

  // Przedmiot do zebrania: zapisuje się w Bazie danych DB_Ekwipunek pod kluczem Zmienna (np. Klucz → 1).
  // Baza przetrwa przejście na inny poziom, więc zebrany przedmiot nie wraca po ponownym wejściu do domku.
  g = geGraph(item);
  const vVar = g.variable('Zmienna', 'string', 'Klucz', true);
  const vItemName = g.variable('Nazwa', 'string', 'klucz', true);
  const iBegin = g.add('ev_begin', 0, 0);
  const iVar1 = g.add('var_get', 0, 160, { var: vVar });
  const iHave = g.add('db_get', 192, 160, { db: inventory.id });
  const iBranch1 = g.add('branch', 288, 0);
  g.link(iBegin, 'then', iBranch1);
  g.link(iVar1, 'out', iHave, 'key');
  g.link(iHave, 'found', iBranch1, 'cond');
  g.link(iBranch1, 'true', g.add('destroy', 576, 0));
  const iEv = g.add('ev_overlap', 0, 320);
  const iCast = g.add('cast', 288, 320, { cls: hero.id });
  const iVar2 = g.add('var_get', 288, 512, { var: vVar });
  const iCount = g.add('db_get', 512, 576, { db: inventory.id });
  const iPlus = g.add('add', 736, 576, {}, { b: 1 });
  const iAdd = g.add('db_set', 608, 320, { db: inventory.id });
  const iSound = g.add('sound', 832, 320, { sound: 'coin' });
  const iName = g.add('var_get', 832, 512, { var: vItemName });
  const iText = g.add('append', 1056, 512, {}, { a: 'Masz: ' });
  const iPrint = g.add('print', 1056, 320);
  const iDestroy = g.add('destroy', 1344, 320);
  g.link(iEv, 'then', iCast);
  g.link(iEv, 'other', iCast, 'actor');
  g.link(iCast, 'then', iAdd);
  g.link(iVar2, 'out', iAdd, 'key');
  g.link(iVar2, 'out', iCount, 'key');
  g.link(iCount, 'value', iPlus, 'a');
  g.link(iPlus, 'out', iAdd, 'value');
  g.link(iAdd, 'then', iSound);
  g.link(iSound, 'then', iPrint);
  g.link(iName, 'out', iText, 'b');
  g.link(iText, 'out', iPrint, 'text');
  g.link(iPrint, 'then', iDestroy);

  // Level Blueprint wioski: po wyjściu z domku bohater staje przed jego drzwiami.
  g = geGraph(p.level);
  const lBegin = g.add('ev_begin', 0, 0);
  const lX = g.add('get_gvar', 0, 160, {}, { name: 'PowrotX' });
  const lY = g.add('get_gvar', 0, 256, {}, { name: 'PowrotY' });
  const lBack = g.add('gt', 224, 160, {}, { b: 0 });
  const lBranch = g.add('branch', 288, 0);
  const lPawn = g.add('get_pawn', 512, 160);
  const lVec = g.add('make_vec', 512, 256);
  const lSet = g.add('set_location', 768, 0);
  g.link(lBegin, 'then', lBranch);
  g.link(lX, 'out', lBack, 'a');
  g.link(lBack, 'out', lBranch, 'cond');
  g.link(lBranch, 'true', lSet);
  g.link(lPawn, 'out', lSet, 'target');
  g.link(lX, 'out', lVec, 'x');
  g.link(lY, 'out', lVec, 'y');
  g.link(lVec, 'out', lSet, 'loc');

  // Wioska 1600 × 1200: płot dookoła, ścieżki, staw, drzewa i dwa domki.
  const W = 1600;
  const H = 1200;
  geAddActor(p, fence, W / 2, 8, { scaleX: W / 64 });
  geAddActor(p, fence, W / 2, H - 8, { scaleX: W / 64 });
  geAddActor(p, fence, 8, H / 2, { scaleX: 0.25, scaleY: H / 16 });
  geAddActor(p, fence, W - 8, H / 2, { scaleX: 0.25, scaleY: H / 16 });
  geAddActor(p, path, 800, 600, { scaleX: 1.5, scaleY: H / 64 - 1 });
  geAddActor(p, path, 800, 480, { scaleX: 20, scaleY: 1.25 });
  geAddActor(p, path, 400, 410, { scaleX: 1, scaleY: 2 });
  geAddActor(p, path, 1200, 410, { scaleX: 1, scaleY: 2 });
  geAddActor(p, water, 1260, 930, { scaleX: 4.5, scaleY: 3 });
  [[120, 120], [230, 160], [640, 140], [960, 130], [1480, 140], [1500, 300], [130, 700], [260, 860], [120, 1060], [520, 1010],
    [620, 860], [1000, 760], [1500, 640], [980, 1080], [1520, 1080], [300, 600], [1360, 560]].forEach(([x, y]) => geAddActor(p, tree, x, y));
  [[560, 620], [600, 680], [1060, 620], [700, 1000], [380, 980], [1440, 760]].forEach(([x, y]) => geAddActor(p, flower, x, y));
  [[1120, 700], [1160, 660], [460, 1060]].forEach(([x, y]) => geAddActor(p, tulip, x, y));
  geAddActor(p, house, 400, 260);
  geAddActor(p, house2, 1200, 260);
  geTplVar(geAddActor(p, door, 400, 356), door, vLevel, 'Dom_Babci');
  geTplVar(geAddActor(p, door, 1200, 356), door, vLevel, 'Dom_Kowala');

  // Mieszkańcy to klasy podrzędne BP_Postac: mają jej rozmowy, a własny wygląd. Co mówią — w Szczegółach aktora.
  const people = {};
  [['BP_Soltys', '🧑‍🌾'], ['BP_Kot', '🐈'], ['BP_Zosia', '👧'], ['BP_Babcia', '👵'], ['BP_Kowal', '🧔']].forEach(([name, emoji]) => {
    const bp = geAddBlueprint(p, name, { ...npc.defaults, shape: 'emoji', emoji });
    bp.parent = npc.id;
    people[name] = bp;
  });
  geTplFolder(p, 'Postacie', [npc, ...Object.values(people)]);
  geTplFolder(p, 'Dekoracje', [house, house2, tree, flower, tulip, bed, basket, plant, hearth, hammer, fence, water, path, floor, wall]);
  const sign = geAddActor(p, people.BP_Soltys, 880, 760);
  geTplVar(sign, npc, vName, 'Sołtys Jan');
  geTplVar(sign, npc, vText, 'Witaj w naszej wiosce!\nBabcia Ania z czerwonego domku czegoś szuka.\nZajrzyj do niej — pewnie ucieszy się z pomocy.');
  const cat = geAddActor(p, people.BP_Kot, 1060, 900);
  geTplVar(cat, npc, vName, 'Kot Mruczek');
  geTplVar(cat, npc, vText, 'Miau! 🐟\n(Kot wygląda na zadowolonego. Chyba lubi, jak się go odwiedza.)');
  const kid = geAddActor(p, people.BP_Zosia, 520, 760);
  geTplVar(kid, npc, vName, 'Zosia');
  geTplVar(kid, npc, vText, 'Hej! Wiesz, że do domków wchodzi się przez drzwi 🚪?\nA w Blueprincie BP_Postac możesz dopisać, co mówią mieszkańcy!');

  // Wnętrze domku: podłoga, ściany, drzwi z powrotem do wioski i rzeczy w środku.
  const room = (lvl, fill) => geTplOnLevel(p, lvl, () => {
    Object.assign(p.settings, { spawnX: 480, spawnY: 420, playerStart: true });
    geAddActor(p, floor, 480, 290, { scaleX: 10, scaleY: 6.5 });
    geAddActor(p, wall, 480, 70, { scaleX: 10.4 });
    geAddActor(p, wall, 480, 510, { scaleX: 10.4 });
    geAddActor(p, wall, 156, 290, { scaleX: 0.375, scaleY: 18.5 });
    geAddActor(p, wall, 804, 290, { scaleX: 0.375, scaleY: 18.5 });
    const exit = geAddActor(p, door, 480, 478);
    geTplVar(exit, door, vLevel, 'Wioska');
    geTplVar(exit, door, vRemember, false);
    fill();
  });
  room(geAddLevel(p, 'Dom_Babci'), () => {
    const grandma = geAddActor(p, people.BP_Babcia, 480, 180);
    geTplVar(grandma, npc, vName, 'Babcia Ania');
    geTplVar(grandma, npc, vText, 'Och, dobrze, że jesteś! Zgubiłam klucz do skrzyni z ciasteczkami.\nChyba zostawiłam go u Kowala w domku obok...\nPrzyniesiesz mi go?');
    geTplVar(grandma, npc, vCond, 'Klucz');
    geTplVar(grandma, npc, vTextAfter, 'Mój klucz! Dziękuję, jesteś wspaniały! 🍪\nWeź ciasteczko — zadanie wykonane! 🎉');
    geAddActor(p, bed, 280, 150);
    geAddActor(p, basket, 680, 150);
    geAddActor(p, plant, 680, 400);
  });
  room(geAddLevel(p, 'Dom_Kowala'), () => {
    const smith = geAddActor(p, people.BP_Kowal, 300, 200);
    geTplVar(smith, npc, vName, 'Kowal Bartek');
    geTplVar(smith, npc, vText, 'Klucz Babci Ani? Leży gdzieś tutaj, przy palenisku.\nWeź go i zanieś Babci!');
    geAddActor(p, hearth, 620, 170);
    geAddActor(p, hammer, 620, 300);
    geAddActor(p, item, 700, 380);
  });
  return p;
}

// ---------- Wyścigi ----------

function geRacingProject() {
  const p = geNewProject('Wielki wyścig');
  p.level.graph.nodes = [];
  Object.assign(p.settings, { background: '#4f9a3a', gravity: 0, grid: 32 });

  // Bolid: aktor ma kwadratową kolizję (kolizje nie obracają się), a wygląd daje komponent Obrazek, który obraca się z nim.
  const car = geAddBlueprint(p, 'BP_Bolid', { shape: 'none', w: 34, h: 34, collision: 'block', z: 3 });
  const carTex = geTplTexture(p, 'race-car', 'Bolid', 64, 32);
  geTplComp(car, 'image', 'Wyglad', { w: 64, h: 32, image: GE_TEMPLATE_ASSETS['race-car'], z: 1 });
  const barrier = geAddBlueprint(p, 'BP_Bariera', { shape: 'box', color: '#c62828', w: 64, h: 24, collision: 'block', z: 1 });
  const tires = geAddBlueprint(p, 'BP_Opony', { shape: 'emoji', emoji: '🛞', w: 44, h: 44, collision: 'block', z: 1 });
  // Asfalt: jeden duży aktor, a komponent Obrazek z Kafelkowaniem powtarza teksturę zamiast ją rozciągać.
  const road = geAddBlueprint(p, 'BP_Asfalt', { shape: 'none', color: '#5b5b5b', w: 64, h: 64, collision: 'none', z: -3 });
  const roadTex = geTplTexture(p, 'track-tile', 'Asfalt', 64, 64);
  geTplComp(road, 'image', 'Nawierzchnia', { w: 64, h: 64, image: GE_TEMPLATE_ASSETS['track-tile'], tile: true, z: 0 });
  const grass = geAddBlueprint(p, 'BP_Trawa', { shape: 'box', color: '#4f9a3a', w: 64, h: 64, collision: 'none', z: -2 });
  const deco = geAddBlueprint(p, 'BP_Ozdoba', { shape: 'emoji', emoji: '🌳', w: 64, h: 64, collision: 'none', z: -1 });
  const finish = geAddBlueprint(p, 'BP_Meta', { shape: 'box', color: '#ffffff', w: 24, h: 64, collision: 'overlap', z: -1 });
  const check = geAddBlueprint(p, 'BP_PunktKontrolny', { shape: 'box', color: '#ffd34d', opacity: 0.3, w: 64, h: 24, collision: 'overlap', z: -1 });
  const boost = geAddBlueprint(p, 'BP_Turbo', { shape: 'box', color: '#ffb300', w: 56, h: 56, collision: 'overlap', z: -1 });
  geTplComp(boost, 'emoji', 'Ikona', { emoji: '⚡', w: 40, h: 40 });
  const puddle = geAddBlueprint(p, 'BP_Kaluza', { shape: 'circle', color: '#4aa3df', opacity: 0.85, w: 90, h: 60, collision: 'overlap', z: -1 });

  const imc = geAddBlueprint(p, 'IMC_Domyslny', {}, 'input_context');
  const iaGas = geTplAction(p, imc, 'IA_Gaz', 'axis1d', [['W'], ['Up'], ['S', ['negate']], ['Down', ['negate']], ['Gamepad_RightTriggerAxis'], ['Gamepad_LeftTriggerAxis', ['negate']]]);
  const iaSteer = geTplAction(p, imc, 'IA_Skret', 'axis1d', [['D'], ['Right'], ['A', ['negate']], ['Left', ['negate']], ['Gamepad_LeftX', ['deadzone']]]);
  geTplFolder(p, 'Input', [iaGas, iaSteer, imc]);
  p.settings.inputContext = imc.id;

  const gameMode = geAddBlueprint(p, 'BP_GameMode', { shape: 'none', collision: 'none' });
  const hud = geAddBlueprint(p, 'WBP_HUD', {}, 'widget');
  geTplFolder(p, 'Framework', [gameMode, hud]);
  geTplFolder(p, 'Tekstury', [carTex, roadTex]);
  Object.assign(p.settings, { gameMode: gameMode.id, defaultPawn: car.id, hud: hud.id });

  // GameMode: odliczanie 3‑2‑1, potem stoper (zmienna gry Czas) aż do mety.
  let g = geGraph(gameMode);
  let prev = g.add('ev_begin', 0, 0);
  let x = 288;
  const step = (type, values = {}, props = {}) => {
    const id = g.add(type, x, 0, props, values);
    g.link(prev, 'then', id);
    prev = id;
    x += 256;
  };
  step('set_gvar', { name: 'NastepnyPunkt', value: 1 });
  step('set_gvar', { name: 'Okrazenie', value: 0 });
  ['3', '2', '1'].forEach((n) => {
    step('message', { text: n });
    step('sound', {}, { sound: 'blip' });
    step('delay', { dur: 1 });
  });
  step('message', { text: 'START!' });
  step('sound', {}, { sound: 'jump' });
  step('set_gvar', { name: 'Start', value: 1 });
  step('delay', { dur: 0.8 });
  step('message', { text: '' });
  const gTick = g.add('ev_tick', 0, 256);
  const gStarted = g.add('get_gvar', 0, 416, {}, { name: 'Start' });
  const gRun = g.add('ge', 224, 416, {}, { b: 1 });
  const gDone = g.add('get_gvar', 0, 512, {}, { name: 'Koniec' });
  const gNotDone = g.add('lt', 224, 512, {}, { b: 1 });
  const gAnd = g.add('and', 448, 448);
  const gBranch = g.add('branch', 320, 256);
  const gAdd = g.add('add_gvar', 640, 256, {}, { name: 'Czas' });
  g.link(gTick, 'then', gBranch);
  g.link(gStarted, 'out', gRun, 'a');
  g.link(gDone, 'out', gNotDone, 'a');
  g.link(gRun, 'out', gAnd, 'a');
  g.link(gNotDone, 'out', gAnd, 'b');
  g.link(gAnd, 'out', gBranch, 'cond');
  g.link(gBranch, 'true', gAdd);
  g.link(gTick, 'delta', gAdd, 'amount');

  // Bolid: gaz zwiększa Prędkość, opór ją zmniejsza, kierownica obraca (tym mocniej, im szybciej jedziesz),
  // a ruch idzie zawsze „do przodu” (Get Actor Forward Vector).
  g = geGraph(car);
  const vSpeed = g.variable('Predkosc', 'float', 0);
  const vAccel = g.variable('Przyspieszenie', 'float', 520, true);
  const vTurn = g.variable('Skret', 'float', 170, true);
  const cTick = g.add('ev_tick', 0, 0);
  const cStart = g.add('get_gvar', 0, 160, {}, { name: 'Start' });
  const cGo = g.add('ge', 224, 160, {}, { b: 1 });
  const cBranch = g.add('branch', 288, 0);
  const cGas = g.add('input_value', 352, 288, { action: iaGas.id });
  const cAccel = g.add('var_get', 352, 384, { var: vAccel });
  const cAccelDt = g.add('mul', 576, 384);
  const cGasDt = g.add('mul', 768, 320);
  const cSpeed = g.add('var_get', 768, 448, { var: vSpeed });
  const cFaster = g.add('add', 992, 384);
  const cDrag = g.add('mul', 768, 544, {}, { a: 1.2 });
  const cKeep = g.add('sub', 992, 544, {}, { a: 1 });
  const cNewSpeed = g.add('mul', 1216, 448);
  const cSetSpeed = g.add('var_set', 576, 0, { var: vSpeed });
  g.link(cTick, 'then', cBranch);
  g.link(cStart, 'out', cGo, 'a');
  g.link(cGo, 'out', cBranch, 'cond');
  g.link(cAccel, 'out', cAccelDt, 'a');
  g.link(cTick, 'delta', cAccelDt, 'b');
  g.link(cGas, 'out', cGasDt, 'a');
  g.link(cAccelDt, 'out', cGasDt, 'b');
  g.link(cSpeed, 'out', cFaster, 'a');
  g.link(cGasDt, 'out', cFaster, 'b');
  g.link(cTick, 'delta', cDrag, 'b');
  g.link(cDrag, 'out', cKeep, 'b');
  g.link(cFaster, 'out', cNewSpeed, 'a');
  g.link(cKeep, 'out', cNewSpeed, 'b');
  g.link(cBranch, 'true', cSetSpeed);
  g.link(cNewSpeed, 'out', cSetSpeed, 'value');

  const cSteer = g.add('input_value', 1216, 160, { action: iaSteer.id });
  const cTurn = g.add('var_get', 1216, 256, { var: vTurn });
  const cTurnDt = g.add('mul', 1440, 256);
  const cSteerDeg = g.add('mul', 1632, 192);
  const cSpeed2 = g.add('var_get', 1440, 352, { var: vSpeed });
  const cGrip = g.add('div', 1632, 352, {}, { b: 200 });
  const cGripClamp = g.add('clamp', 1824, 352, {}, { min: -1, max: 1 });
  const cDeg = g.add('mul', 2048, 256);
  const cRotate = g.add('add_rotation', 1088, 0);
  g.link(cSetSpeed, 'then', cRotate);
  g.link(cTurn, 'out', cTurnDt, 'a');
  g.link(cTick, 'delta', cTurnDt, 'b');
  g.link(cSteer, 'out', cSteerDeg, 'a');
  g.link(cTurnDt, 'out', cSteerDeg, 'b');
  g.link(cSpeed2, 'out', cGrip, 'a');
  g.link(cGrip, 'out', cGripClamp, 'v');
  g.link(cSteerDeg, 'out', cDeg, 'a');
  g.link(cGripClamp, 'out', cDeg, 'b');
  g.link(cDeg, 'out', cRotate, 'deg');

  const cFwd = g.add('get_forward', 1600, -160);
  const cSpeed3 = g.add('var_get', 1600, -64, { var: vSpeed });
  const cVel = g.add('vec_scale', 1856, -128);
  const cSetVel = g.add('set_velocity', 2112, 0);
  g.link(cRotate, 'then', cSetVel);
  g.link(cFwd, 'out', cVel, 'a');
  g.link(cSpeed3, 'out', cVel, 'b');
  g.link(cVel, 'out', cSetVel, 'vel');

  // Uderzenie w bandę albo opony: odbicie do tyłu.
  const hEv = g.add('ev_hit', 0, 704);
  const hSpeed = g.add('var_get', 32, 864, { var: vSpeed });
  const hBounce = g.add('mul', 224, 864, {}, { b: -0.3 });
  const hSet = g.add('var_set', 288, 704, { var: vSpeed });
  const hSound = g.add('sound', 576, 704, { sound: 'hit' });
  g.link(hEv, 'then', hSet);
  g.link(hSpeed, 'out', hBounce, 'a');
  g.link(hBounce, 'out', hSet, 'value');
  g.link(hSet, 'then', hSound);

  // Turbo przyspiesza, kałuża spowalnia.
  const oEv = g.add('ev_overlap', 0, 1024);
  const oBoost = g.add('is_a', 32, 1184, { cls: boost.id });
  const oBranch = g.add('branch', 288, 1024);
  const oFast = g.add('var_set', 576, 960, { var: vSpeed }, { value: 760 });
  const oFastSound = g.add('sound', 864, 960, { sound: 'jump' });
  const oPuddle = g.add('is_a', 320, 1280, { cls: puddle.id });
  const oBranch2 = g.add('branch', 576, 1152);
  const oSpeed = g.add('var_get', 576, 1344, { var: vSpeed });
  const oSlow = g.add('mul', 800, 1344, {}, { b: 0.45 });
  const oSetSlow = g.add('var_set', 864, 1152, { var: vSpeed });
  const oSlowSound = g.add('sound', 1152, 1152, { sound: 'blip' });
  g.link(oEv, 'then', oBranch);
  g.link(oEv, 'other', oBoost, 'actor');
  g.link(oBoost, 'out', oBranch, 'cond');
  g.link(oBranch, 'true', oFast);
  g.link(oFast, 'then', oFastSound);
  g.link(oBranch, 'false', oBranch2);
  g.link(oEv, 'other', oPuddle, 'actor');
  g.link(oPuddle, 'out', oBranch2, 'cond');
  g.link(oBranch2, 'true', oSetSlow);
  g.link(oSpeed, 'out', oSlow, 'a');
  g.link(oSlow, 'out', oSetSlow, 'value');
  g.link(oSetSlow, 'then', oSlowSound);

  // Punkt kontrolny: liczy się tylko ten, który jest następny w kolejności (zmienna gry NastepnyPunkt).
  g = geGraph(check);
  const vNumber = g.variable('Numer', 'int', 1, true);
  const kEv = g.add('ev_overlap', 0, 0);
  const kCast = g.add('cast', 288, 0, { cls: car.id });
  const kNum = g.add('var_get', 32, 256, { var: vNumber });
  const kNext = g.add('get_gvar', 32, 352, {}, { name: 'NastepnyPunkt' });
  const kEq = g.add('eq', 256, 288);
  const kBranch = g.add('branch', 608, 0);
  const kAdd = g.add('add_gvar', 864, 0, {}, { name: 'NastepnyPunkt', amount: 1 });
  const kSound = g.add('sound', 1152, 0, { sound: 'blip' });
  g.link(kEv, 'then', kCast);
  g.link(kEv, 'other', kCast, 'actor');
  g.link(kCast, 'then', kBranch);
  g.link(kNum, 'out', kEq, 'a');
  g.link(kNext, 'out', kEq, 'b');
  g.link(kEq, 'out', kBranch, 'cond');
  g.link(kBranch, 'true', kAdd);
  g.link(kAdd, 'then', kSound);

  // Meta: okrążenie liczy się po zaliczeniu wszystkich punktów kontrolnych; po ostatnim — koniec wyścigu.
  g = geGraph(finish);
  const vLaps = g.variable('LiczbaOkrazen', 'int', 3, true);
  const fEv = g.add('ev_overlap', 0, 0);
  const fCast = g.add('cast', 288, 0, { cls: car.id });
  const fChecks = g.add('get_all_actors', 576, 0, { cls: check.id });
  const fNext = g.add('get_gvar', 576, 256, {}, { name: 'NastepnyPunkt' });
  const fCount = g.add('array_length', 640, 352);
  const fAll = g.add('gt', 864, 288);
  const fBranch = g.add('branch', 896, 0);
  const fLap = g.add('add_gvar', 1184, 0, {}, { name: 'Okrazenie', amount: 1 });
  const fReset = g.add('set_gvar', 1472, 0, {}, { name: 'NastepnyPunkt', value: 1 });
  const fSound = g.add('sound', 1760, 0, { sound: 'coin' });
  const fLapNow = g.add('get_gvar', 1760, 192, {}, { name: 'Okrazenie' });
  const fLaps = g.add('var_get', 1760, 288, { var: vLaps });
  const fEnd = g.add('ge', 1984, 224);
  const fEndBranch = g.add('branch', 1984, 0);
  const fSetEnd = g.add('set_gvar', 2240, 0, {}, { name: 'Koniec', value: 1 });
  const fTime = g.add('get_gvar', 2240, 224, {}, { name: 'Czas' });
  const fTime10 = g.add('mul', 2432, 224, {}, { b: 10 });
  const fRound = g.add('round', 2624, 224);
  const fTimeS = g.add('div', 2784, 224, {}, { b: 10 });
  const fText = g.add('append', 2976, 192, {}, { a: 'META! 🏆 Czas: ' });
  const fText2 = g.add('append', 3200, 192, {}, { b: ' s' });
  const fMsg = g.add('message', 2528, 0);
  const fWin = g.add('sound', 3424, 0, { sound: 'win' });
  g.link(fEv, 'then', fCast);
  g.link(fEv, 'other', fCast, 'actor');
  g.link(fCast, 'then', fChecks);
  g.link(fChecks, 'then', fBranch);
  g.link(fChecks, 'actors', fCount, 'array');
  g.link(fNext, 'out', fAll, 'a');
  g.link(fCount, 'out', fAll, 'b');
  g.link(fAll, 'out', fBranch, 'cond');
  g.link(fBranch, 'true', fLap);
  g.link(fLap, 'then', fReset);
  g.link(fReset, 'then', fSound);
  g.link(fSound, 'then', fEndBranch);
  g.link(fLapNow, 'out', fEnd, 'a');
  g.link(fLaps, 'out', fEnd, 'b');
  g.link(fEnd, 'out', fEndBranch, 'cond');
  g.link(fEndBranch, 'true', fSetEnd);
  g.link(fTime, 'out', fTime10, 'a');
  g.link(fTime10, 'out', fRound, 'a');
  g.link(fRound, 'out', fTimeS, 'a');
  g.link(fTimeS, 'out', fText, 'b');
  g.link(fText, 'out', fText2, 'a');
  g.link(fSetEnd, 'then', fMsg);
  g.link(fText2, 'out', fMsg, 'text');
  g.link(fMsg, 'then', fWin);

  // Bolid po mecie zwalnia sam (Start = 0 wyłącza gaz).
  const fStop = g.add('set_gvar', 3648, 0, {}, { name: 'Start', value: 0 });
  g.link(fWin, 'then', fStop);

  // HUD: okrążenie i czas.
  geTplHud(hud, 360, 44, [['TekstOkrazenie', '🏁 Okrążenie 1 / 3', 24, 12, 200, 20], ['TekstCzas', '⏱ 0 s', 236, 12, 130, 20]]);
  g = geGraph(hud);
  const uTick = g.add('ev_tick', 0, 0);
  const uLap = g.add('get_gvar', 0, 192, {}, { name: 'Okrazenie' });
  const uLap1 = g.add('add', 224, 192, {}, { b: 1 });
  const uLapMax = g.add('clamp', 416, 192, {}, { min: 1, max: 3 });
  const uLapText = g.add('append', 640, 160, {}, { a: '🏁 Okrążenie ' });
  const uLapText2 = g.add('append', 864, 160, {}, { b: ' / 3' });
  const uSetLap = g.add('set_widget_text', 320, 0, {}, { name: 'TekstOkrazenie' });
  const uTime = g.add('get_gvar', 0, 352, {}, { name: 'Czas' });
  const uTime10 = g.add('mul', 224, 352, {}, { b: 10 });
  const uRound = g.add('round', 416, 352);
  const uTimeS = g.add('div', 576, 352, {}, { b: 10 });
  const uTimeText = g.add('append', 768, 352, {}, { a: '⏱ ' });
  const uTimeText2 = g.add('append', 992, 352, {}, { b: ' s' });
  const uSetTime = g.add('set_widget_text', 1088, 0, {}, { name: 'TekstCzas' });
  g.link(uTick, 'then', uSetLap);
  g.link(uLap, 'out', uLap1, 'a');
  g.link(uLap1, 'out', uLapMax, 'v');
  g.link(uLapMax, 'out', uLapText, 'b');
  g.link(uLapText, 'out', uLapText2, 'a');
  g.link(uLapText2, 'out', uSetLap, 'text');
  g.link(uSetLap, 'then', uSetTime);
  g.link(uTime, 'out', uTime10, 'a');
  g.link(uTime10, 'out', uRound, 'a');
  g.link(uRound, 'out', uTimeS, 'a');
  g.link(uTimeS, 'out', uTimeText, 'b');
  g.link(uTimeText, 'out', uTimeText2, 'a');
  g.link(uTimeText2, 'out', uSetTime, 'text');

  geGraph(p.level).add('ev_begin', 0, 0);

  // Tor: prostokątna pętla 1920 × 1200 z wyspą trawy w środku (jazda w lewo po dolnej prostej, zgodnie z ruchem wskazówek zegara).
  geAddActor(p, road, 960, 600, { scaleX: 30, scaleY: 18.75 });
  geAddActor(p, grass, 960, 600, { scaleX: 17.5, scaleY: 6.875 });
  geAddActor(p, barrier, 960, -12, { scaleX: 30.75 });
  geAddActor(p, barrier, 960, 1212, { scaleX: 30.75 });
  geAddActor(p, barrier, -12, 600, { scaleX: 0.375, scaleY: 51 });
  geAddActor(p, barrier, 1932, 600, { scaleX: 0.375, scaleY: 51 });
  geAddActor(p, barrier, 960, 380, { scaleX: 17.5 });
  geAddActor(p, barrier, 960, 820, { scaleX: 17.5 });
  geAddActor(p, barrier, 400, 600, { scaleX: 0.375, scaleY: 19.3 });
  geAddActor(p, barrier, 1520, 600, { scaleX: 0.375, scaleY: 19.3 });
  geAddActor(p, finish, 960, 1010, { scaleY: 5.9 });
  geTplVar(geAddActor(p, check, 200, 600, { scaleX: 6.25 }), check, vNumber, 1);
  geTplVar(geAddActor(p, check, 960, 190, { scaleX: 0.375, scaleY: 15.8 }), check, vNumber, 2);
  geTplVar(geAddActor(p, check, 1720, 600, { scaleX: 6.25 }), check, vNumber, 3);
  [[560, 920], [300, 300], [1340, 110], [1820, 900]].forEach(([bx, by]) => geAddActor(p, boost, bx, by));
  [[200, 980], [1100, 270], [1640, 420]].forEach(([px, py]) => geAddActor(p, puddle, px, py));
  [[60, 60], [60, 1140], [1860, 60], [1860, 1140], [440, 420], [1480, 780]].forEach(([tx, ty]) => geAddActor(p, tires, tx, ty));
  [[600, 520], [800, 680], [1100, 520], [1350, 680], [500, 700]].forEach(([dx, dy]) => geAddActor(p, deco, dx, dy));
  geAddActor(p, car, 1080, 1010, { rotation: 180 });
  return p;
}

// ---------- Strzelanka 3D (jak Wolfenstein 3D) ----------

// Mapa labiryntu, jedna kratka = 64 px: # ściana z kamienia, b z cegieł, w z desek, D złote drzwi (otwiera klucz),
// P gracz, G duszek, * gwiazdka, K klucz, S serce, E wyjście.
const GE_FPS_MAP = [
  '################',
  '#P..b.....*....#',
  '#...b.bbbb.bbb.#',
  '#.G.b.b..G...b.#',
  '#...b.b..bb..b.#',
  '#b.bbb.......b.#',
  '#......w.wwwww.#',
  '#.*.G..w..K..w.#',
  '#......w.....w.#',
  '#bbbbbbbbbbbbbD#',
  '#E...G..S...*..#',
  '################'
];

function geRaycastProject() {
  const p = geNewProject('Łowcy duchów 3D');
  p.level.graph.nodes = [];
  Object.assign(p.settings, { view: 'raycast', background: '#20243a', floorColor: '#6b5a48', wallHeight: 64, minimap: true, gravity: 0, grid: 32 });

  const player = geAddBlueprint(p, 'BP_Gracz', { shape: 'emoji', emoji: '➡️', w: 32, h: 32, collision: 'block', moveSpeed: 190, z: 3 });
  const bubble = geAddBlueprint(p, 'BP_Banka', { shape: 'circle', color: '#9be7ff', glow: 10, opacity: 0.85, w: 14, h: 14, collision: 'block', z: 2 });
  const ghost = geAddBlueprint(p, 'BP_Duszek', { shape: 'emoji', emoji: '👻', w: 44, h: 44, collision: 'block', moveSpeed: 90, z: 2 });
  // Ściany z teksturą (Sprite): w widoku 3D obrazek pokrywa ścianę, kolor zostaje dla minimapy.
  const looks = [['wall-stone', 'Kamien'], ['wall-brick', 'Cegly'], ['wall-wood', 'Deski'], ['door-gold', 'ZloteDrzwi']].map(([k, name]) => geTplTexture(p, k, name, 64, 64));
  const wallBp = (name, tex, color) => {
    const bp = geAddBlueprint(p, name, { shape: 'none', w: 64, h: 64, collision: 'block' });
    geTplComp(bp, 'image', 'Obrazek', { w: 64, h: 64, image: tex.texture.src, color, z: 0 });
    return bp;
  };
  const wall = wallBp('BP_ScianaKamien', looks[0], '#6f86b8');
  const brick = wallBp('BP_ScianaCegly', looks[1], '#c4643c');
  const wood = wallBp('BP_ScianaDeski', looks[2], '#b9874f');
  const door = wallBp('BP_ZloteDrzwi', looks[3], '#d4a017');
  geTplFolder(p, 'Tekstury', looks);
  geTplFolder(p, 'Sciany', [wall, brick, wood, door]);
  const doorZone = geTplComp(door, 'box_collision', 'Strefa', { w: 150, h: 150 });
  const star = geAddBlueprint(p, 'BP_Gwiazdka', { shape: 'emoji', emoji: '⭐', w: 30, h: 30, collision: 'overlap', z: 1 });
  const key = geAddBlueprint(p, 'BP_Klucz', { shape: 'emoji', emoji: '🗝️', w: 34, h: 34, collision: 'overlap', z: 1 });
  const heart = geAddBlueprint(p, 'BP_Serce', { shape: 'emoji', emoji: '💖', w: 32, h: 32, collision: 'overlap', z: 1 });
  const exit = geAddBlueprint(p, 'BP_Wyjscie', { shape: 'emoji', emoji: '🌀', w: 52, h: 52, collision: 'overlap', z: 1 });

  const imc = geAddBlueprint(p, 'IMC_Domyslny', {}, 'input_context');
  // IA_Ruch: X — do przodu / do tyłu, Y — krok w bok (A / D).
  const iaMove = geTplAction(p, imc, 'IA_Ruch', 'axis2d', [
    ['W'], ['Up'], ['S', ['negate']], ['Down', ['negate']], ['D', ['swizzle']], ['A', ['swizzle', 'negate']]
  ]);
  const iaTurn = geTplAction(p, imc, 'IA_Obrot', 'axis1d', [['Right'], ['E'], ['Left', ['negate']], ['Q', ['negate']], ['Gamepad_RightX', ['deadzone']]]);
  const iaShoot = geTplAction(p, imc, 'IA_Strzal', 'bool', [['Space'], ['Ctrl'], ['LeftMouseButton'], ['Gamepad_RightTriggerAxis']], [geTplPulse(0.3)]);
  geTplFolder(p, 'Input', [iaMove, iaTurn, iaShoot, imc]);
  p.settings.inputContext = imc.id;

  const gameMode = geAddBlueprint(p, 'BP_GameMode', { shape: 'none', collision: 'none' });
  const controller = geAddBlueprint(p, 'BP_KontrolerGracza', { shape: 'none', collision: 'none' });
  const hud = geAddBlueprint(p, 'WBP_HUD', {}, 'widget');
  geTplFolder(p, 'Framework', [gameMode, controller, hud]);
  Object.assign(p.settings, { gameMode: gameMode.id, playerController: controller.id, defaultPawn: player.id, hud: hud.id });

  let g = geGraph(gameMode);
  let a = g.add('ev_begin', 0, 0);
  let b = g.add('set_gvar', 288, 0, {}, { name: 'Energia', value: 5 });
  g.link(a, 'then', b);
  a = g.add('set_gvar', 576, 0, {}, { name: 'Klucz', value: 0 });
  g.link(b, 'then', a);
  b = g.add('print', 864, 0, {}, { text: 'Złap wszystkie duszki bańkami i znajdź wyjście 🌀! W/S — chodzenie, ←/→ — obrót, A/D — krok w bok, Spacja — bańka.' });
  g.link(a, 'then', b);

  // Player Controller: w każdej klatce ruch względem kierunku patrzenia i obrót; bańka leci przed siebie.
  g = geGraph(controller);
  const cTick = g.add('ev_tick', 0, 0);
  const cPawn = g.add('get_pawn', 0, 192);
  const cMove = g.add('input_value', 0, 288, { action: iaMove.id });
  const cBreak = g.add('break_vec', 224, 288);
  const cFwd = g.add('get_forward', 224, 160);
  const cRight = g.add('get_right', 224, 416);
  const cFwdPart = g.add('vec_scale', 480, 192);
  const cSidePart = g.add('vec_scale', 480, 352);
  const cDir = g.add('vec_add', 704, 256);
  const cWalk = g.add('move_input', 320, 0, {}, { scale: 1 });
  g.link(cTick, 'then', cWalk);
  g.link(cPawn, 'out', cWalk, 'target');
  g.link(cPawn, 'out', cFwd, 'target');
  g.link(cPawn, 'out', cRight, 'target');
  g.link(cMove, 'out', cBreak, 'v');
  g.link(cFwd, 'out', cFwdPart, 'a');
  g.link(cBreak, 'x', cFwdPart, 'b');
  g.link(cRight, 'out', cSidePart, 'a');
  g.link(cBreak, 'y', cSidePart, 'b');
  g.link(cFwdPart, 'out', cDir, 'a');
  g.link(cSidePart, 'out', cDir, 'b');
  g.link(cDir, 'out', cWalk, 'dir');
  const cTurn = g.add('input_value', 704, 448, { action: iaTurn.id });
  const cTurnSpeed = g.add('mul', 928, 512, {}, { a: 150 });
  const cTurnDeg = g.add('mul', 1120, 448);
  const cRotate = g.add('add_rotation', 960, 0);
  g.link(cWalk, 'then', cRotate);
  g.link(cPawn, 'out', cRotate, 'target');
  g.link(cTick, 'delta', cTurnSpeed, 'b');
  g.link(cTurn, 'out', cTurnDeg, 'a');
  g.link(cTurnSpeed, 'out', cTurnDeg, 'b');
  g.link(cTurnDeg, 'out', cRotate, 'deg');

  const sEv = g.add('ev_input_action', 0, 672, { action: iaShoot.id });
  const sPawn = g.add('get_pawn', 0, 864);
  const sValid = g.add('is_valid', 224, 864);
  const sBranch = g.add('branch', 320, 672);
  const sLoc = g.add('get_location', 224, 960);
  const sFwd = g.add('get_forward', 224, 1056);
  const sOff = g.add('vec_scale', 448, 1056, {}, { b: 30 });
  const sAt = g.add('vec_add', 672, 992);
  const sSpawn = g.add('spawn', 608, 672, { cls: bubble.id });
  const sSpeed = g.add('vec_scale', 672, 1120, {}, { b: 520 });
  const sVel = g.add('set_velocity', 928, 672);
  const sSound = g.add('sound', 1216, 672, { sound: 'blip' });
  g.link(sEv, 'Triggered', sBranch);
  g.link(sPawn, 'out', sValid, 'actor');
  g.link(sValid, 'out', sBranch, 'cond');
  g.link(sPawn, 'out', sLoc, 'target');
  g.link(sPawn, 'out', sFwd, 'target');
  g.link(sFwd, 'out', sOff, 'a');
  g.link(sLoc, 'out', sAt, 'a');
  g.link(sOff, 'out', sAt, 'b');
  g.link(sBranch, 'true', sSpawn);
  g.link(sAt, 'out', sSpawn, 'loc');
  g.link(sSpawn, 'then', sVel);
  g.link(sSpawn, 'actor', sVel, 'target');
  g.link(sFwd, 'out', sSpeed, 'a');
  g.link(sSpeed, 'out', sVel, 'vel');
  g.link(sVel, 'then', sSound);

  // Gracz: duszek go straszy — traci energię i przez sekundę nic mu nie grozi.
  g = geGraph(player);
  const safe = g.variable('Nietykalny', 'bool', false);
  const hEv = g.add('ev_custom', 0, 0, { name: 'Oberwal' });
  const hSafe = g.add('var_get', 0, 160, { var: safe });
  const hNot = g.add('not', 192, 160);
  const hBranch = g.add('branch', 288, 0);
  const hSet = g.add('var_set', 544, 0, { var: safe }, { value: true });
  const hLose = g.add('add_gvar', 800, 0, {}, { name: 'Energia', amount: -1 });
  const hSound = g.add('sound', 1072, 0, { sound: 'hit' });
  const hPrint = g.add('print', 1280, 0, {}, { text: 'Buuu! Duszek cię przestraszył! 👻' });
  const hLeft = g.add('get_gvar', 1280, 224, {}, { name: 'Energia' });
  const hOut = g.add('le', 1504, 224, {}, { b: 0 });
  const hOutBranch = g.add('branch', 1568, 0);
  const hMsg = g.add('message', 1840, -96, {}, { text: 'Duszki wygrały tym razem! 👻' });
  const hWait = g.add('delay', 2128, -96, {}, { dur: 2 });
  const hRestart = g.add('restart', 2368, -96);
  const hSafeWait = g.add('delay', 1840, 96, {}, { dur: 1 });
  const hUnsafe = g.add('var_set', 2128, 96, { var: safe }, { value: false });
  g.link(hEv, 'then', hBranch);
  g.link(hSafe, 'out', hNot, 'a');
  g.link(hNot, 'out', hBranch, 'cond');
  g.link(hBranch, 'true', hSet);
  g.link(hSet, 'then', hLose);
  g.link(hLose, 'then', hSound);
  g.link(hSound, 'then', hPrint);
  g.link(hPrint, 'then', hOutBranch);
  g.link(hLeft, 'out', hOut, 'a');
  g.link(hOut, 'out', hOutBranch, 'cond');
  g.link(hOutBranch, 'true', hMsg);
  g.link(hMsg, 'then', hWait);
  g.link(hWait, 'then', hRestart);
  g.link(hOutBranch, 'false', hSafeWait);
  g.link(hSafeWait, 'then', hUnsafe);

  // Bańka: pęka po 1,6 s albo na pierwszej przeszkodzie; duszkowi mówi „Trafiony”.
  g = geGraph(bubble);
  a = g.add('ev_begin', 0, 0);
  b = g.add('delay', 288, 0, {}, { dur: 1.6 });
  g.link(a, 'then', b);
  g.link(b, 'then', g.add('destroy', 528, 0));
  const bHit = g.add('ev_hit', 0, 192);
  const bSeq = g.add('sequence', 288, 192);
  const bIsA = g.add('is_a', 288, 384, { cls: ghost.id });
  const bBranch = g.add('branch', 544, 192);
  const bCall = g.add('call_event', 800, 160, { name: 'Trafiony' });
  const bDestroy = g.add('destroy', 800, 400);
  g.link(bHit, 'then', bSeq);
  g.link(bHit, 'other', bIsA, 'actor');
  g.link(bSeq, 'then0', bBranch);
  g.link(bIsA, 'out', bBranch, 'cond');
  g.link(bBranch, 'true', bCall);
  g.link(bHit, 'other', bCall, 'target');
  g.link(bSeq, 'then1', bDestroy);

  // Duszek: leci do gracza, gdy jest blisko (Zasieg), po straszeniu chwilę odpoczywa,
  // a po 2 trafieniach bańką zamienia się w gwiazdkę.
  g = geGraph(ghost);
  const energy = g.variable('Energia', 'int', 2, true);
  const range = g.variable('Zasieg', 'float', 380, true);
  const rest = g.variable('Odpoczywa', 'bool', false);
  const tTick = g.add('ev_tick', 0, 0);
  const tPawn = g.add('get_pawn', 0, 160);
  const tValid = g.add('is_valid', 224, 128);
  const tDist = g.add('distance', 224, 224);
  const tRange = g.add('var_get', 224, 320, { var: range });
  const tNear = g.add('lt', 448, 256);
  const tRest = g.add('var_get', 448, 352, { var: rest });
  const tAwake = g.add('not', 640, 352);
  const tAnd1 = g.add('and', 640, 192);
  const tAnd2 = g.add('and', 832, 256);
  const tBranch = g.add('branch', 320, 0);
  const tPawnLoc = g.add('get_location', 832, 384);
  const tMyLoc = g.add('get_location', 832, 480);
  const tTo = g.add('vec_sub', 1056, 416);
  const tDir = g.add('vec_norm', 1248, 416);
  const tMove = g.add('move_input', 1088, 0, {}, { scale: 1 });
  g.link(tTick, 'then', tBranch);
  g.link(tPawn, 'out', tValid, 'actor');
  g.link(tPawn, 'out', tDist, 'other');
  g.link(tDist, 'out', tNear, 'a');
  g.link(tRange, 'out', tNear, 'b');
  g.link(tRest, 'out', tAwake, 'a');
  g.link(tValid, 'out', tAnd1, 'a');
  g.link(tNear, 'out', tAnd1, 'b');
  g.link(tAnd1, 'out', tAnd2, 'a');
  g.link(tAwake, 'out', tAnd2, 'b');
  g.link(tAnd2, 'out', tBranch, 'cond');
  g.link(tPawn, 'out', tPawnLoc, 'target');
  g.link(tPawnLoc, 'out', tTo, 'a');
  g.link(tMyLoc, 'out', tTo, 'b');
  g.link(tTo, 'out', tDir, 'a');
  g.link(tBranch, 'true', tMove);
  g.link(tDir, 'out', tMove, 'dir');

  const uEv = g.add('ev_hit', 0, 640);
  const uIsA = g.add('is_a', 32, 800, { cls: player.id });
  const uBranch = g.add('branch', 288, 640);
  const uCall = g.add('call_event', 544, 640, { name: 'Oberwal' });
  const uRest = g.add('var_set', 832, 640, { var: rest }, { value: true });
  const uWait = g.add('delay', 1088, 640, {}, { dur: 1.5 });
  const uAwake = g.add('var_set', 1344, 640, { var: rest }, { value: false });
  g.link(uEv, 'then', uBranch);
  g.link(uEv, 'other', uIsA, 'actor');
  g.link(uIsA, 'out', uBranch, 'cond');
  g.link(uBranch, 'true', uCall);
  g.link(uEv, 'other', uCall, 'target');
  g.link(uCall, 'then', uRest);
  g.link(uRest, 'then', uWait);
  g.link(uWait, 'then', uAwake);

  const xEv = g.add('ev_custom', 0, 960, { name: 'Trafiony' });
  const xEnergy = g.add('var_get', 0, 1120, { var: energy });
  const xSub = g.add('sub', 224, 1120, {}, { b: 1 });
  const xSet = g.add('var_set', 288, 960, { var: energy });
  const xSeq = g.add('sequence', 544, 960);
  const xLeft = g.add('var_get', 576, 1216, { var: energy });
  const xGone = g.add('le', 768, 1216, {}, { b: 0 });
  const xBranch = g.add('branch', 832, 928);
  const xLoc = g.add('get_location', 864, 1120);
  const xSpawn = g.add('spawn', 1088, 928, { cls: star.id });
  const xSound = g.add('sound', 1376, 928, { sound: 'coin' });
  const xDestroy = g.add('destroy', 1600, 928);
  const xHide = g.add('set_visible', 832, 1344, {}, { hidden: true });
  const xWait = g.add('delay', 1088, 1344, {}, { dur: 0.1 });
  const xShow = g.add('set_visible', 1344, 1344, {}, { hidden: false });
  g.link(xEv, 'then', xSet);
  g.link(xEnergy, 'out', xSub, 'a');
  g.link(xSub, 'out', xSet, 'value');
  g.link(xSet, 'then', xSeq);
  g.link(xLeft, 'out', xGone, 'a');
  g.link(xSeq, 'then0', xBranch);
  g.link(xGone, 'out', xBranch, 'cond');
  g.link(xBranch, 'true', xSpawn);
  g.link(xLoc, 'out', xSpawn, 'loc');
  g.link(xSpawn, 'then', xSound);
  g.link(xSound, 'then', xDestroy);
  g.link(xSeq, 'then1', xHide);
  g.link(xHide, 'then', xWait);
  g.link(xWait, 'then', xShow);

  // Przedmioty do zebrania: [klasa, zmienna gry, ile dodać, napis].
  [[star, 'Punkty', 10, null], [heart, 'Energia', 1, 'Energia +1 💖'], [key, 'Klucz', 1, 'Masz klucz! Otwórz nim złote drzwi 🗝️']].forEach(([bp, name, amount, text]) => {
    const gp = geGraph(bp);
    const ev = gp.add('ev_overlap', 0, 0);
    const isA = gp.add('is_a', 32, 160, { cls: player.id });
    const branch = gp.add('branch', 288, 0);
    const add = gp.add('add_gvar', 544, 0, {}, { name, amount });
    const sound = gp.add('sound', 832, 0, { sound: 'coin' });
    let last = sound;
    gp.link(ev, 'then', branch);
    gp.link(ev, 'other', isA, 'actor');
    gp.link(isA, 'out', branch, 'cond');
    gp.link(branch, 'true', add);
    gp.link(add, 'then', sound);
    if (text) {
      last = gp.add('print', 1056, 0, {}, { text });
      gp.link(sound, 'then', last);
    }
    gp.link(last, 'then', gp.add('destroy', 1344, 0));
  });

  // Złote drzwi: znikają, gdy gracz z kluczem podejdzie (komponent Strefa jest większy od drzwi).
  g = geGraph(door);
  const dEv = g.add('ev_comp_overlap', 0, 0, { comp: doorZone });
  const dIsA = g.add('is_a', 32, 160, { cls: player.id });
  const dBranch = g.add('branch', 288, 0);
  const dKey = g.add('get_gvar', 288, 192, {}, { name: 'Klucz' });
  const dHas = g.add('ge', 512, 192, {}, { b: 1 });
  const dKeyBranch = g.add('branch', 576, 0);
  const dSound = g.add('sound', 864, -64, { sound: 'win' });
  const dPrint = g.add('print', 1088, -64, {}, { text: 'Drzwi otwarte!' });
  const dDestroy = g.add('destroy', 1376, -64);
  const dLocked = g.add('print', 864, 128, {}, { text: 'Zamknięte. Potrzebujesz klucza 🗝️' });
  g.link(dEv, 'then', dBranch);
  g.link(dEv, 'other', dIsA, 'actor');
  g.link(dIsA, 'out', dBranch, 'cond');
  g.link(dBranch, 'true', dKeyBranch);
  g.link(dKey, 'out', dHas, 'a');
  g.link(dHas, 'out', dKeyBranch, 'cond');
  g.link(dKeyBranch, 'true', dSound);
  g.link(dSound, 'then', dPrint);
  g.link(dPrint, 'then', dDestroy);
  g.link(dKeyBranch, 'false', dLocked);

  // Wyjście: wygrana, gdy nie ma już duszków.
  g = geGraph(exit);
  const eEv = g.add('ev_overlap', 0, 0);
  const eCast = g.add('cast', 288, 0, { cls: player.id });
  const eGhosts = g.add('get_all_actors', 576, 0, { cls: ghost.id });
  const eCount = g.add('array_length', 640, 192);
  const eNone = g.add('eq', 832, 192, {}, { b: 0 });
  const eWinBranch = g.add('branch', 864, 0);
  const eMsg = g.add('message', 1184, -64, {}, { text: 'WSZYSTKIE DUSZKI ZŁAPANE! 🎉' });
  const eSound = g.add('sound', 1472, -64, { sound: 'win' });
  const ePause = g.add('pause', 1696, -64, {}, { paused: true });
  const eText = g.add('append', 1184, 224, {}, { a: 'Najpierw złap wszystkie duszki! Zostało: ' });
  const ePrint = g.add('print', 1472, 128);
  g.link(eEv, 'then', eCast);
  g.link(eEv, 'other', eCast, 'actor');
  g.link(eCast, 'then', eGhosts);
  g.link(eGhosts, 'then', eWinBranch);
  g.link(eGhosts, 'actors', eCount, 'array');
  g.link(eCount, 'out', eNone, 'a');
  g.link(eNone, 'out', eWinBranch, 'cond');
  g.link(eWinBranch, 'true', eMsg);
  g.link(eMsg, 'then', eSound);
  g.link(eSound, 'then', ePause);
  g.link(eWinBranch, 'false', ePrint);
  g.link(eCount, 'out', eText, 'b');
  g.link(eText, 'out', ePrint, 'text');

  // HUD: celownik, „pistolet na bańki” na dole i liczniki.
  geTplHud(hud, 420, 44, [['TekstEnergia', '💖 5', 24, 12, 110, 22], ['TekstDuszki', '👻 6', 140, 12, 110, 22], ['TekstPunkty', '⭐ 0', 256, 12, 160, 22]]);
  Object.assign(geAddWidgetElement(hud, 'text', 460, 250), { name: 'Celownik', text: '+', w: 40, h: 40, size: 34, align: 'center' });
  Object.assign(geAddWidgetElement(hud, 'text', 410, 420), { name: 'Pistolet', text: '🔫', w: 140, h: 120, size: 96, align: 'center' });
  g = geGraph(hud);
  const uTick = g.add('ev_tick', 0, 0);
  let prevSet = uTick;
  [['TekstEnergia', '💖 ', 'get_gvar', 'Energia'], ['TekstDuszki', '👻 ', 'count_class', null], ['TekstPunkty', '⭐ ', 'get_gvar', 'Punkty']].forEach(([el, label, type, name], i) => {
    const value = type === 'get_gvar' ? g.add(type, 64 + i * 352, 288, {}, { name }) : g.add(type, 64 + i * 352, 288, { cls: ghost.id });
    const text = g.add('append', 128 + i * 352, 160, {}, { a: label });
    const set = g.add('set_widget_text', 288 + i * 352, 0, {}, { name: el });
    g.link(value, 'out', text, 'b');
    g.link(text, 'out', set, 'text');
    g.link(prevSet, 'then', set);
    prevSet = set;
  });

  geGraph(p.level).add('ev_begin', 0, 0);

  // Labirynt z mapy: jedna kratka = jeden aktor (ścianę łatwo potem przesunąć albo usunąć).
  const cell = 64;
  const legend = { '#': wall, b: brick, w: wood, D: door, G: ghost, '*': star, K: key, S: heart, E: exit, P: player };
  GE_FPS_MAP.forEach((row, r) => [...row].forEach((ch, c) => {
    if (legend[ch]) geAddActor(p, legend[ch], c * cell + cell / 2, r * cell + cell / 2);
  }));
  Object.assign(p.settings, { spawnX: 96, spawnY: 96 });
  return p;
}
