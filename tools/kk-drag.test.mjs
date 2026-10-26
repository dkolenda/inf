// Test przeciągania kart w Kosmo Kroki w prawdziwym Chrome.
// Wymaga Chrome i pakietu playwright-core (raz: npm i --no-save playwright-core).
// Uruchomienie z katalogu projektu: node tools/kk-drag.test.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.argv[2] || '.');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.webp': 'image/webp', '.json': 'application/json', '.webmanifest': 'application/manifest+json' };
const server = http.createServer((req, res) => {
  const file = path.join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
  fs.readFile(file.endsWith(path.sep) ? path.join(file, 'index.html') : file, (err, data) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': types[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
}).listen(0);
const port = server.address().port;

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1400, height: 900 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => {
  if (location.protocol !== 'http:') return;
  localStorage.setItem('informatyczna-przygoda:name', 'Test');
  localStorage.setItem('informatyczna-przygoda:debug', '1');
  window.__nativeDrags = 0;
  document.addEventListener('dragstart', (e) => { if (!e.defaultPrevented) window.__nativeDrags += 1; });
});

let failed = 0;
const check = (ok, name, extra = '') => {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failed += 1;
};

const tree = () => page.evaluate(() => {
  const dump = (list) => list.map((n) => (n.body ? `${n.card}[${dump(n.body)}]` : n.card)).join(',');
  return dump(kosmoGame.program.main);
});
const center = async (locator) => {
  const b = await locator.boundingBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

// Przeciąga od punktu do punktu; w połowie drogi i nad celem sprawdza, co widać.
async function drag(from, to, probe) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  const steps = 12;
  for (let i = 1; i <= steps; i += 1) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / steps, from.y + ((to.y - from.y) * i) / steps);
  }
  const seen = probe ? await page.evaluate(probe) : null;
  await page.mouse.up();
  return seen;
}

const midDrag = () => ({
  previews: document.querySelectorAll('.kk-program .kk-preview').length,
  ghosts: document.querySelectorAll('.kk-ghost').length,
  dragging: document.querySelector('.kk-game').classList.contains('is-dragging'),
  selection: String(window.getSelection())
});

async function setup(cards) {
  await page.goto('about:blank');
  await page.goto(`http://localhost:${port}/index.html#/sciezka/programowanie/zadanie/9`);
  await page.evaluate(() => localStorage.removeItem(Object.keys(localStorage).find((k) => k.includes('kosmo') && k.includes('program')) || '-'));
  await page.locator('.cg-level-pick').last().click();
  await page.waitForSelector('.kk-program .kk-list');
  // Kilka startów poziomu z rzędu (następny poziom, restart) — jak u ucznia, który gra dłużej.
  await page.evaluate(() => {
    for (let i = 0; i < 4; i += 1) kkGoToLevel(kosmoGame, kosmoGame.game.levels.length - 1 - (i % 2));
    kkGoToLevel(kosmoGame, kosmoGame.game.levels.length - 1);
  });
  await page.evaluate((cards) => {
    kosmoGame.program.funcs = [];
    kosmoGame.program.main = [];
    kosmoGame.cursor = { list: 'main', index: 0 };
    let id = 1000;
    const build = (spec) => spec.map((s) => (Array.isArray(s) ? { card: s[0], id: `t${id++}`, ...(s[0] === 'repeat' ? { digits: '2' } : {}), body: build(s[1]) } : { card: s, id: `t${id++}` }));
    kosmoGame.program.main = build(cards);
    kkRenderProgram(kosmoGame);
  }, cards);
  await page.evaluate(() => { window.__nativeDrags = 0; });
}

const main = '.kk-strip[data-tab="main"] > .kk-scroll > .kk-list';
const topCards = `${main} > .kk-card:not(.kk-start), ${main} > .kk-loop`;

// 1. Zaznaczony tekst, potem przeciągnięcie Podnieś na koniec programu.
await setup(['step', 'take', 'left', 'right']);
{
  const list = page.locator(main);
  const box = await list.boundingBox();
  // Próba zaznaczenia myszką i potrójnym kliknięciem.
  await page.mouse.move(box.x + 2, box.y + 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width - 2, box.y + box.height - 2, { steps: 8 });
  await page.mouse.up();
  await page.mouse.click(box.x + box.width - 4, box.y + box.height - 4, { clickCount: 3 });
  check((await page.evaluate(() => String(window.getSelection()).trim())) === '', 'w programie nie da się zaznaczyć tekstu');
  // Wymuszone zaznaczenie (np. z innego miejsca strony) też nie może przejąć przeciągania.
  await page.evaluate(() => window.getSelection().selectAllChildren(document.querySelector('.kk-program')));
  const take = page.locator(`${main} > .kk-c-take .kk-card-face`);
  const last = page.locator(`${main} > .kk-c-right`);
  const lb = await last.boundingBox();
  const seen = await drag(await center(take), { x: lb.x + lb.width / 2, y: lb.y + lb.height + 6 }, midDrag);
  check(seen.previews === 1, 'Podnieś: jeden półprzezroczysty podgląd w programie', JSON.stringify(seen));
  check(await page.evaluate(() => window.__nativeDrags === 0), 'Podnieś: brak natywnego przeciągania przeglądarki');
  check((await tree()) === 'step,left,right,take', 'Podnieś przeniesione na koniec', await tree());
}

