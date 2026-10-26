// Zamienia obrazki PNG z tego folderu na src/game-template-assets.js (obrazki jako data URL), z którego
// korzystają szablony nowych projektów (game-templates.js). Po dodaniu albo zmianie obrazka uruchom:
//   node src/template-assets/build.js
const fs = require('node:fs');
const path = require('node:path');

const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.png')).sort();
const lines = files.map((f) => `  ${JSON.stringify(f.replace(/\.png$/, ''))}: 'data:image/png;base64,${fs.readFileSync(path.join(__dirname, f)).toString('base64')}'`);
fs.writeFileSync(path.join(__dirname, '..', 'game-template-assets.js'), `// Wygenerowane przez src/template-assets/build.js z plików PNG obok niego — nie edytuj ręcznie.
// Grafiki szablonów nowych projektów: nazwa pliku (bez .png) → obrazek jako data URL.
const GE_TEMPLATE_ASSETS = {
${lines.join(',\n')}
};
`);
console.log(`game-template-assets.js: ${files.length} obrazków`);
