/*
 * Vector sources for the built-in Pivot Animator skins.
 *
 * Contract copied from pivot-animator.js:
 *   canvas: 1536 x 1024, cells: 512 x 512, centre line: x = 256
 *   head      top 176, bottom 428
 *   torso     top 100, bottom 412
 *   upperArm  top 158, bottom 354
 *   forearm   top 168, bottom 345
 *   thigh     top 151, bottom 361
 *   shin      top 140, bottom 371
 *
 * Run with: node assets/pivot-skins/src/generate-skins.js
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const OUT = __dirname;
const STYLE = `
    .outline { stroke: #302a35; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
    .detail { fill: none; stroke: #302a35; stroke-width: 7; stroke-linecap: round; stroke-linejoin: round; }
    .fine { fill: none; stroke: #302a35; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
    .soft { stroke: #302a35; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  `;

function cell(col, row, id, content) {
  return `<g id="${id}" transform="translate(${col * 512} ${row * 512})">${content}</g>`;
}

function document(title, cells) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1536" height="1024" viewBox="0 0 1536 1024" role="img" aria-label="${title}">
  <style>${STYLE}</style>
  ${cells.join('\n  ')}
</svg>
`;
}

const faces = {
  cowboy: `
    <path d="M143 281 C127 228 153 184 191 164 C207 144 231 134 256 134 C284 134 308 144 324 164 C362 184 386 230 369 281 L365 377 C343 416 307 438 256 442 C205 438 169 416 147 377 Z" fill="#6f432b" class="outline"/>
    <ellipse cx="129" cy="309" rx="20" ry="32" fill="#f2b78e" class="outline"/>
    <ellipse cx="383" cy="309" rx="20" ry="32" fill="#f2b78e" class="outline"/>
    <circle cx="256" cy="302" r="126" fill="#f2b78e" class="outline"/>
    <path d="M158 244 Q181 203 207 187 Q190 231 193 267" fill="#6f432b" class="outline"/>
    <path d="M354 244 Q331 203 305 187 Q322 231 319 267" fill="#6f432b" class="outline"/>
    <path d="M202 293 Q218 283 234 293" class="fine"/>
    <path d="M278 293 Q294 283 310 293" class="fine"/>
    <circle cx="220" cy="300" r="7" fill="#302a35"/>
    <circle cx="292" cy="300" r="7" fill="#302a35"/>
    <path d="M256 306 Q247 330 259 334" class="fine"/>
    <path d="M211 354 Q256 389 301 354 Q292 407 256 410 Q220 407 211 354 Z" fill="#fffaf3" class="outline"/>
    <path d="M229 372 Q256 383 283 372" class="fine"/>
    <path d="M82 152 Q98 128 157 124 L171 55 Q174 42 188 40 L324 40 Q338 42 341 55 L355 124 Q414 128 430 152 Q433 169 409 174 Q256 196 103 174 Q79 169 82 152 Z" fill="#9a5e2f" class="outline"/>
    <path d="M159 119 Q256 137 353 119 L357 148 Q256 166 155 148 Z" fill="#5d3825" class="outline"/>
    <path d="M178 63 Q256 78 334 63" class="fine" opacity=".65"/>
    <path d="M102 154 Q256 179 410 154" class="fine" opacity=".65"/>
  `,
  police: `
    <path d="M137 267 C129 214 166 170 207 157 Q225 139 256 138 Q287 139 305 157 C346 170 383 214 375 267 L366 377 Q329 438 256 444 Q183 438 146 377 Z" fill="#6b462e" class="outline"/>
    <ellipse cx="130" cy="309" rx="20" ry="31" fill="#eab184" class="outline"/>
    <ellipse cx="382" cy="309" rx="20" ry="31" fill="#eab184" class="outline"/>
    <circle cx="256" cy="302" r="126" fill="#eab184" class="outline"/>
    <path d="M151 250 Q163 194 211 177 Q199 212 199 259" fill="#6b462e" class="outline"/>
    <path d="M361 250 Q349 194 301 177 Q313 212 313 259" fill="#6b462e" class="outline"/>
    <path d="M205 291 Q220 283 235 292" class="fine"/>
    <path d="M277 292 Q292 283 307 291" class="fine"/>
    <circle cx="222" cy="299" r="7" fill="#302a35"/>
    <circle cx="290" cy="299" r="7" fill="#302a35"/>
    <path d="M256 307 Q247 330 259 334" class="fine"/>
    <path d="M215 359 Q256 389 297 359" class="detail"/>
    <path d="M138 139 L151 86 Q155 67 176 62 Q256 39 336 62 Q357 67 361 86 L374 139 Z" fill="#223e75" class="outline"/>
    <path d="M151 122 Q256 89 361 122 L369 153 Q256 177 143 153 Z" fill="#2f5595" class="outline"/>
    <path d="M116 160 Q256 136 396 160 Q379 190 256 188 Q133 190 116 160 Z" fill="#182c55" class="outline"/>
    <path d="M256 73 L279 86 L273 112 Q256 129 239 112 L233 86 Z" fill="#ffd34f" class="outline"/>
    <path d="M256 84 L262 94 L259 106 L253 106 L250 94 Z" fill="#fff2a6"/>
  `,
  princess: `
    <path d="M118 256 Q115 171 176 139 Q206 116 256 118 Q306 116 336 139 Q397 171 394 256 L397 424 Q397 466 360 478 L322 456 Q290 480 256 478 Q222 480 190 456 L152 478 Q115 466 115 424 Z" fill="#8a532f" class="outline"/>
    <path d="M130 278 Q111 335 119 432 Q123 472 158 478 Q184 470 184 434 L180 304 Z" fill="#9b6036" class="outline"/>
    <path d="M382 278 Q401 335 393 432 Q389 472 354 478 Q328 470 328 434 L332 304 Z" fill="#9b6036" class="outline"/>
    <ellipse cx="130" cy="309" rx="19" ry="31" fill="#f3bd9a" class="outline"/>
    <ellipse cx="382" cy="309" rx="19" ry="31" fill="#f3bd9a" class="outline"/>
    <circle cx="256" cy="302" r="126" fill="#f3bd9a" class="outline"/>
    <path d="M145 253 Q164 164 250 172 Q214 206 202 253 Q180 230 145 253 Z" fill="#8a532f" class="outline"/>
    <path d="M367 253 Q348 164 262 172 Q298 206 310 253 Q332 230 367 253 Z" fill="#8a532f" class="outline"/>
    <path d="M211 293 Q225 283 239 293" class="fine"/>
    <path d="M273 293 Q287 283 301 293" class="fine"/>
    <circle cx="225" cy="300" r="7" fill="#302a35"/>
    <circle cx="287" cy="300" r="7" fill="#302a35"/>
    <circle cx="190" cy="337" r="12" fill="#ef8d9c" opacity=".55"/>
    <circle cx="322" cy="337" r="12" fill="#ef8d9c" opacity=".55"/>
    <path d="M256 307 Q247 328 259 333" class="fine"/>
    <path d="M220 358 Q256 387 292 358 Q284 400 256 403 Q228 400 220 358 Z" fill="#fff8f4" class="outline"/>
    <path d="M171 143 L151 57 L210 91 L256 22 L302 91 L361 57 L341 143 Q256 166 171 143 Z" fill="#ffd34f" class="outline"/>
    <circle cx="202" cy="111" r="13" fill="#f0649c" class="soft"/>
    <circle cx="256" cy="87" r="15" fill="#66bbed" class="soft"/>
    <circle cx="310" cy="111" r="13" fill="#f0649c" class="soft"/>
    <path d="M177 139 Q256 157 335 139" class="fine" opacity=".55"/>
  `
};

const cowboy = document('Kowboj - arkusz części postaci', [
  cell(0, 0, 'head', faces.cowboy),
  cell(1, 0, 'torso', `
    <defs><clipPath id="cowboy-shirt"><path d="M256 96 C222 96 188 105 164 132 L184 377 Q185 406 213 420 L299 420 Q327 406 328 377 L348 132 C324 105 290 96 256 96 Z"/></clipPath></defs>
    <path d="M256 96 C222 96 188 105 164 132 L184 377 Q185 406 213 420 L299 420 Q327 406 328 377 L348 132 C324 105 290 96 256 96 Z" fill="#d85845" class="outline"/>
    <g clip-path="url(#cowboy-shirt)" opacity=".7">
      <path d="M175 145 H339 M173 193 H339 M177 241 H335 M179 289 H333 M181 337 H331" stroke="#f6d7b0" stroke-width="9"/>
      <path d="M202 94 V416 M256 94 V420 M310 94 V416" stroke="#f6d7b0" stroke-width="9"/>
      <path d="M175 169 H339 M175 265 H335 M180 361 H332 M229 94 V420 M283 94 V420" stroke="#8e382f" stroke-width="5"/>
    </g>
    <path d="M230 98 Q256 124 282 98 L300 127 L281 159 L231 159 L212 127 Z" fill="#f2b78e" class="outline"/>
    <path d="M207 111 Q256 126 305 111 L326 138 L283 164 L256 208 L229 164 L186 138 Z" fill="#c33f36" class="outline"/>
    <circle cx="256" cy="156" r="10" fill="#ffd36a" class="soft"/>
    <path d="M166 130 Q201 112 230 124 L249 176 L226 366 L179 381 Z" fill="#75472c" class="outline"/>
    <path d="M346 130 Q311 112 282 124 L263 176 L286 366 L333 381 Z" fill="#75472c" class="outline"/>
    <path d="M204 206 H231 L226 258 H191 Z" fill="#9a6037" class="outline"/>
    <path d="M308 206 H281 L286 258 H321 Z" fill="#9a6037" class="outline"/>
    <path d="M179 366 Q256 383 333 366 L334 421 Q256 438 178 421 Z" fill="#56382b" class="outline"/>
    <rect x="220" y="376" width="72" height="54" rx="12" fill="#e4a831" class="outline"/>
    <rect x="237" y="388" width="38" height="30" rx="6" fill="#75472c" class="soft"/>
  `),
  cell(2, 0, 'upper-arm', `
    <defs><clipPath id="cowboy-arm"><rect x="221" y="123" width="70" height="266" rx="35"/></clipPath></defs>
    <rect x="221" y="123" width="70" height="266" rx="35" fill="#d85845" class="outline"/>
    <g clip-path="url(#cowboy-arm)" opacity=".75">
      <path d="M220 177 H292 M220 231 H292 M220 285 H292 M220 339 H292" stroke="#f6d7b0" stroke-width="8"/>
      <path d="M243 120 V390 M276 120 V390" stroke="#f6d7b0" stroke-width="8"/>
      <path d="M220 204 H292 M220 312 H292 M259 120 V390" stroke="#8e382f" stroke-width="5"/>
    </g>
    <path d="M221 327 Q256 338 291 327 L290 360 Q256 371 222 360 Z" fill="#f6d7b0" class="outline"/>
  `),
  cell(0, 1, 'forearm-hand', `
    <rect x="222" y="134" width="68" height="228" rx="34" fill="#d85845" class="outline"/>
    <path d="M222 283 Q256 294 290 283 L290 324 Q256 337 222 324 Z" fill="#f6d7b0" class="outline"/>
    <circle cx="256" cy="345" r="32" fill="#f2b78e" class="outline"/>
    <path d="M225 347 Q222 371 231 400 Q239 423 256 426 Q273 423 281 400 Q290 371 287 347 Q274 334 256 334 Q238 334 225 347 Z" fill="#f2b78e" class="outline"/>
    <path d="M241 382 Q256 391 271 382" class="fine" opacity=".45"/>
  `),
  cell(1, 1, 'thigh', `
    <rect x="213" y="108" width="86" height="296" rx="43" fill="#3973aa" class="outline"/>
    <path d="M256 111 V400" stroke="#27547e" stroke-width="7" stroke-dasharray="15 12"/>
    <path d="M218 177 Q256 195 294 177" class="fine" opacity=".65"/>
    <path d="M220 340 Q256 354 292 340" class="fine" opacity=".55"/>
  `),
  cell(2, 1, 'shin-boot', `
    <rect x="219" y="103" width="74" height="298" rx="37" fill="#3973aa" class="outline"/>
    <path d="M256 107 V333" stroke="#27547e" stroke-width="7" stroke-dasharray="15 12"/>
    <path d="M209 304 Q256 322 303 304 L306 415 Q256 432 206 415 Z" fill="#81502e" class="outline"/>
    <path d="M193 405 Q256 389 319 405 L326 446 Q317 466 292 468 L220 468 Q195 466 186 446 Z" fill="#9a5e32" class="outline"/>
    <path d="M189 446 Q256 460 323 446 L320 467 Q256 480 192 467 Z" fill="#4d3428" class="outline"/>
    <path d="M221 318 Q256 337 291 318" class="fine"/>
    <path d="M215 386 H297" class="fine"/>
    <path d="M239 337 L256 354 L273 337 L273 376 L256 392 L239 376 Z" fill="#d6a23d" class="soft"/>
  `)
]);

const police = document('Policjant - arkusz części postaci', [
  cell(0, 0, 'head', faces.police),
  cell(1, 0, 'torso', `
    <path d="M256 96 C219 96 181 105 158 134 L181 382 Q184 413 215 423 L297 423 Q328 413 331 382 L354 134 C331 105 293 96 256 96 Z" fill="#2f5595" class="outline"/>
    <path d="M224 99 L256 137 L288 99 L311 119 L279 169 H233 L201 119 Z" fill="#d8e7f5" class="outline"/>
    <path d="M256 137 V366" class="detail"/>
    <circle cx="256" cy="204" r="6" fill="#d8e7f5"/>
    <circle cx="256" cy="265" r="6" fill="#d8e7f5"/>
    <circle cx="256" cy="326" r="6" fill="#d8e7f5"/>
    <path d="M171 127 L225 113 L231 139 L176 151 Z" fill="#182c55" class="outline"/>
    <path d="M341 127 L287 113 L281 139 L336 151 Z" fill="#182c55" class="outline"/>
    <path d="M181 207 H231 V270 Q206 283 181 270 Z" fill="#416baa" class="outline"/>
    <path d="M281 207 H331 V270 Q306 283 281 270 Z" fill="#416baa" class="outline"/>
    <path d="M286 171 L310 184 L304 211 Q286 230 268 211 L262 184 Z" fill="#ffd34f" class="outline"/>
    <path d="M177 363 Q256 379 335 363 L337 423 Q256 439 175 423 Z" fill="#202632" class="outline"/>
    <rect x="218" y="374" width="76" height="50" rx="9" fill="#bac4cf" class="outline"/>
    <rect x="237" y="387" width="38" height="24" rx="4" fill="#202632" class="soft"/>
  `),
  cell(2, 0, 'upper-arm', `
    <rect x="221" y="123" width="70" height="266" rx="35" fill="#2f5595" class="outline"/>
    <path d="M221 191 Q256 206 291 191 L291 228 Q256 242 221 228 Z" fill="#182c55" class="outline"/>
    <path d="M222 326 Q256 339 290 326 L290 359 Q256 371 222 359 Z" fill="#416baa" class="outline"/>
  `),
  cell(0, 1, 'forearm-hand', `
    <rect x="222" y="134" width="68" height="228" rx="34" fill="#2f5595" class="outline"/>
    <path d="M222 285 Q256 298 290 285 L290 326 Q256 339 222 326 Z" fill="#182c55" class="outline"/>
    <circle cx="256" cy="345" r="32" fill="#eab184" class="outline"/>
    <path d="M225 347 Q222 371 231 400 Q239 423 256 426 Q273 423 281 400 Q290 371 287 347 Q274 334 256 334 Q238 334 225 347 Z" fill="#eab184" class="outline"/>
    <path d="M241 382 Q256 391 271 382" class="fine" opacity=".45"/>
  `),
  cell(1, 1, 'thigh', `
    <rect x="213" y="108" width="86" height="296" rx="43" fill="#223e75" class="outline"/>
    <path d="M256 111 V400" stroke="#172b52" stroke-width="7"/>
    <path d="M218 178 Q256 193 294 178" class="fine" opacity=".5"/>
    <path d="M220 338 Q256 351 292 338" class="fine" opacity=".45"/>
  `),
  cell(2, 1, 'shin-shoe', `
    <rect x="219" y="103" width="74" height="304" rx="37" fill="#223e75" class="outline"/>
    <path d="M256 108 V356" stroke="#172b52" stroke-width="7"/>
    <path d="M208 337 Q256 351 304 337 L305 415 Q256 430 207 415 Z" fill="#1e222a" class="outline"/>
    <path d="M191 405 Q256 393 321 405 L327 447 Q317 466 291 469 H221 Q195 466 185 447 Z" fill="#171a20" class="outline"/>
    <path d="M187 447 Q256 461 325 447 L322 467 Q256 480 190 467 Z" fill="#0d0f13" class="outline"/>
    <path d="M211 386 H301" class="fine" stroke="#59616d"/>
  `)
]);

const princess = document('Królewna - arkusz części postaci', [
  cell(0, 0, 'head', faces.princess),
  cell(1, 0, 'torso', `
    <path d="M202 290 Q256 312 310 290 L428 476 Q438 494 414 499 H98 Q74 494 84 476 Z" fill="#ed6fa8" class="outline"/>
    <path d="M202 295 Q256 319 310 295 L341 486 H171 Z" fill="#f58fbd" class="outline"/>
    <path d="M172 475 Q256 445 340 475" class="fine" stroke="#ffd0e4"/>
    <path d="M256 310 V486" class="fine" stroke="#d65191" opacity=".65"/>
    <path d="M256 96 C221 96 189 107 174 137 L201 307 Q219 335 256 340 Q293 335 311 307 L338 137 C323 107 291 96 256 96 Z" fill="#ef78ae" class="outline"/>
    <path d="M218 100 Q256 142 294 100 L311 132 Q291 170 256 178 Q221 170 201 132 Z" fill="#f3bd9a" class="outline"/>
    <path d="M205 142 Q256 177 307 142 L310 286 Q286 313 256 317 Q226 313 202 286 Z" fill="#f58fbd" class="outline"/>
    <path d="M256 174 V314" class="fine" stroke="#d65191"/>
    <path d="M217 196 L240 209 L232 234 L205 224 Z" fill="#ffd6e8" class="soft"/>
    <path d="M295 196 L272 209 L280 234 L307 224 Z" fill="#ffd6e8" class="soft"/>
    <path d="M198 284 Q256 308 314 284 L321 326 Q256 352 191 326 Z" fill="#d65191" class="outline"/>
    <circle cx="256" cy="321" r="16" fill="#ffd34f" class="soft"/>
  `),
  cell(2, 0, 'upper-arm-puff', `
    <rect x="222" y="124" width="68" height="264" rx="34" fill="#f3bd9a" class="outline"/>
    <ellipse cx="256" cy="158" rx="55" ry="49" fill="#ef78ae" class="outline"/>
    <path d="M215 148 Q256 118 297 148" class="fine" stroke="#ffd0e4"/>
    <path d="M222 181 Q256 201 290 181 L289 246 Q256 260 223 246 Z" fill="#f58fbd" class="outline"/>
    <path d="M222 318 Q256 330 290 318" class="fine" opacity=".4"/>
  `),
  cell(0, 1, 'forearm-hand', `
    <rect x="222" y="134" width="68" height="228" rx="34" fill="#f3bd9a" class="outline"/>
    <path d="M220 272 Q256 286 292 272 L289 314 Q256 326 223 314 Z" fill="#ffd34f" class="outline"/>
    <circle cx="256" cy="345" r="32" fill="#f3bd9a" class="outline"/>
    <path d="M225 347 Q222 371 231 400 Q239 423 256 426 Q273 423 281 400 Q290 371 287 347 Q274 334 256 334 Q238 334 225 347 Z" fill="#f3bd9a" class="outline"/>
    <path d="M241 382 Q256 391 271 382" class="fine" opacity=".38"/>
  `),
  cell(1, 1, 'thigh-dress', `
    <rect x="213" y="108" width="86" height="296" rx="43" fill="#ed6fa8" class="outline"/>
    <path d="M256 112 V400" class="fine" stroke="#ffd0e4"/>
    <path d="M219 176 Q256 194 293 176" class="fine" stroke="#d65191"/>
    <path d="M220 340 Q256 356 292 340" class="fine" stroke="#d65191"/>
  `),
  cell(2, 1, 'shin-slipper', `
    <rect x="220" y="104" width="72" height="302" rx="36" fill="#f4c8bc" class="outline"/>
    <path d="M221 185 Q256 200 291 185" class="fine" stroke="#e6aa9a"/>
    <path d="M209 337 Q256 351 303 337 L302 409 Q256 426 210 409 Z" fill="#f58fbd" class="outline"/>
    <path d="M190 401 Q256 389 322 401 L328 444 Q319 463 292 466 H220 Q193 463 184 444 Z" fill="#ed6fa8" class="outline"/>
    <path d="M186 444 Q256 458 326 444 L322 466 Q256 478 190 466 Z" fill="#b84078" class="outline"/>
    <path d="M221 359 L291 407 M291 359 L221 407" class="fine" stroke="#ffd34f"/>
    <circle cx="256" cy="385" r="11" fill="#ffd34f" class="soft"/>
  `)
]);

for (const [name, source] of Object.entries({ cowboy, police, princess })) {
  fs.writeFileSync(path.join(OUT, `${name}.svg`), source, 'utf8');
}

console.log('Generated cowboy.svg, police.svg and princess.svg.');