// 2. Powtórz z dziećmi — za nagłówek, na koniec programu.
await setup([['repeat', ['step', 'take']], 'left', 'right']);
{
  const head = page.locator(`${main} > .kk-loop > .kk-card .kk-card-face`).first();
  const lb = await page.locator(`${main} > .kk-c-right`).boundingBox();
  const seen = await drag(await center(head), { x: lb.x + lb.width / 2, y: lb.y + lb.height + 6 }, () => ({
    previews: document.querySelectorAll('.kk-program .kk-preview').length,
    previewCards: document.querySelector('.kk-program .kk-preview')?.querySelectorAll('.kk-card').length ?? 0,
    translucent: [...document.querySelectorAll('.kk-program .kk-card:not(.kk-start)')].filter((el) => !el.closest('.kk-preview') && el.offsetParent && Number(getComputedStyle(el.closest('.kk-loop') || el).opacity) < 1).length
  }));
  check(seen.previews === 1 && seen.previewCards === 3, 'Powtórz (nagłówek): podgląd z kartami w środku', JSON.stringify(seen));
  check(seen.translucent === 0, 'Powtórz (nagłówek): pozostałe karty nie są półprzezroczyste', JSON.stringify(seen));
  check((await tree()) === 'left,right,repeat[step,take]', 'Powtórz przeniesione razem z dziećmi', await tree());
  check(await page.evaluate(() => window.__nativeDrags === 0), 'Powtórz: brak natywnego przeciągania');
}

// 3. Powtórz za ramkę (lewy górny róg obramowania), na początek programu.
await setup(['left', ['repeat', ['step', 'take']], 'right']);
{
  const loop = page.locator(`${main} > .kk-loop`);
  const b = await loop.boundingBox();
  const from = { x: b.x + 3, y: b.y + b.height - 4 };
  const hit = await page.evaluate(({ x, y }) => {
    const el = document.elementFromPoint(x, y);
    return { loop: el.closest('.kk-list, .kk-loop')?.matches('.kk-loop') };
  }, from);
  check(hit.loop, 'punkt startu leży na ramce Powtórz');
  const first = await page.locator(`${main} > .kk-c-left`).boundingBox();
  const seen = await drag(from, { x: first.x + first.width / 2, y: first.y + 4 }, midDrag);
  check(seen.previews === 1, 'Powtórz (ramka): jeden podgląd', JSON.stringify(seen));
  check((await tree()) === 'repeat[step,take],left,right', 'Powtórz za ramkę przeniesione z dziećmi', await tree());
}

// 4. Jeśli z dziećmi — do środka Powtórz.
await setup([['repeat', ['step']], ['if', ['take', 'left']], 'right']);
{
  const head = page.locator(`${main} > .kk-loop.is-if > .kk-card .kk-card-face`);
  const inner = await page.locator(`${main} > .kk-loop:not(.is-if) > .kk-list > .kk-c-step`).boundingBox();
  await drag(await center(head), { x: inner.x + inner.width / 2, y: inner.y + inner.height + 4 });
  check((await tree()) === 'repeat[step,if[take,left]],right', 'Jeśli przeniesione z dziećmi do środka Powtórz', await tree());
}

// 5. Powtórz nie wolno włożyć do samego siebie — zostaje na miejscu.
await setup([['repeat', ['step', 'take']], 'right']);
{
  const head = page.locator(`${main} > .kk-loop > .kk-card .kk-card-face`);
  const inner = await page.locator(`${main} > .kk-loop > .kk-list > .kk-c-take`).boundingBox();
  await drag(await center(head), { x: inner.x + inner.width / 2, y: inner.y + inner.height + 4 });
  check((await tree()) === 'repeat[step,take],right', 'Powtórz upuszczone na swojej ramce zostaje na miejscu', await tree());
  await drag(await center(head), await center(page.locator(`${main} > .kk-loop > .kk-list > .kk-c-take`)));
  check((await tree()) === 'repeat[step,take],right', 'Powtórz nie wpada do siebie', await tree());
}

// 5b. Karta ze środka Powtórz wyciągnięta na koniec programu.
await setup([['repeat', ['step', 'take']], 'right']);
{
  const take = page.locator(`${main} > .kk-loop > .kk-list > .kk-c-take .kk-card-face`);
  const lb = await page.locator(`${main} > .kk-c-right`).boundingBox();
  await drag(await center(take), { x: lb.x + lb.width / 2, y: lb.y + lb.height + 6 });
  check((await tree()) === 'repeat[step],right,take', 'Podnieś wyciągnięte z Powtórz', await tree());
}

