/* Build the SVG sources, render their PNGs with Chromium and run validation. */
'use strict';

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const SKIN_DIR = path.resolve(__dirname, '..');
const QA_DIR = path.join(__dirname, 'qa');

function findChromium() {
  const candidates = process.platform === 'win32'
    ? [
        'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
        'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
        'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
      ]
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

function runNode(script) {
  const result = spawnSync(process.execPath, [script], { cwd: ROOT, stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`${path.basename(script)} failed with exit code ${result.status}.`);
}

function render(browser, input, output, width, height, virtualTime = 500) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'pivot-skins-'));
  const args = [
    '--headless=new',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--default-background-color=00000000',
    `--window-size=${width},${height}`,
    `--virtual-time-budget=${virtualTime}`,
    `--user-data-dir=${profile}`,
    `--screenshot=${output}`,
    pathToFileURL(input).href
  ];
  const result = spawnSync(browser, args, { cwd: ROOT, stdio: 'inherit' });
  fs.rmSync(profile, { recursive: true, force: true });
  if (result.status !== 0 || !fs.existsSync(output)) {
    throw new Error(`Chromium could not render ${path.basename(input)}.`);
  }
}

runNode(path.join(__dirname, 'generate-skins.js'));
const browser = findChromium();
if (!browser) throw new Error('Chrome or Edge was not found.');

const jobs = [
  ['cowboy.svg', 'kowboj.png'],
  ['police.svg', 'policjant.png'],
  ['princess.svg', 'krolewna.png']
];
for (const [source, target] of jobs) {
  render(browser, path.join(__dirname, source), path.join(SKIN_DIR, target), 1536, 1024);
}

runNode(path.join(__dirname, 'validate-skins.js'));
fs.mkdirSync(QA_DIR, { recursive: true });
render(browser, path.join(__dirname, 'test-skins.html'), path.join(QA_DIR, 'poses-and-template.png'), 1600, 1400, 3000);
console.log(`QA screenshot: ${path.relative(ROOT, path.join(QA_DIR, 'poses-and-template.png'))}`);