// 5c. Nowa karta Powtórz z belki do programu.
await setup(['step']);
{
  const pick = page.locator('.kk-palette .kk-pick[data-card="repeat"]').last();
  await pick.scrollIntoViewIfNeeded();
  const lb = await page.locator(`${main} > .kk-c-step`).boundingBox();
  const seen = await drag(await center(pick), { x: lb.x + lb.width / 2, y: lb.y + lb.height + 6 }, midDrag);
  check(seen.previews === 1, 'Powtórz z belki: podgląd', JSON.stringify(seen));
  check((await tree()) === 'step,repeat[]', 'Powtórz z belki dodane', await tree());
}

// 6. Klik w środek Powtórz nadal ustawia tam kursor (nie zaczyna przeciągania).
await setup([['repeat', []], 'right']);
{
  await page.locator(`${main} > .kk-loop > .kk-list`).click();
  check(await page.evaluate(() => kosmoGame.cursor.list === kosmoGame.program.main[0].id), 'klik w środek Powtórz ustawia kursor');
}

// 7. Każdy bloczek z belki: jeden duszek przy wskaźniku, jeden podgląd i dokładnie jedna nowa karta.
const picks = await (async () => {
  await setup([]);
  return page.evaluate(() => {
    const seen = new Set();
    return [...document.querySelectorAll('.kk-palette .kk-group:not(.is-suggested) .kk-pick')]
      .map((el) => ({ card: el.dataset.card, fn: el.dataset.fn, cond: el.dataset.cond, digit: el.dataset.digit }))
      .filter((p) => !seen.has(p.card) && seen.add(p.card));
  });
})();
const hosts = { cond: ['if', []], who: 'swap', event: ['on', []], number: ['repeat', []] };
for (const p of picks) {
  const slot = hosts[p.card];
  await setup(slot ? [slot] : ['step']);
  const sel = `.kk-palette .kk-group:not(.is-suggested) .kk-pick[data-card="${p.card}"]${p.fn ? `[data-fn="${p.fn}"]` : ''}${p.cond ? `[data-cond="${p.cond}"]` : ''}${p.digit ? `[data-digit="${p.digit}"]` : ''}`;
  const pick = page.locator(sel).first();
  await pick.scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => JSON.stringify(kosmoGame.program));
  const host = page.locator(`${main} > :is(.kk-card, .kk-loop):not(.kk-start)`).first();
  const hb = await host.boundingBox();
  const to = slot ? await center(page.locator(`${main} > :is(.kk-card, .kk-loop):not(.kk-start)`).first().locator('.kk-card-face').first()) : { x: hb.x + hb.width / 2, y: hb.y + hb.height + 6 };
  const seen = await drag(await center(pick), to, () => ({
    ghosts: document.querySelectorAll('.kk-ghost').length,
    markers: document.querySelectorAll('.kk-program .kk-preview, .kk-program .kk-drop').length
  }));
  const after = await page.evaluate(() => kosmoGame.program);
  const name = `bloczek „${p.card}” z belki`;
  check(seen.ghosts === 1, `${name}: jeden duszek przy wskaźniku`, JSON.stringify(seen));
  check(seen.markers === (p.card === 'who' || p.card === 'cond' || p.card === 'event' ? 0 : 1), `${name}: jeden podgląd w programie`, JSON.stringify(seen));
  const ok = slot
    ? (p.card === 'number' ? after.main[0].digits === '2' + p.digit || after.main[0].digits === p.digit + '2' : after.main[0].cond === p.cond)
    : after.main.length === 2 && after.main[1].card === p.card;
  check(ok, `${name}: wstawiony dokładnie raz`, JSON.stringify(after.main));
  if (p.card === 'call') check(after.funcs.length === JSON.parse(before).funcs.length + 1, `${name}: powstała jedna nowa funkcja`, `${after.funcs.length}`);
}

// 8. Każda karta w programie przeniesiona na koniec — jeden duszek i jeden podgląd.
for (const card of ['step', 'left', 'right', 'jump', 'take', 'give', 'throw', 'dodge', 'push', 'swap', ['repeat', ['step']], ['if', ['take']], ['on', ['dodge']]]) {
  const name = Array.isArray(card) ? card[0] : card;
  await setup([card, 'right']);
  const face = page.locator(`${main} > :is(.kk-card, .kk-loop):not(.kk-start)`).first().locator('.kk-card-face').first();
  const lb = await page.locator(`${main} > .kk-c-right`).last().boundingBox();
  const seen = await drag(await center(face), { x: lb.x + lb.width / 2, y: lb.y + lb.height + 6 }, () => ({
    ghosts: document.querySelectorAll('.kk-ghost').length,
    previews: document.querySelectorAll('.kk-program .kk-preview').length
  }));
  check(seen.ghosts === 1 && seen.previews === 1, `karta „${name}” w programie: jeden duszek i jeden podgląd`, JSON.stringify(seen));
  const t = await tree();
  check(t === `right,${Array.isArray(card) ? `${card[0]}[${card[1].join(',')}]` : card}`, `karta „${name}” przeniesiona raz`, t);
}

check(errors.length === 0, 'brak błędów JS', errors.join(' | '));
await browser.close();
server.close();
console.log(failed ? `\n${failed} test(ów) nie przeszło` : '\nWszystko OK');
process.exit(failed ? 1 : 0);
